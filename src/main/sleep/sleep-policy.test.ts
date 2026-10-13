import { describe, it, expect } from 'vitest'
import { pickAgentsToSleep, canSleep, type SleepCandidate, type SleepPolicyInput } from './sleep-policy'

const NOW = 10_000_000_000
const MIN = 60_000

function agent(over: Partial<SleepCandidate> = {}): SleepCandidate {
  return {
    id: 'a1', name: 'alpha', role: 'worker', cli: 'claude',
    status: 'idle', idleSince: NOW - 20 * MIN,
    sessionStarted: true, neverSleep: false, ...over
  }
}

function input(over: Partial<SleepPolicyInput> = {}): SleepPolicyInput {
  return {
    agents: [agent()], now: NOW,
    settings: { enabled: true, sleepAfterMinutes: 10, memoryFloorMb: 1500 },
    freeMemMb: 8000, lowMemStreak: 0,
    pendingNudgeNames: new Set(), inProgressTaskAgents: new Set(), promptNotInjectedIds: new Set(),
    lastMemoryNoteAt: null, ...over
  }
}

describe('pickAgentsToSleep', () => {
  it('sleeps an agent idle longer than sleepAfterMinutes with reason idle', () => {
    expect(pickAgentsToSleep(input()).sleep).toEqual([{ id: 'a1', reason: 'idle' }])
  })

  it('does not sleep an agent idle shorter than sleepAfterMinutes', () => {
    const d = pickAgentsToSleep(input({ agents: [agent({ idleSince: NOW - 5 * MIN })] }))
    expect(d.sleep).toEqual([])
  })

  it('switches the idle rule off with sleepAfterMinutes 0', () => {
    const d = pickAgentsToSleep(input({ settings: { enabled: true, sleepAfterMinutes: 0, memoryFloorMb: 1500 } }))
    expect(d.sleep).toEqual([])
  })

  it('returns an empty decision when disabled', () => {
    const d = pickAgentsToSleep(input({
      settings: { enabled: false, sleepAfterMinutes: 10, memoryFloorMb: 1500 },
      freeMemMb: 100, lowMemStreak: 5
    }))
    expect(d).toEqual({ sleep: [], lowMemStreak: 0, memoryNote: false })
  })

  it('defers an agent with a pending nudge', () => {
    expect(pickAgentsToSleep(input({ pendingNudgeNames: new Set(['alpha']) })).sleep).toEqual([])
  })

  it('defers an agent with an in-progress task', () => {
    expect(pickAgentsToSleep(input({ inProgressTaskAgents: new Set(['alpha']) })).sleep).toEqual([])
  })

  it('defers an agent whose prompt was not injected yet', () => {
    expect(pickAgentsToSleep(input({ promptNotInjectedIds: new Set(['a1']) })).sleep).toEqual([])
  })

  it('excludes terminal agents', () => {
    expect(pickAgentsToSleep(input({ agents: [agent({ cli: 'terminal' })] })).sleep).toEqual([])
  })

  it('excludes neverSleep agents', () => {
    expect(pickAgentsToSleep(input({ agents: [agent({ neverSleep: true })] })).sleep).toEqual([])
  })

  it('excludes agents without a started session', () => {
    expect(pickAgentsToSleep(input({ agents: [agent({ sessionStarted: false })] })).sleep).toEqual([])
  })

  it('excludes orchestrators from automatic sleep', () => {
    expect(pickAgentsToSleep(input({ agents: [agent({ role: 'orchestrator' })] })).sleep).toEqual([])
  })

  it('counts a first low-memory tick without sleeping', () => {
    const d = pickAgentsToSleep(input({
      agents: [agent({ idleSince: NOW - 2 * MIN })], freeMemMb: 1000, lowMemStreak: 0
    }))
    expect(d.sleep).toEqual([])
    expect(d.lowMemStreak).toBe(1)
  })

  it('sleeps exactly the longest-idle agent on the second low-memory tick', () => {
    const d = pickAgentsToSleep(input({
      agents: [
        agent({ id: 'a1', name: 'one', idleSince: NOW - 3 * MIN }),
        agent({ id: 'a2', name: 'two', idleSince: NOW - 9 * MIN }),
        agent({ id: 'a3', name: 'three', idleSince: NOW - 5 * MIN })
      ],
      freeMemMb: 1000, lowMemStreak: 1
    }))
    expect(d.sleep).toEqual([{ id: 'a2', reason: 'memory' }])
    expect(d.lowMemStreak).toBe(2)
  })

  it('never picks working or active agents for memory', () => {
    const d = pickAgentsToSleep(input({
      agents: [
        agent({ id: 'w', name: 'w', status: 'working', idleSince: null }),
        agent({ id: 'c', name: 'c', status: 'active', idleSince: null })
      ],
      freeMemMb: 1000, lowMemStreak: 1
    }))
    expect(d.sleep).toEqual([])
  })

  it('resets the streak when memory is fine', () => {
    expect(pickAgentsToSleep(input({ freeMemMb: 8000, lowMemStreak: 4 })).lowMemStreak).toBe(0)
  })

  it('raises memoryNote when low memory has no candidate and no prior note', () => {
    const d = pickAgentsToSleep(input({ agents: [], freeMemMb: 1000, lowMemStreak: 1, lastMemoryNoteAt: null }))
    expect(d.memoryNote).toBe(true)
  })

  it('suppresses memoryNote within 10 minutes of the last one', () => {
    const d = pickAgentsToSleep(input({ agents: [], freeMemMb: 1000, lowMemStreak: 1, lastMemoryNoteAt: NOW - 5 * MIN }))
    expect(d.memoryNote).toBe(false)
  })

  it('switches the memory rule off with memoryFloorMb 0', () => {
    const d = pickAgentsToSleep(input({
      agents: [agent({ idleSince: NOW - 2 * MIN })],
      settings: { enabled: true, sleepAfterMinutes: 10, memoryFloorMb: 0 },
      freeMemMb: 10, lowMemStreak: 3
    }))
    expect(d).toEqual({ sleep: [], lowMemStreak: 0, memoryNote: false })
  })

  it('does not pick an agent twice when the idle rule already took it', () => {
    const d = pickAgentsToSleep(input({
      agents: [
        agent({ id: 'a1', name: 'one', idleSince: NOW - 20 * MIN }),
        agent({ id: 'a2', name: 'two', idleSince: NOW - 2 * MIN })
      ],
      freeMemMb: 1000, lowMemStreak: 1
    }))
    expect(d.sleep).toEqual([{ id: 'a1', reason: 'idle' }, { id: 'a2', reason: 'memory' }])
  })
})

describe('canSleep', () => {
  it('allows orchestrators for manual sleep but not automatic', () => {
    const a = { cli: 'claude', role: 'orchestrator', sessionStarted: true, neverSleep: false }
    expect(canSleep(a, false)).toBe(true)
    expect(canSleep(a, true)).toBe(false)
  })
})
