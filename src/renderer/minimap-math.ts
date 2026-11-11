/** Minimap geometry. Screen px = world * zoom + pan (see ruler.ts). */

interface Box { x: number; y: number; width: number; height: number }
interface View { x0: number; x1: number; y0: number; y1: number }
export interface WorldRect { x: number; y: number; w: number; h: number }
/** minimap px = world * scale + (ox, oy); the bounds origin is folded into ox/oy. */
export interface MinimapMap { scale: number; ox: number; oy: number }

const PAD = 40

/** Union of the windows and the visible view, padded; just the view when there are no windows. */
export function worldBounds(wins: Box[], view: View): WorldRect {
  if (wins.length === 0) return { x: view.x0, y: view.y0, w: view.x1 - view.x0, h: view.y1 - view.y0 }
  let x0 = view.x0, x1 = view.x1, y0 = view.y0, y1 = view.y1
  for (const w of wins) {
    x0 = Math.min(x0, w.x)
    y0 = Math.min(y0, w.y)
    x1 = Math.max(x1, w.x + w.width)
    y1 = Math.max(y1, w.y + w.height)
  }
  return { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + 2 * PAD, h: y1 - y0 + 2 * PAD }
}

/** Fit bounds b into a boxW x boxH map, centred (letterboxed). */
export function toMinimap(b: WorldRect, boxW: number, boxH: number): MinimapMap {
  const scale = Math.min(boxW / Math.max(b.w, 1), boxH / Math.max(b.h, 1))
  const ox = (boxW - b.w * scale) / 2 - b.x * scale
  const oy = (boxH - b.h * scale) / 2 - b.y * scale
  return { scale, ox, oy }
}

/** Pan that centres the viewport on the world point under a minimap point. */
export function minimapClickToPan(
  pt: { x: number; y: number },
  m: MinimapMap,
  zoom: number,
  viewportW: number,
  viewportH: number
): { x: number; y: number } {
  const wx = (pt.x - m.ox) / m.scale
  const wy = (pt.y - m.oy) / m.scale
  return { x: viewportW / 2 - wx * zoom, y: viewportH / 2 - wy * zoom }
}
