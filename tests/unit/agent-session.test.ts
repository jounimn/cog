import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'fs'
import os from 'os'
import path from 'path'
import {
  sessionStrategyFor,
  isUuidSessionId,
  isShellSafeSessionId,
  sessionExists,
  sessionDirHasSessions,
  sessionMarkersFor,
  discoverSessionId
} from '../../src/main/agent-session'

const SID = '7ae74d9a-3aa7-4d34-8ff0-20f3f548584e'
const OTHER = '11111111-2222-4333-8444-555555555555'

let home: string
beforeEach(() => { home = mkdtempSync(path.join(os.tmpdir(), 'cog-agent-session-')) })
afterEach(() => { rmSync(home, { recursive: true, force: true }) })

function touch(rel: string, content = '{}\n', mtime?: Date): string {
  const full = path.join(home, rel)
  mkdirSync(path.dirname(full), { recursive: true })
  writeFileSync(full, content)
  if (mtime) utimesSync(full, mtime, mtime)
  return full
}

describe('sessionStrategyFor', () => {
  it('classifies every supported CLI', () => {
    for (const cli of ['claude', 'openclaude', 'gemini', 'copilot', 'grok']) expect(sessionStrategyFor(cli)).toBe('pinnable')
    for (const cli of ['codex', 'kimi']) expect(sessionStrategyFor(cli)).toBe('discovered')
    expect(sessionStrategyFor('pi')).toBe('directory')
    expect(sessionStrategyFor('terminal')).toBe('none')
    expect(sessionStrategyFor('something-new')).toBe('none')
  })
})

describe('session id validation', () => {
  it('UUID shape for ids Cog generates', () => {
    expect(isUuidSessionId(SID)).toBe(true)
    expect(isUuidSessionId(SID.toUpperCase())).toBe(false)
    expect(isUuidSessionId('agent-1')).toBe(false)
  })
  it('shell-safe charset for ids read back from CLI stores', () => {
    expect(isShellSafeSessionId(SID)).toBe(true)
    expect(isShellSafeSessionId('abc123')).toBe(true)
    expect(isShellSafeSessionId(`${SID}; rm -rf /`)).toBe(false)
    expect(isShellSafeSessionId('a b')).toBe(false)
    expect(isShellSafeSessionId('')).toBe(false)
    expect(isShellSafeSessionId(undefined)).toBe(false)
  })
})

describe('sessionExists', () => {
  it('claude: transcript in any project folder', () => {
    expect(sessionExists('claude', SID, { homeDir: home })).toBe(false)
    touch(`.claude/projects/C--repo-b/${OTHER}.jsonl`)
    touch(`.claude/projects/C--repo-a/${SID}.jsonl`)
    expect(sessionExists('claude', SID, { homeDir: home })).toBe(true)
    expect(sessionExists('claude', '../../x', { homeDir: home })).toBe(false)
  })

  it('openclaude: unknown without any store, definite once a store exists', () => {
    expect(sessionExists('openclaude', SID, { homeDir: home })).toBe('unknown')
    touch(`.openclaude/projects/p/${OTHER}.jsonl`)
    expect(sessionExists('openclaude', SID, { homeDir: home })).toBe(false)
    touch(`.openclaude/projects/p/${SID}.jsonl`)
    expect(sessionExists('openclaude', SID, { homeDir: home })).toBe(true)
  })

  it('copilot: session-state/<id> directory', () => {
    expect(sessionExists('copilot', SID, { homeDir: home })).toBe(false)
    touch(`.copilot/session-state/${SID}/events.jsonl`)
    expect(sessionExists('copilot', SID, { homeDir: home })).toBe(true)
  })

  it('grok: sessions/<cwd-key>/<id> directory', () => {
    expect(sessionExists('grok', SID, { homeDir: home })).toBe(false)
    touch(`.grok/sessions/C%3A%5Crepo/${SID}/prompt_history.jsonl`)
    expect(sessionExists('grok', SID, { homeDir: home })).toBe(true)
  })

  it('codex: rollout file suffixed with the id, at any depth', () => {
    expect(sessionExists('codex', SID, { homeDir: home })).toBe(false)
    touch(`.codex/sessions/2026/10/09/rollout-2026-10-09T10-00-00-${SID}.jsonl`)
    expect(sessionExists('codex', SID, { homeDir: home })).toBe(true)
    touch(`.codex/sessions/ws/a1/b2/2026/10/09/rollout-2026-10-09T10-00-00-${OTHER}.jsonl`)
    expect(sessionExists('codex', OTHER, { homeDir: home })).toBe(true)
  })

  it('kimi: honours KIMI_CODE_HOME, then ~/.kimi-code, then ~/.kimi', () => {
    expect(sessionExists('kimi', 'abc123', { homeDir: home, env: {} })).toBe(false)
    touch(`.kimi/sessions/wd1/abc123/state.json`)
    expect(sessionExists('kimi', 'abc123', { homeDir: home, env: {} })).toBe(true)
    const custom = path.join(home, 'kimi-home')
    touch(`kimi-home/sessions/wd9/zzz999/state.json`)
    expect(sessionExists('kimi', 'zzz999', { homeDir: home, env: { KIMI_CODE_HOME: custom } })).toBe(true)
    expect(sessionExists('kimi', 'zzz999', { homeDir: home, env: {} })).toBe(false)
  })

  it('gemini: positive match is proof, a miss is unknown', () => {
    expect(sessionExists('gemini', SID, { homeDir: home })).toBe('unknown')
    touch(`.gemini/tmp/proj/chats/session-2026-10-09-${SID}.json`)
    expect(sessionExists('gemini', SID, { homeDir: home })).toBe(true)
  })

  it('rejects unsafe ids for every CLI before touching the filesystem', () => {
    for (const cli of ['claude', 'copilot', 'grok', 'codex', 'kimi', 'gemini']) {
      expect(sessionExists(cli, 'x; echo', { homeDir: home })).toBe(false)
    }
  })
})

