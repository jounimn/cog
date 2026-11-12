/**
 * Pure geometry for the canvas connectors: the orthogonal route between two
 * plates, its length, the arrowhead at the target and which link of a group
 * carries the group's name chip.
 */

export interface Pt { x: number; y: number }

/** Spacing between a trace and the plate it leaves or enters. */
export const ROUTE_MARGIN = 30
/** Side of the square port drawn where a trace meets a plate edge. */
export const PORT = 6
/** Arrowhead length along the trace and half its width. */
export const ARROW_LEN = 8
export const ARROW_HALF = 4.5

/**
 * Corner points of the orthogonal (90-degree only) route from `from` (a right
 * port) to `to` (a left port). Parallel links are offset by `linkIndex` so they
 * do not overlap.
 */
export function routePoints(from: Pt, to: Pt, linkIndex: number): Pt[] {
  const exitX = from.x + ROUTE_MARGIN
  const enterX = to.x - ROUTE_MARGIN
  const offset = (linkIndex % 5) * 8 - 16

  if (exitX < enterX) {
    // Target to the right: right -> down/up -> right -> arrive
    const midX = (exitX + enterX) / 2 + offset
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to]
  }
  // Target to the left or overlapping: go round, below when both sit at a similar height
  const clearY = Math.min(from.y, to.y) - 60 - Math.abs(offset)
  const routeBelow = Math.abs(from.y - to.y) < 80
  const bypassY = routeBelow ? Math.max(from.y, to.y) + 80 + Math.abs(offset) : clearY
  return [
    from,
    { x: exitX, y: from.y },
    { x: exitX, y: bypassY },
    { x: enterX, y: bypassY },
    { x: enterX, y: to.y },
    to
  ]
}

/** SVG path data for a route (M then alternating H/V). */
export function routeD(points: Pt[]): string {
  const [first, ...rest] = points
  const parts = [`M ${first.x} ${first.y}`]
  let prev = first
  for (const p of rest) {
    if (p.y === prev.y) parts.push(`H ${p.x}`)
    else if (p.x === prev.x) parts.push(`V ${p.y}`)
    else parts.push(`L ${p.x} ${p.y}`)
    prev = p
  }
  return parts.join(' ')
}

/** Total length of a route. */
export function routeLength(points: Pt[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y)
  }
  return len
}

/**
 * Filled arrowhead at the end of a route, as polygon points. The tip sits on
 * the outer edge of the target's port square so the port never hides it.
 */
export function arrowPoints(points: Pt[]): string {
  const end = points[points.length - 1]
  const prev = points[points.length - 2] ?? end
  const dx = Math.sign(end.x - prev.x)
  const dy = Math.sign(end.y - prev.y)
  // Direction of travel into the target (routes always end horizontally; default to rightward)
  const ux = dx === 0 && dy === 0 ? 1 : dx
  const uy = dx === 0 && dy === 0 ? 0 : dy
  const tip = { x: end.x - ux * (PORT / 2), y: end.y - uy * (PORT / 2) }
  const base = { x: tip.x - ux * ARROW_LEN, y: tip.y - uy * ARROW_LEN }
  const a = { x: base.x - uy * ARROW_HALF, y: base.y + ux * ARROW_HALF }
  const b = { x: base.x + uy * ARROW_HALF, y: base.y - ux * ARROW_HALF }
  return `${a.x},${a.y} ${tip.x},${tip.y} ${b.x},${b.y}`
}

/**
 * For each group, the index of the link that carries its name chip: the longest
 * of that group's links (the first one on a tie). Links without a group get none.
 */
export function chipLinkIndexes(groupIds: Array<string | undefined>, lengths: number[]): Set<number> {
  const best = new Map<string, number>()
  groupIds.forEach((g, i) => {
    if (!g) return
    const cur = best.get(g)
    if (cur === undefined || lengths[i] > lengths[cur]) best.set(g, i)
  })
  return new Set(best.values())
}
