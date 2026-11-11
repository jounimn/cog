import { describe, it, expect } from 'vitest'
import { worldBounds, toMinimap, minimapClickToPan } from './minimap-math'

describe('worldBounds', () => {
  it('returns the view, finite, when there are no windows', () => {
    const view = { x0: 0, x1: 900, y0: 0, y1: 500 }
    const b = worldBounds([], view)
    expect(b).toEqual({ x: 0, y: 0, w: 900, h: 500 })
    expect(Object.values(b).every(Number.isFinite)).toBe(true)
  })

  it('unions the windows and the view, padded 40', () => {
    const wins = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 1000, y: 500, width: 100, height: 100 }
    ]
    expect(worldBounds(wins, { x0: 0, x1: 900, y0: 0, y1: 500 })).toEqual({ x: -40, y: -40, w: 1180, h: 680 })
  })
})

describe('toMinimap', () => {
  it('fits with letterboxing', () => {
    const m = toMinimap({ x: 0, y: 0, w: 1000, h: 500 }, 160, 112)
    expect(m.scale).toBeCloseTo(0.16)
    expect(m.ox).toBeCloseTo(0)
    expect(m.oy).toBeCloseTo(16)
  })
})

describe('minimapClickToPan', () => {
  it('centres the viewport on the clicked world point', () => {
    const m = toMinimap({ x: 0, y: 0, w: 1000, h: 500 }, 160, 112)
    const pan = minimapClickToPan({ x: 80, y: 56 }, m, 1, 900, 500)
    expect(pan.x).toBeCloseTo(-50)
    expect(pan.y).toBeCloseTo(0)
  })

  it('accounts for the bounds origin and zoom', () => {
    const m = toMinimap({ x: -100, y: -100, w: 1000, h: 500 }, 160, 112)
    // minimap (0,16) is world (-100,-100)
    const pan = minimapClickToPan({ x: 0, y: 16 }, m, 2, 800, 400)
    expect(pan.x).toBeCloseTo(400 + 200)
    expect(pan.y).toBeCloseTo(200 + 200)
  })
})
