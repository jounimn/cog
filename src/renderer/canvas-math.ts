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

/**
 * Room "fit" keeps clear around the framed windows, in screen px: a 64px margin on
 * each side, and a 180px band at the bottom for the zoom bar and the minimap.
 */
export interface Insets { top: number; right: number; bottom: number; left: number }
export const FIT_INSETS: Insets = { top: 64, right: 64, bottom: 180, left: 64 }

/** Below this zoom the plate header stops shrinking on screen. */
export const HEADER_ZOOM_FLOOR = 0.75
const HEADER_SCALE_MAX = 1 / 0.3

/**
 * Counter-scale for plate headers so they stay readable when zoomed out: 1 at or
 * above 0.75, otherwise 0.75 / zoom (the on-screen size it has at 0.75), capped.
 */
export function headerScale(zoom: number): number {
  if (!(zoom > 0) || zoom >= HEADER_ZOOM_FLOOR) return 1
  return Math.min(HEADER_ZOOM_FLOOR / zoom, HEADER_SCALE_MAX)
}

export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

export function clampZoom(level: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level))
}

/**
 * Viewport that frames every window in `windows` inside the given viewport minus
 * `insets` (screen px), centred in what is left. Zooms out as far as needed but
 * never in past 1:1 — a lone window should be readable, not blown up. Null when
 * there is nothing to frame.
 */
export function fitViewport(
  windows: Bounds[],
  viewportWidth: number,
  viewportHeight: number,
  insets: Insets = FIT_INSETS
): Viewport | null {
  if (windows.length === 0) return null

  const minX = Math.min(...windows.map(w => w.x))
  const minY = Math.min(...windows.map(w => w.y))
  const maxX = Math.max(...windows.map(w => w.x + w.width))
  const maxY = Math.max(...windows.map(w => w.y + w.height))

  const availW = Math.max(1, viewportWidth - insets.left - insets.right)
  const availH = Math.max(1, viewportHeight - insets.top - insets.bottom)

  const zoom = clampZoom(Math.min(
    1,
    availW / Math.max(1, maxX - minX),
    availH / Math.max(1, maxY - minY)
  ))

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return {
    zoom,
    panX: insets.left + availW / 2 - centerX * zoom,
    panY: insets.top + availH / 2 - centerY * zoom
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
