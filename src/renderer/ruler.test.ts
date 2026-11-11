import { describe, it, expect } from 'vitest'
import { rulerStep, rulerTicks, visibleRange } from './ruler'

describe('rulerStep', () => {
  it('is 120 at zoom 1', () => expect(rulerStep(1)).toBe(120))
  it('doubles when zoomed out', () => expect(rulerStep(0.2)).toBe(480))
  it('subdivides when zoomed in', () => expect(rulerStep(2)).toBe(30))
})

describe('rulerTicks', () => {
  it('starts at the origin with px equal to coord', () => {
    const ticks = rulerTicks(1, 0, 1000)
    expect(ticks.map(t => t.coord)).toEqual([0, 120, 240, 360, 480, 600, 720, 840, 960])
    expect(ticks.every(t => t.px === t.coord)).toBe(true)
  })

  it('skips ticks scrolled off the start when panned', () => {
    expect(rulerTicks(1, -250, 1000)[0]).toEqual({ coord: 360, px: 110 })
  })

  it.each([0.2, 0.5, 1, 2])('stays sparse and legible at zoom %s', zoom => {
    const ticks = rulerTicks(zoom, 0, 1920)
    expect(ticks.length).toBeLessThanOrEqual(40)
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].px - ticks[i - 1].px).toBeGreaterThanOrEqual(60)
    }
  })
})

describe('visibleRange', () => {
  it('returns rounded world coordinates', () => {
    expect(visibleRange(0.9, { x: 0, y: 0 }, 900, 450)).toEqual({ x0: 0, x1: 1000, y0: 0, y1: 500 })
  })
})
