import { existsSync, readdirSync } from 'fs'
import os from 'os'
import path from 'path'

/**
 * Claude Code session persistence helpers.
 *
 * Why: a Cog agent's terminal is a PTY running `powershell.exe` → `claude`.
 * When the shell or its console host dies underneath us (on Windows the in-box
 * ConPTY/conhost is known to crash under memory pressure — see the PR that
 * introduced this file), the PTY exits and Cog auto-reconnects. Before this
 * module the reconnect launched a brand-new `claude`, so the user's whole
 * conversation — the "precious session" — was lost along with the MCP link.
 *
 * Fix: every Claude agent gets a stable `sessionId` (UUID) persisted in its
 * config/roster. The first launch pins it with `--session-id`; any later
 * launch (crash reconnect, app-restart respawn) checks whether Claude already
 * wrote a transcript for that id and, if so, launches `--resume <id>` instead.
 */

// Claude's `--session-id` must be a UUID. Lowercase hex + dashes only, so the
// value is also shell-safe when spliced into the launch command.
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isClaudeSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value)
}

/**
 * True when Claude Code has a transcript on disk for `sessionId`, meaning
 * `claude --resume <sessionId>` will succeed. Claude stores transcripts at
 * `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`; the cwd encoding is
 * an internal detail, so we scan every project folder for the file name
 * instead of reproducing it. Best-effort: any FS error reads as "no session".
 */
export function claudeSessionExists(sessionId: string, homeDir: string = os.homedir()): boolean {
  if (!isClaudeSessionId(sessionId)) return false
  const projectsDir = path.join(homeDir, '.claude', 'projects')
  let projects: string[]
  try {
    projects = readdirSync(projectsDir)
  } catch {
    return false
  }
  const fileName = `${sessionId}.jsonl`
  for (const project of projects) {
    try {
      if (existsSync(path.join(projectsDir, project, fileName))) return true
    } catch {
      // unreadable project folder — keep looking
    }
  }
  return false
}
