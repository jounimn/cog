import { existsSync, readdirSync, statSync, readFileSync, openSync, readSync, closeSync } from 'fs'
import os from 'os'
import path from 'path'

/**
 * Per-CLI session persistence for Cog agents.
 *
 * Why: an agent's terminal is a PTY running a shell → CLI. When the shell or
 * its console host dies underneath us (on Windows the in-box ConPTY crashes
 * under memory pressure), the PTY exits and Cog auto-reconnects. Before this
 * module the reconnect launched a brand-new CLI, so the agent's whole
 * conversation was lost. Same on app restart: the roster respawned the team
 * with empty memory.
 *
 * Fix: Cog tracks ONE session identity per agent and reopens it on every
 * later launch. How that identity is obtained depends on the CLI:
 *
 *   pinnable   claude, openclaude, gemini, copilot, grok
 *              Cog generates a UUID up front and the CLI is told to use it
 *              (`--session-id`). Resume is `--resume <id>` (`--session-id`
 *              again for copilot, which resumes-or-creates).
 *   discovered codex, kimi
 *              No flag to choose the id. After Cog injects the initial prompt
 *              (which embeds the agent's name) it scans the CLI's session
 *              store for the transcript containing that prompt and records
 *              the id it finds. Resume is `codex resume <id>` /
 *              `kimi --session <id>`.
 *   directory  pi
 *              Sessions live in a per-agent `--session-dir`; resume is
 *              `--continue` (most recent session in that dir = this agent's).
 *
 * `config.sessionStarted` flips to true once the CLI has definitely written
 * a session (initial prompt injected, or id discovered), so a reconnect never
 * tries to resume something that was never created.
 */

export type SessionStrategy = 'pinnable' | 'discovered' | 'directory' | 'none'

export function sessionStrategyFor(cli: string): SessionStrategy {
  switch (cli) {
    case 'claude':
    case 'openclaude':
    case 'gemini':
    case 'copilot':
    case 'grok':
      return 'pinnable'
    case 'codex':
    case 'kimi':
      return 'discovered'
    case 'pi':
      return 'directory'
    default:
      return 'none'
  }
}

/** What cli-launch needs to know to attach a launch to a session. */
export type SessionLaunch =
  | { kind: 'id'; id: string; resume: boolean }
  | { kind: 'dir'; dir: string; resume: boolean }

// Ids Cog generates are UUIDs (every pinnable CLI requires that shape). Ids we
// discover from codex/kimi stores are whatever the CLI wrote; accept a strict
// shell-safe charset so a value can never smuggle metacharacters into the
// launch command.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{4,128}$/

export function isUuidSessionId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isShellSafeSessionId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID_PATTERN.test(value)
}

export interface SessionStoreOptions {
  /** Home directory root (default os.homedir()). Injectable for tests. */
  homeDir?: string
  /** Process env to honour store overrides like KIMI_CODE_HOME. */
  env?: NodeJS.ProcessEnv
}

function homeOf(opts?: SessionStoreOptions): string {
  return opts?.homeDir ?? os.homedir()
}

function safeReaddir(dir: string): string[] {
  try { return readdirSync(dir) } catch { return [] }
}

function isDir(p: string): boolean {
  try { return statSync(p).isDirectory() } catch { return false }
}

function mtimeMs(p: string): number {
  try { return statSync(p).mtimeMs } catch { return 0 }
}

/** Depth-limited recursive file walk. Never throws. */
function walkFiles(root: string, maxDepth: number, out: string[] = [], depth = 0): string[] {
  if (depth > maxDepth) return out
  for (const name of safeReaddir(root)) {
    const full = path.join(root, name)
    if (isDir(full)) walkFiles(full, maxDepth, out, depth + 1)
    else out.push(full)
  }
  return out
}

function kimiSessionRoots(home: string, env: NodeJS.ProcessEnv): string[] {
  return [
    env.KIMI_CODE_HOME ? path.join(env.KIMI_CODE_HOME, 'sessions') : null,
    path.join(home, '.kimi-code', 'sessions'),
    path.join(home, '.kimi', 'sessions')
  ].filter((r): r is string => !!r)
}

/**
 * Does the CLI have a session on disk for `id`?
 *   true      → found
 *   false     → store is known and the session is definitely not there
 *   'unknown' → store layout for this CLI is not something we can verify
 * Callers treat only `false` as "do not resume".
 */
