import { describe, it, expect } from 'vitest'
import { crosshairPoints, rulerStep, rulerTicks, visibleRange } from './ruler'

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

describe('crosshairPoints', () => {
  it('uses stride 1 when every major intersection fits', () => {
    const r = visibleRange(0.9, { x: 0, y: 0 }, 900, 450)
    const pts = crosshairPoints(r)
    expect(pts.length).toBe(9 * 5)
    expect(pts[1].x - pts[0].x).toBe(120)
  })

  it('spreads over the whole viewport when thinned at zoom 0.2', () => {
    const r = visibleRange(0.2, { x: 0, y: 0 }, 1920, 1080)
    const pts = crosshairPoints(r)
    expect(pts.length).toBeGreaterThan(0)
    expect(pts.length).toBeLessThanOrEqual(60)
    const ys = pts.map(p => p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(0.75 * (r.y1 - r.y0))
  })
})
