import { describe, it, expect } from 'vitest'
import type { AgentConfig } from '../../shared/types'
import { reconnectWorktreeNote, slugTakenBySleeper } from './sleep-state'

function row(over: Partial<AgentConfig>): AgentConfig {
  return {
    id: 'a1', name: 'Worker One', cli: 'claude', cwd: 'C:/proj', role: 'worker',
    ceoNotes: '', shell: 'powershell', admin: false, autoMode: false,
    projectRoot: 'C:/proj', ...over
  } as AgentConfig
}

describe('reconnectWorktreeNote', () => {
  it('is empty when the worktree was reused', () => {
    expect(reconnectWorktreeNote({ ok: true, reused: true })).toBe('')
  })

  it('warns that the worktree was recreated when not reused', () => {
    expect(reconnectWorktreeNote({ ok: true, reused: false })).toBe(
      ' Your worktree was recreated from branch cog/<slug>; uncommitted files from before you slept are gone.'
    )
  })

  it('is empty when there is no worktree', () => {
    expect(reconnectWorktreeNote({ ok: false })).toBe('')
  })
})

describe('slugTakenBySleeper', () => {
  it('is true for a sleeping row with the same slug in the same project', () => {
    const roster = [row({ id: 'a1', name: 'Worker One', sleeping: true })]
    expect(slugTakenBySleeper(roster, 'C:/proj', 'worker-one', 'b2')).toBe(true)
  })

  it('is false for an awake row', () => {
    const roster = [row({ id: 'a1', name: 'Worker One' })]
    expect(slugTakenBySleeper(roster, 'C:/proj', 'worker-one', 'b2')).toBe(false)
  })

  it('is false for a sleeper in another project', () => {
    const roster = [row({ id: 'a1', name: 'Worker One', sleeping: true, projectRoot: 'C:/other' })]
    expect(slugTakenBySleeper(roster, 'C:/proj', 'worker-one', 'b2')).toBe(false)
  })

  it('is false when the sleeper is the agent itself', () => {
    const roster = [row({ id: 'a1', name: 'Worker One', sleeping: true })]
    expect(slugTakenBySleeper(roster, 'C:/proj', 'worker-one', 'a1')).toBe(false)
  })

  it('compares project roots case- and separator-insensitively', () => {
    const roster = [row({ id: 'a1', name: 'Worker One', sleeping: true, projectRoot: 'c:\\PROJ\\' })]
    expect(slugTakenBySleeper(roster, 'C:/proj', 'worker-one', 'b2')).toBe(true)
  })
})
