import { describe, it, expect } from 'vitest'
import { fitViewport, clientToCanvas, headerScale, clampZoom, FIT_INSETS, MIN_ZOOM, MAX_ZOOM } from './canvas-math'
import type { Bounds } from './window-layout'

describe('fitViewport', () => {
  it('returns null when there are no windows to frame', () => {
    expect(fitViewport([], 1000, 800)).toBeNull()
  })

  it('centres a single window in the area left by the insets, at zoom 1 when it fits', () => {
    const win: Bounds = { x: 5000, y: 3000, width: 600, height: 400 }
    const vp = fitViewport([win], 1000, 800)!
    expect(vp.zoom).toBe(1)
    // default insets 64/64/180/64: free area x 64..936, y 64..620 -> centre (500, 342)
    expect(vp.panX).toBe(500 - 5300)
    expect(vp.panY).toBe(342 - 3200)
  })

  it('takes explicit insets (zero insets centre on the whole viewport)', () => {
    const win: Bounds = { x: 5000, y: 3000, width: 600, height: 400 }
    const vp = fitViewport([win], 1000, 800, { top: 0, right: 0, bottom: 0, left: 0 })!
    expect(vp.panX).toBe(500 - 5300)
    expect(vp.panY).toBe(400 - 3200)
  })

  it('keeps the framed windows clear of the margins and the bottom band', () => {
    const wins: Bounds[] = [
      { x: 0, y: 0, width: 900, height: 500 },
      { x: 1000, y: 600, width: 900, height: 500 }
    ]
    const vw = 1440
    const vh = 900
    const vp = fitViewport(wins, vw, vh)!
    for (const w of wins) {
      expect(w.x * vp.zoom + vp.panX).toBeGreaterThanOrEqual(FIT_INSETS.left - 1e-9)
      expect((w.x + w.width) * vp.zoom + vp.panX).toBeLessThanOrEqual(vw - FIT_INSETS.right + 1e-9)
      expect(w.y * vp.zoom + vp.panY).toBeGreaterThanOrEqual(FIT_INSETS.top - 1e-9)
      expect((w.y + w.height) * vp.zoom + vp.panY).toBeLessThanOrEqual(vh - FIT_INSETS.bottom + 1e-9)
    }
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

describe('headerScale', () => {
  it('is 1 at and above zoom 0.75', () => {
    expect(headerScale(0.75)).toBe(1)
    expect(headerScale(1)).toBe(1)
    expect(headerScale(2)).toBe(1)
  })

  it('keeps the on-screen size it has at 0.75 below that', () => {
    expect(headerScale(0.5)).toBeCloseTo(1.5)
    expect(headerScale(0.25)).toBeCloseTo(3)
  })

  it('is capped at 1 / 0.3', () => {
    expect(headerScale(0.1)).toBeCloseTo(1 / 0.3)
    expect(headerScale(0.2)).toBeCloseTo(1 / 0.3)
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

describe('clampZoom', () => {
  it('passes a zoom inside the range through', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(0.8)).toBe(0.8)
  })
  it('keeps the range ends', () => {
    expect(clampZoom(MIN_ZOOM)).toBe(MIN_ZOOM)
    expect(clampZoom(MAX_ZOOM)).toBe(MAX_ZOOM)
  })
  it('clamps below the floor and above the ceiling', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(-3)).toBe(MIN_ZOOM)
    expect(clampZoom(10)).toBe(MAX_ZOOM)
  })
})
