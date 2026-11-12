/** Screen px = world coord * zoom + pan (matches Workspace's translate(pan) scale(zoom)). */

const BASE_STEP = 120

/** Smallest ruler step (world units) whose on-screen spacing is at least minPx. */
export function rulerStep(zoom: number, minPx = 60): number {
  // Zoomed in, finer steps (30, 60) are allowed; otherwise 120 doubles upward.
  let step = zoom > 1 ? BASE_STEP / 4 : BASE_STEP
  while (step * zoom < minPx) step *= 2
  return step
}

/** Ticks along one axis: world coord and its screen px, within [0, lengthPx]. */
export function rulerTicks(zoom: number, pan: number, lengthPx: number): { coord: number; px: number }[] {
  const step = rulerStep(zoom)
  const ticks: { coord: number; px: number }[] = []
  for (let coord = Math.ceil(-pan / zoom / step) * step; ; coord += step) {
    const px = coord * zoom + pan
    if (px > lengthPx) break
    if (px >= 0) ticks.push({ coord: coord + 0, px })
  }
  return ticks
}

/** World-coordinate rectangle visible in a w x h viewport, rounded. */
export function visibleRange(
  zoom: number,
  pan: { x: number; y: number },
  w: number,
  h: number
): { x0: number; x1: number; y0: number; y1: number } {
  return {
    x0: Math.round(-pan.x / zoom) + 0,
    x1: Math.round((w - pan.x) / zoom) + 0,
    y0: Math.round(-pan.y / zoom) + 0,
    y1: Math.round((h - pan.y) / zoom) + 0
  }
}

const MAJOR_SPACING = 120

function multiples(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let v = Math.ceil(from / step) * step; v <= to; v += step) out.push(v + 0)
  return out
}

/**
 * Major-grid intersections (world coords) inside a visible range, thinned by
 * power-of-two strides until at most `max` remain, so marks spread evenly over
 * the viewport instead of filling only the first rows. The stride is uniform
 * on both axes first; each axis is then refined (halved) while the count still
 * fits, so a wide, short remainder does not leave a whole axis nearly empty.
 */
export function crosshairPoints(
  range: { x0: number; x1: number; y0: number; y1: number },
  max = 60
): { x: number; y: number }[] {
  const count = (sx: number, sy: number) =>
    multiples(range.x0, range.x1, MAJOR_SPACING * sx).length *
    multiples(range.y0, range.y1, MAJOR_SPACING * sy).length
  let sx = 1
  while (count(sx, sx) > max) sx *= 2
  let sy = sx
  while (sy > 1 && count(sx, sy / 2) <= max) sy /= 2
  while (sx > 1 && count(sx / 2, sy) <= max) sx /= 2
  const xs = multiples(range.x0, range.x1, MAJOR_SPACING * sx)
  const ys = multiples(range.y0, range.y1, MAJOR_SPACING * sy)
  return ys.flatMap(y => xs.map(x => ({ x, y })))
}
