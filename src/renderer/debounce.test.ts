import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce } from './debounce'

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls once with the last args after ms', () => {
    const fn = vi.fn()
    const d = debounce(fn, 150)
    d(1); d(2); d(3)
    vi.advanceTimersByTime(149)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3)
  })

  it('cancel prevents the pending call', () => {
    const fn = vi.fn()
    const d = debounce(fn, 150)
    d(1)
    d.cancel()
    vi.advanceTimersByTime(500)
    expect(fn).not.toHaveBeenCalled()
  })
})
