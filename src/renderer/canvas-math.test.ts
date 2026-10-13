import { describe, it, expect } from 'vitest'
import { fitViewport, clientToCanvas } from './canvas-math'
import type { Bounds } from './window-layout'

describe('fitViewport', () => {
  it('returns null when there are no windows to frame', () => {
    expect(fitViewport([], 1000, 800)).toBeNull()
  })

  it('centres a single window in the viewport at zoom 1 when it fits', () => {
    const win: Bounds = { x: 5000, y: 3000, width: 600, height: 400 }
    const vp = fitViewport([win], 1000, 800)!
    expect(vp.zoom).toBe(1)
    // window centre (5300, 3200) must land on the viewport centre (500, 400)
    expect(vp.panX).toBe(500 - 5300)
    expect(vp.panY).toBe(400 - 3200)
  })

  it('zooms out so a wide row of windows fits inside the viewport', () => {
    const wins: Bounds[] = [
      { x: 0, y: 0, width: 600, height: 400 },
      { x: 620, y: 0, width: 600, height: 400 },
      { x: 1240, y: 0, width: 600, height: 400 }
    ]
    const vp = fitViewport(wins, 1000, 800)!
    expect(vp.zoom).toBeLessThan(1)
    // every window edge ends up on screen
    for (const w of wins) {
      const left = w.x * vp.zoom + vp.panX
      const right = (w.x + w.width) * vp.zoom + vp.panX
      expect(left).toBeGreaterThanOrEqual(0)
      expect(right).toBeLessThanOrEqual(1000)
    }
  })

  it('never zooms in past 1:1 and never out past the canvas minimum', () => {
    const tiny: Bounds = { x: 0, y: 0, width: 10, height: 10 }
    expect(fitViewport([tiny], 1000, 800)!.zoom).toBe(1)
    const huge: Bounds = { x: 0, y: 0, width: 100000, height: 100000 }
    expect(fitViewport([huge], 1000, 800)!.zoom).toBe(0.25)
  })
})

describe('clientToCanvas', () => {
  it('is the identity when the canvas is untransformed', () => {
    const rect = { left: 0, top: 0 }
    expect(clientToCanvas(120, 80, rect, { x: 0, y: 0 }, 1)).toEqual({ x: 120, y: 80 })
  })

  it('undoes the viewport offset, pan and zoom', () => {
    // viewport starts at (10, 44) on screen; canvas panned by (100, 50) at zoom 2
    const rect = { left: 10, top: 44 }
    const p = clientToCanvas(10 + 100 + 2 * 30, 44 + 50 + 2 * 20, rect, { x: 100, y: 50 }, 2)
    expect(p).toEqual({ x: 30, y: 20 })
  })
})
