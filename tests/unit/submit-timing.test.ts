import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { submitWhenQuiet } from '../../src/main/shell/submit-timing'

describe('submitWhenQuiet', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function rig(minMs = 500) {
    let lastOutputAt = Date.now()
    const submit = vi.fn()
    const cancel = submitWhenQuiet({ lastOutputAt: () => lastOutputAt, submit, minMs })
    return { submit, cancel, output: () => { lastOutputAt = Date.now() } }
  }

  it('submits once the minimum delay passed and the terminal is quiet', () => {
    const r = rig()
    vi.advanceTimersByTime(400)
    expect(r.submit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(r.submit).toHaveBeenCalledTimes(1)
  })

  it('waits while the TUI keeps rendering the paste, then submits once it goes quiet', () => {
    const r = rig()
    for (let t = 0; t < 2000; t += 100) { vi.advanceTimersByTime(100); r.output() }
    expect(r.submit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(r.submit).toHaveBeenCalledTimes(1)
  })

  it('submits at the deadline even if the terminal never goes quiet', () => {
    const r = rig()
    for (let t = 0; t < 7900; t += 100) { vi.advanceTimersByTime(100); r.output() }
    expect(r.submit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(r.submit).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(r.submit).toHaveBeenCalledTimes(1)
  })

  it('does nothing after cancel', () => {
    const r = rig()
    r.cancel()
    vi.advanceTimersByTime(10000)
    expect(r.submit).not.toHaveBeenCalled()
  })
})
