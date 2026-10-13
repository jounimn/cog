/**
 * Pure canvas geometry shared by the window manager and the Workspace view.
 *
 * The canvas is a <div> transformed by `translate(panX, panY) scale(zoom)`, so
 * a canvas point c lands on the viewport at `c * zoom + pan`. Everything here
 * is the inverse/forward of that one formula.
 */
import type { Bounds } from './window-layout'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 2.0
const FIT_PADDING = 60

export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

export function clampZoom(level: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level))
}

/**
 * Viewport that frames every window in `windows` inside a viewport of the given
 * size, centred, with a little padding. Zooms out as far as needed but never in
 * past 1:1 — a lone window should be readable, not blown up. Null when there is
 * nothing to frame.
 */
export function fitViewport(windows: Bounds[], viewportWidth: number, viewportHeight: number): Viewport | null {
  if (windows.length === 0) return null

  const minX = Math.min(...windows.map(w => w.x))
  const minY = Math.min(...windows.map(w => w.y))
  const maxX = Math.max(...windows.map(w => w.x + w.width))
  const maxY = Math.max(...windows.map(w => w.y + w.height))

  const zoom = clampZoom(Math.min(
    1,
    viewportWidth / (maxX - minX + FIT_PADDING),
    viewportHeight / (maxY - minY + FIT_PADDING)
  ))

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return {
    zoom,
    panX: viewportWidth / 2 - centerX * zoom,
    panY: viewportHeight / 2 - centerY * zoom
  }
}

/**
 * Screen (client) coordinates → canvas coordinates, given where the viewport
 * element sits on screen and the current pan/zoom.
 */
export function clientToCanvas(
  clientX: number,
  clientY: number,
  viewportRect: { left: number; top: number },
  pan: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  return {
    x: (clientX - viewportRect.left - pan.x) / zoom,
    y: (clientY - viewportRect.top - pan.y) / zoom
  }
}
