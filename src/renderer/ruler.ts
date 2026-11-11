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
