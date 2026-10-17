import { describe, it, expect } from 'vitest'
import { AgentRegistry } from './agent-registry'
import type { AgentConfig } from '../../shared/types'

const base: AgentConfig = {
  id: 'a1', name: 'A', cli: 'claude', cwd: 'C:/tmp', role: 'worker',
  ceoNotes: '', shell: 'powershell', admin: false, autoMode: true
}

describe('AgentRegistry sleep state', () => {
  it('registers a sleeping config with status sleeping and keeps it healthy without heartbeats', () => {
    const r = new AgentRegistry()
    r.register({ ...base, name: 'B', sleeping: true, sleptAt: '2026-10-13T00:00:00.000Z' })
    expect(r.get('B')).toMatchObject({ status: 'sleeping', sleptAt: '2026-10-13T00:00:00.000Z' })
    r.recordHeartbeat('B')
    expect(r.isHealthy('B', -1)).toBe(true)
  })
  it('markSleeping / markWaking flip status and emit', () => {
    const r = new AgentRegistry(); r.register({ ...base, name: 'B' })
    const seen: string[] = []; r.on('status', (e) => seen.push(e.status))
    r.markSleeping('B', '2026-10-13T00:00:00.000Z'); r.markWaking('B')
    expect(seen).toEqual(['sleeping', 'waking'])
    expect(r.get('B')?.sleptAt).toBe('2026-10-13T00:00:00.000Z')
  })
  it('ignores updateStatus while sleeping, so late PTY output cannot hide a sleeper from routing', () => {
    const r = new AgentRegistry(); r.register({ ...base, name: 'B' })
    const seen: string[] = []; r.on('status', (e) => seen.push(e.status))
    r.markSleeping('B', '2026-10-13T00:00:00.000Z')
    r.updateStatus('B', 'working'); r.updateStatus('B', 'disconnected')
    expect(r.get('B')?.status).toBe('sleeping')
    expect(seen).toEqual(['sleeping'])
    r.markWaking('B')
    expect(r.get('B')?.status).toBe('waking')
  })
  it('copies spawnAsleep, neverSleep and worktree fields onto the state', () => {
    const r = new AgentRegistry()
    r.register({ ...base, name: 'B', spawnAsleep: true, neverSleep: true, worktree: true, worktreePath: 'W', projectRoot: 'P', workDir: 'D' })
    expect(r.get('B')).toMatchObject({ spawnAsleep: true, neverSleep: true, worktree: true, worktreePath: 'W', projectRoot: 'P', workDir: 'D' })
  })
  it('an awake re-register clears sleeping and sleptAt left by an earlier sleep', () => {
    const r = new AgentRegistry()
    r.register({ ...base, name: 'B', sleeping: true, sleptAt: '2026-10-13T00:00:00.000Z' })
    r.markWaking('B')
    r.register({ ...base, name: 'B' }) // the woken agent, config has sleeping/sleptAt unset
    const s = r.get('B')
    expect(s?.status).toBe('idle')
    expect(s?.sleptAt).toBeUndefined()
    expect(s?.sleeping).toBeUndefined()
  })
})
