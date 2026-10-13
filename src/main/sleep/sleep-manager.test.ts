import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SleepManager, type SleepManagerDeps } from './sleep-manager'
import type { SleepCandidate } from './sleep-policy'

function cand(over: Partial<SleepCandidate> = {}): SleepCandidate {
  return {
    id: 'a1', name: 'alice', role: 'worker', cli: 'claude', status: 'idle',
    idleSince: null, sessionStarted: true, neverSleep: false, ...over
  }
}

function makeDeps(over: Partial<SleepManagerDeps> = {}) {
  const deps: SleepManagerDeps & { sleep: ReturnType<typeof vi.fn>; postMemoryNote: ReturnType<typeof vi.fn> } = {
    settings: () => ({ enabled: true, sleepAfterMinutes: 10, memoryFloorMb: 1500 }),
    candidates: () => [],
    pendingNudgeNames: () => new Set(),
    inProgressTaskAgents: () => new Set(),
    promptNotInjectedIds: () => new Set(),
    freeMemMb: () => 8000,
    sleep: vi.fn(),
    postMemoryNote: vi.fn(),
    ...over
  } as never
  return deps
}

describe('SleepManager', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000) })
  afterEach(() => { vi.useRealTimers() })

  it('noteStatus idle sets idleSince once; working clears it', () => {
    const m = new SleepManager(makeDeps())
    m.noteStatus('a1', 'idle')
    expect(m.idleSince('a1')).toBe(1_000_000)
    vi.setSystemTime(1_005_000)
    m.noteStatus('a1', 'idle')
    expect(m.idleSince('a1')).toBe(1_000_000)
    m.noteStatus('a1', 'working')
    expect(m.idleSince('a1')).toBeNull()
    m.noteStatus('a1', 'idle')
    m.noteStatus('a1', 'sleeping')
    expect(m.idleSince('a1')).toBeNull()
    m.noteStatus('a1', 'idle')
    m.noteStatus('a1', 'active')
    expect(m.idleSince('a1')).toBeNull()
  })

  it('tick sleeps agents the policy picks (idle timeout)', () => {
    const deps = makeDeps({
      candidates: () => [cand({ idleSince: m.idleSince('a1') })]
    })
    const m: SleepManager = new SleepManager(deps)
    m.noteStatus('a1', 'idle')
    vi.setSystemTime(1_000_000 + 11 * 60_000)
    m.tick()
    expect(deps.sleep).toHaveBeenCalledWith('a1', 'idle')
  })

  it('sleeps an agent noted idle once at spawn with no other transition', () => {
    const deps = makeDeps({ candidates: () => [cand({ idleSince: m.idleSince('a1') })] })
    const m: SleepManager = new SleepManager(deps)
    m.noteStatus('a1', 'idle')
    vi.setSystemTime(1_000_000 + 11 * 60_000)
    m.tick()
    expect(deps.sleep).toHaveBeenCalledWith('a1', 'idle')
  })

  it('does not sleep before the timeout', () => {
    const deps = makeDeps({ candidates: () => [cand({ idleSince: m.idleSince('a1') })] })
    const m: SleepManager = new SleepManager(deps)
    m.noteStatus('a1', 'idle')
    vi.setSystemTime(1_000_000 + 5 * 60_000)
    m.tick()
    expect(deps.sleep).not.toHaveBeenCalled()
  })

  it('carries lowMemStreak across ticks: two low ticks -> one memory sleep', () => {
    const deps = makeDeps({
      freeMemMb: () => 100,
      candidates: () => [cand({ idleSince: m.idleSince('a1') })]
    })
    const m: SleepManager = new SleepManager(deps)
    m.noteStatus('a1', 'idle')
    vi.setSystemTime(1_000_000 + 60_000)
    m.tick()
    expect(deps.sleep).not.toHaveBeenCalled()
    m.tick()
    expect(deps.sleep).toHaveBeenCalledTimes(1)
    expect(deps.sleep).toHaveBeenCalledWith('a1', 'memory')
  })

  it('posts the memory note at most once per 10 minutes', () => {
    const deps = makeDeps({
      freeMemMb: () => 100,
      candidates: () => [cand({ status: 'working' })]
    })
    const m = new SleepManager(deps)
    m.tick()
    expect(deps.postMemoryNote).not.toHaveBeenCalled()
    m.tick()
    expect(deps.postMemoryNote).toHaveBeenCalledTimes(1)
    vi.setSystemTime(1_000_000 + 5 * 60_000)
    m.tick()
    expect(deps.postMemoryNote).toHaveBeenCalledTimes(1)
    vi.setSystemTime(1_000_000 + 11 * 60_000)
    m.tick()
    expect(deps.postMemoryNote).toHaveBeenCalledTimes(2)
  })

  it('start ticks every 30s and stop stops', () => {
    const deps = makeDeps({ freeMemMb: vi.fn(() => 8000) })
    const m = new SleepManager(deps)
    m.start()
    vi.advanceTimersByTime(30_000)
    expect(deps.freeMemMb).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60_000)
    expect(deps.freeMemMb).toHaveBeenCalledTimes(3)
    m.stop()
    vi.advanceTimersByTime(120_000)
    expect(deps.freeMemMb).toHaveBeenCalledTimes(3)
  })
})
