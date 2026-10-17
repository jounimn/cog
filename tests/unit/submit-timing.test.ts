import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { submitUntilAccepted } from '../../src/main/shell/submit-timing'

describe('submitUntilAccepted', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function rig(minMs = 500) {
    let lastOutputAt = Date.now()
    let chunks = 0
    const submit = vi.fn()
    const onDone = vi.fn()
    const cancel = submitUntilAccepted({ lastOutputAt: () => lastOutputAt, outputChunks: () => chunks, submit, minMs, onDone })
    const output = () => { lastOutputAt = Date.now(); chunks++ }
    /** Stream like a CLI answering: a chunk every 100 ms for `ms`. */
    const stream = (ms: number) => { for (let t = 0; t < ms; t += 100) { vi.advanceTimersByTime(100); output() } }
    return { submit, onDone, cancel, output, stream }
  }

  it('sends the first Enter once the minimum delay passed and the terminal is quiet', () => {
    const r = rig()
    vi.advanceTimersByTime(400)
    expect(r.submit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(r.submit).toHaveBeenCalledTimes(1)
  })

  it('waits while the TUI keeps rendering the paste, then sends the first Enter once it goes quiet', () => {
    const r = rig()
    r.stream(2000)
    expect(r.submit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(r.submit).toHaveBeenCalledTimes(1)
  })

  it('sends the first Enter at the first deadline even if the terminal never goes quiet', () => {
    const r = rig()
    r.stream(7900)
    expect(r.submit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(r.submit).toHaveBeenCalledTimes(1)
  })

  it('stops after one Enter when the CLI streams a response', () => {
    const r = rig()
    vi.advanceTimersByTime(600)
    expect(r.submit).toHaveBeenCalledTimes(1)
    r.stream(3000)
    expect(r.onDone).toHaveBeenCalledWith(1)
    vi.advanceTimersByTime(20000)
    expect(r.submit).toHaveBeenCalledTimes(1)
  })

  it('presses Enter again every retry interval while the input stays unsent, and stops once a try gets through', () => {
    const r = rig()
    vi.advanceTimersByTime(600)
    expect(r.submit).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(r.submit).toHaveBeenCalledTimes(2)
    // a lone redraw burst is not a submission
    r.output(); vi.advanceTimersByTime(100); r.output()
    vi.advanceTimersByTime(5000)
    expect(r.submit).toHaveBeenCalledTimes(3)
    r.stream(3000)
    expect(r.onDone).toHaveBeenCalledWith(3)
    vi.advanceTimersByTime(30000)
    expect(r.submit).toHaveBeenCalledTimes(3)
  })

  it('gives up after the maximum number of tries', () => {
    const r = rig()
    vi.advanceTimersByTime(600 + 12 * 5000)
    expect(r.submit).toHaveBeenCalledTimes(12)
    expect(r.onDone).toHaveBeenCalledWith(null)
    vi.advanceTimersByTime(60000)
    expect(r.submit).toHaveBeenCalledTimes(12)
  })

  it('does nothing after cancel', () => {
    const r = rig()
    r.cancel()
    vi.advanceTimersByTime(60000)
    expect(r.submit).not.toHaveBeenCalled()
  })
})