export function sessionExists(cli: string, id: string, opts?: SessionStoreOptions): boolean | 'unknown' {
  if (!isShellSafeSessionId(id)) return false
  const home = homeOf(opts)
  const env = opts?.env ?? process.env
  switch (cli) {
    case 'claude':
    case 'openclaude': {
      // ~/.claude/projects/<encoded-cwd>/<id>.jsonl — the cwd encoding is an
      // internal detail, so scan every project folder for the file name.
      const roots = cli === 'claude'
        ? [path.join(home, '.claude', 'projects')]
        : [path.join(home, '.openclaude', 'projects'), path.join(home, '.claude', 'projects')]
      let sawStore = false
      for (const root of roots) {
        const projects = safeReaddir(root)
        if (projects.length) sawStore = true
        for (const p of projects) {
          if (existsSync(path.join(root, p, `${id}.jsonl`))) return true
        }
      }
      // openclaude's store location is not documented; without evidence of a
      // store at all, don't veto the resume.
      if (cli === 'openclaude' && !sawStore) return 'unknown'
      return false
    }
    case 'copilot':
      // ~/.copilot/session-state/<id>/
      return isDir(path.join(home, '.copilot', 'session-state', id))
    case 'grok': {
      // ~/.grok/sessions/<encoded-cwd>/<id>/
      const root = path.join(home, '.grok', 'sessions')
      for (const cwdKey of safeReaddir(root)) {
        if (isDir(path.join(root, cwdKey, id))) return true
      }
      return false
    }
    case 'codex': {
      // ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<id>.jsonl (sometimes under
      // extra sub-folders). Match on the file-name suffix.
      const root = path.join(home, '.codex', 'sessions')
      const suffix = `-${id}.jsonl`
      return walkFiles(root, 8).some(f => path.basename(f).endsWith(suffix))
    }
    case 'kimi': {
      // $KIMI_CODE_HOME/sessions/<workDirKey>/<id>/ (default ~/.kimi-code;
      // older builds used ~/.kimi).
      for (const root of kimiSessionRoots(home, env)) {
        for (const wd of safeReaddir(root)) {
          if (isDir(path.join(root, wd, id))) return true
        }
      }
      return false
    }
    case 'gemini': {
      // ~/.gemini/tmp/<project>/chats/** — file naming changed across
      // versions; a positive match is proof, a miss is not.
      const root = path.join(home, '.gemini', 'tmp')
      for (const project of safeReaddir(root)) {
        const chats = path.join(root, project, 'chats')
        if (walkFiles(chats, 3).some(f => f.includes(id))) return true
      }
      return 'unknown'
    }
    default:
      return 'unknown'
  }
}

/** Pi: a per-agent session dir counts as resumable once it holds any file. */
export function sessionDirHasSessions(dir: string): boolean {
  return walkFiles(dir, 3).length > 0
}

// ── Discovery (codex, kimi) ─────────────────────────────────────────────────

/**
 * The strings Cog's initial prompt leaves in a transcript. The prompt starts
 * with `You are "<name>" (role: …` and transcripts are JSON, so the quotes
 * may be stored escaped. Match either form.
 */
export function sessionMarkersFor(agentName: string): string[] {
  const raw = `You are "${agentName}" (role:`
  const escaped = `You are ${JSON.stringify(`"${agentName}"`).slice(1, -1)} (role:`
  return raw === escaped ? [raw] : [raw, escaped]
}

const MARKER_SCAN_BYTES = 256 * 1024

function fileContainsAny(file: string, needles: string[]): boolean {
  let fd: number | null = null
  try {
    fd = openSync(file, 'r')
    const buf = Buffer.alloc(MARKER_SCAN_BYTES)
    const n = readSync(fd, buf, 0, MARKER_SCAN_BYTES, 0)
    const text = buf.subarray(0, n).toString('utf8')
    return needles.some(s => text.includes(s))
  } catch {
    return false
  } finally {
    if (fd !== null) { try { closeSync(fd) } catch { /* noop */ } }
  }
}

export interface DiscoverOptions extends SessionStoreOptions {
  /** Only consider transcripts modified at/after this time (epoch ms). */
  since: number
}

const CODEX_ROLLOUT_ID = /-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.jsonl$/

/**
 * Find the session id the CLI assigned to the agent whose initial prompt
 * carries `agentName`. Returns null when nothing matches yet (the CLI may not
 * have flushed the transcript — callers poll a few times).
 */
export function discoverSessionId(cli: string, agentName: string, opts: DiscoverOptions): string | null {
  const home = homeOf(opts)
  const env = opts.env ?? process.env
  const markers = sessionMarkersFor(agentName)
  const since = opts.since - 5_000 // clock slop

  if (cli === 'codex') {
    const root = path.join(home, '.codex', 'sessions')
    const candidates = walkFiles(root, 8)
      .filter(f => /^rollout-.*\.jsonl$/.test(path.basename(f)) && mtimeMs(f) >= since)
      .sort((a, b) => mtimeMs(b) - mtimeMs(a))
    for (const f of candidates) {
      if (!fileContainsAny(f, markers)) continue
      const m = CODEX_ROLLOUT_ID.exec(path.basename(f))
      if (m && isShellSafeSessionId(m[1])) return m[1]
    }
    return null
  }

  if (cli === 'kimi') {
    for (const root of kimiSessionRoots(home, env)) {
      for (const wd of safeReaddir(root)) {
        const wdDir = path.join(root, wd)
        for (const sid of safeReaddir(wdDir)) {
          const sessionDir = path.join(wdDir, sid)
          if (!isDir(sessionDir) || !isShellSafeSessionId(sid)) continue
          const files = walkFiles(sessionDir, 3).filter(f => /\.jsonl?$/.test(f) && mtimeMs(f) >= since)
          if (!files.some(f => fileContainsAny(f, markers))) continue
          // Prefer the id the CLI wrote in state.json when it has one.
          try {
            const state = JSON.parse(readFileSync(path.join(sessionDir, 'state.json'), 'utf8'))
            const stated = state?.session_id ?? state?.id
            if (isShellSafeSessionId(stated)) return stated
          } catch { /* fall back to the directory name */ }
          return sid
        }
      }
    }
    return null
  }

  return null
}
