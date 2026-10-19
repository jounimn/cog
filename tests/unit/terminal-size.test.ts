import { describe, it, expect } from 'vitest'
import { TerminalSizes, DEFAULT_TERMINAL_SIZE, RESET_SCREEN } from '../../src/main/shell/terminal-size'

describe('TerminalSizes', () => {
  it('falls back to the historical 120x30 for an agent whose terminal never reported a size', () => {
    expect(new TerminalSizes().get('a1')).toEqual({ cols: 120, rows: 30 })
    expect(DEFAULT_TERMINAL_SIZE).toEqual({ cols: 120, rows: 30 })
  })

  it('returns the last size the renderer reported, per agent', () => {
    const sizes = new TerminalSizes()
    sizes.remember('a1', 64, 18)
    sizes.remember('a2', 200, 50)
    sizes.remember('a1', 70, 20)
    expect(sizes.get('a1')).toEqual({ cols: 70, rows: 20 })
    expect(sizes.get('a2')).toEqual({ cols: 200, rows: 50 })
  })

  it('ignores sizes a hidden or collapsed pane would report', () => {
    const sizes = new TerminalSizes()
    sizes.remember('a1', 64, 18)
    sizes.remember('a1', 0, 18)
    sizes.remember('a1', 64, -1)
    sizes.remember('a1', NaN, 18)
    sizes.remember('a1', 1.5, 18)
    expect(sizes.get('a1')).toEqual({ cols: 64, rows: 18 })
  })

  it('hands out a copy, not its own record', () => {
    const sizes = new TerminalSizes()
    sizes.remember('a1', 64, 18)
    const got = sizes.get('a1')
    got.cols = 1
    expect(sizes.get('a1')).toEqual({ cols: 64, rows: 18 })
  })

  it('forgets an agent whose terminal is gone', () => {
    const sizes = new TerminalSizes()
    sizes.remember('a1', 64, 18)
    sizes.forget('a1')
    expect(sizes.get('a1')).toEqual(DEFAULT_TERMINAL_SIZE)
  })
})

describe('RESET_SCREEN', () => {
  it('clears the screen and the scrollback and homes the cursor', () => {
    expect(RESET_SCREEN).toBe('\x1b[2J\x1b[3J\x1b[H')
  })
})
