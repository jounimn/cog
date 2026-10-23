// Runs against real better-sqlite3; under plain node the native module has the
// wrong ABI, so run it through Electron's node:
//   ELECTRON_RUN_AS_NODE=1 npx electron node_modules/vitest/vitest.mjs run tests/unit/agent-graveyard-store.test.ts
import { describe, it, expect } from 'vitest'
import { createDatabase } from '../../src/main/db/database'
import { AgentGraveyardStore, GRAVEYARD_MAX } from '../../src/main/db/agent-graveyard-store'
import type { AgentConfig } from '../../src/shared/types'

const cfg = (id: string, over: Partial<AgentConfig> = {}): AgentConfig => ({
  id,
  name: `agent-${id}`,
  cli: 'claude',
  cwd: 'C:\\repo',
  role: 'worker',
  ceoNotes: '',
  shell: 'powershell',
  admin: false,
  autoMode: false,
  sessionId: `sess-${id}`,
  sessionStarted: true,
  ...over
})

describe('AgentGraveyardStore', () => {
  it('keeps the killed config whole and lists newest first', () => {
    const g = new AgentGraveyardStore(createDatabase(':memory:'))
    g.save(cfg('a', { permissionMode: 'bypassPermissions' }), '2026-10-22T10:00:00.000Z')
    g.save(cfg('b'), '2026-10-22T11:00:00.000Z')
    const list = g.list()
    expect(list.map(k => k.config.id)).toEqual(['b', 'a'])
    expect(list[1].killedAt).toBe('2026-10-22T10:00:00.000Z')
    expect(list[1].config).toMatchObject({ sessionId: 'sess-a', sessionStarted: true, permissionMode: 'bypassPermissions' })
  })

  it('take() hands the config back once and removes it', () => {
    const g = new AgentGraveyardStore(createDatabase(':memory:'))
    g.save(cfg('a'))
    expect(g.take('a')?.name).toBe('agent-a')
    expect(g.take('a')).toBeNull()
    expect(g.list()).toEqual([])
  })

  it('forget() drops an entry; unknown ids are a no-op', () => {
    const g = new AgentGraveyardStore(createDatabase(':memory:'))
    g.save(cfg('a'))
    g.forget('nope')
    expect(g.list()).toHaveLength(1)
    g.forget('a')
    expect(g.list()).toEqual([])
  })

  it('killing the same agent twice keeps one entry with the latest time', () => {
    const g = new AgentGraveyardStore(createDatabase(':memory:'))
    g.save(cfg('a'), '2026-10-22T10:00:00.000Z')
    g.save(cfg('a', { name: 'renamed' }), '2026-10-22T12:00:00.000Z')
    expect(g.list()).toHaveLength(1)
    expect(g.list()[0]).toMatchObject({ killedAt: '2026-10-22T12:00:00.000Z', config: { name: 'renamed' } })
  })

  it('drops the oldest entries beyond the cap', () => {
    const g = new AgentGraveyardStore(createDatabase(':memory:'))
    for (let i = 0; i < GRAVEYARD_MAX + 5; i++) {
      g.save(cfg(String(i).padStart(3, '0')), `2026-10-22T10:${String(i).padStart(2, '0')}:00.000Z`)
    }
    const ids = g.list().map(k => k.config.id)
    expect(ids).toHaveLength(GRAVEYARD_MAX)
    expect(ids[0]).toBe(String(GRAVEYARD_MAX + 4).padStart(3, '0'))
    expect(ids).not.toContain('000')
    expect(ids).not.toContain('004')
    expect(ids).toContain('005')
  })
})