describe('sessionDirHasSessions (pi)', () => {
  it('is false for a missing or empty dir and true once a file exists', () => {
    const dir = path.join(home, 'pi-sessions')
    expect(sessionDirHasSessions(dir)).toBe(false)
    mkdirSync(dir, { recursive: true })
    expect(sessionDirHasSessions(dir)).toBe(false)
    touch('pi-sessions/--repo--/2026-10-09_abc.jsonl')
    expect(sessionDirHasSessions(dir)).toBe(true)
  })
})

describe('sessionMarkersFor', () => {
  it('yields the raw prompt prefix and its JSON-escaped twin', () => {
    expect(sessionMarkersFor('worker-1')).toEqual([
      'You are "worker-1" (role:',
      'You are \\"worker-1\\" (role:'
    ])
  })
})

describe('discoverSessionId', () => {
  const old = new Date(Date.now() - 60 * 60 * 1000)
  const since = Date.now() - 30_000
  const prompt = (name: string) => JSON.stringify({ type: 'user', text: `You are "${name}" (role: worker) in a Cog workspace.` })

  it('codex: picks the rollout that carries this agent\'s prompt, not another agent\'s', () => {
    touch(`.codex/sessions/2026/10/09/rollout-a-${OTHER}.jsonl`, prompt('other-agent') + '\n')
    touch(`.codex/sessions/2026/10/09/rollout-b-${SID}.jsonl`, '{"type":"session_meta"}\n' + prompt('worker-1') + '\n')
    expect(discoverSessionId('codex', 'worker-1', { homeDir: home, since })).toBe(SID)
    expect(discoverSessionId('codex', 'nobody', { homeDir: home, since })).toBeNull()
  })

  it('codex: ignores transcripts older than the spawn', () => {
    touch(`.codex/sessions/2026/01/01/rollout-old-${SID}.jsonl`, prompt('worker-1') + '\n', old)
    expect(discoverSessionId('codex', 'worker-1', { homeDir: home, since })).toBeNull()
  })

  it('kimi: returns the session dir name (or state.json id) whose transcript carries the prompt', () => {
    touch(`.kimi-code/sessions/wd/sess-other/agents/main/wire.jsonl`, prompt('other-agent') + '\n')
    touch(`.kimi-code/sessions/wd/sess-mine/agents/main/wire.jsonl`, prompt('worker-1') + '\n')
    expect(discoverSessionId('kimi', 'worker-1', { homeDir: home, since, env: {} })).toBe('sess-mine')
    touch(`.kimi-code/sessions/wd/sess-mine/state.json`, JSON.stringify({ session_id: 'state-id-77' }))
    expect(discoverSessionId('kimi', 'worker-1', { homeDir: home, since, env: {} })).toBe('state-id-77')
  })

  it('returns null for CLIs without discovery', () => {
    expect(discoverSessionId('claude', 'worker-1', { homeDir: home, since })).toBeNull()
  })
})
