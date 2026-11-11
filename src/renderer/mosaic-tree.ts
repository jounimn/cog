// Pure binary split-tree model for the Mosaic view. No React/DOM.
// All functions are immutable and return the original reference when nothing changes.

export type MosaicDir = 'row' | 'col' // row = side by side, col = stacked
export type MosaicEdge = 'left' | 'right' | 'top' | 'bottom' | 'center'
export type MosaicSide = Exclude<MosaicEdge, 'center'>
export type MosaicNode =
  | { kind: 'leaf'; id: string }
  | { kind: 'split'; dir: MosaicDir; ratio: number; a: MosaicNode; b: MosaicNode }
export type MosaicPath = Array<'a' | 'b'>
export interface Rect { x: number; y: number; w: number; h: number }

export const MIN_RATIO = 0.1
export const MAX_RATIO = 0.9

const leaf = (id: string): MosaicNode => ({ kind: 'leaf', id })

export function leafIds(tree: MosaicNode | null): string[] {
  if (!tree) return []
  if (tree.kind === 'leaf') return [tree.id]
  return [...leafIds(tree.a), ...leafIds(tree.b)]
}

export function autoTile(ids: string[]): MosaicNode | null {
  const build = (list: string[], depth: number): MosaicNode => {
    if (list.length === 1) return leaf(list[0])
    const mid = Math.ceil(list.length / 2)
    return {
      kind: 'split',
      dir: depth % 2 === 0 ? 'row' : 'col',
      ratio: 0.5,
      a: build(list.slice(0, mid), depth + 1),
      b: build(list.slice(mid), depth + 1)
    }
  }
  return ids.length === 0 ? null : build(ids, 0)
}

export function leafRects(tree: MosaicNode | null, w: number, h: number): Array<{ id: string; rect: Rect }> {
  const out: Array<{ id: string; rect: Rect }> = []
  const walk = (n: MosaicNode, r: Rect): void => {
    if (n.kind === 'leaf') { out.push({ id: n.id, rect: r }); return }
    if (n.dir === 'row') {
      const aw = r.w * n.ratio
      walk(n.a, { x: r.x, y: r.y, w: aw, h: r.h })
      walk(n.b, { x: r.x + aw, y: r.y, w: r.w - aw, h: r.h })
    } else {
      const ah = r.h * n.ratio
      walk(n.a, { x: r.x, y: r.y, w: r.w, h: ah })
      walk(n.b, { x: r.x, y: r.y + ah, w: r.w, h: r.h - ah })
    }
  }
  if (tree) walk(tree, { x: 0, y: 0, w, h })
  return out
}

export function insert(tree: MosaicNode | null, id: string, targetId?: string, side?: MosaicSide): MosaicNode {
  if (!tree) return leaf(id)
  const ids = leafIds(tree)
  if (ids.includes(id)) return tree

  const rects = leafRects(tree, 16, 9)
  let target = targetId !== undefined ? rects.find((r) => r.id === targetId) : undefined
  if (!target) {
    for (const r of rects) {
      if (!target || r.rect.w * r.rect.h > target.rect.w * target.rect.h) target = r
    }
  }
  const t = target!
  const s: MosaicSide = side ?? (t.rect.w >= t.rect.h ? 'right' : 'bottom')
  const dir: MosaicDir = s === 'left' || s === 'right' ? 'row' : 'col'
  const newFirst = s === 'left' || s === 'top'

  const walk = (n: MosaicNode): MosaicNode => {
    if (n.kind === 'leaf') {
      if (n.id !== t.id) return n
      return { kind: 'split', dir, ratio: 0.5, a: newFirst ? leaf(id) : n, b: newFirst ? n : leaf(id) }
    }
    const a = walk(n.a)
    if (a !== n.a) return { ...n, a }
    const b = walk(n.b)
    return b === n.b ? n : { ...n, b }
  }
  return walk(tree)
}

export function remove(tree: MosaicNode | null, id: string): MosaicNode | null {
  if (!tree) return null
  if (tree.kind === 'leaf') return tree.id === id ? null : tree
  const a = remove(tree.a, id)
  if (a !== tree.a) return a === null ? tree.b : { ...tree, a }
  const b = remove(tree.b, id)
  if (b !== tree.b) return b === null ? tree.a : { ...tree, b }
  return tree
}

export function move(tree: MosaicNode, id: string, targetId: string, edge: MosaicEdge): MosaicNode {
  if (id === targetId) return tree
  const ids = leafIds(tree)
  if (!ids.includes(id) || !ids.includes(targetId)) return tree
  if (edge === 'center') {
    const swap = (n: MosaicNode): MosaicNode => {
      if (n.kind === 'leaf') return n.id === id ? leaf(targetId) : n.id === targetId ? leaf(id) : n
      return { ...n, a: swap(n.a), b: swap(n.b) }
    }
    return swap(tree)
  }
  return insert(remove(tree, id), id, targetId, edge)
}

export function setRatio(tree: MosaicNode, path: MosaicPath, ratio: number): MosaicNode {
  if (tree.kind !== 'split') return tree
  if (path.length === 0) {
    const r = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
    return r === tree.ratio ? tree : { ...tree, ratio: r }
  }
  const [head, ...rest] = path
  const child = setRatio(tree[head], rest, ratio)
  return child === tree[head] ? tree : { ...tree, [head]: child }
}

export function reconcile(tree: MosaicNode | null, ids: string[], focusedId?: string): MosaicNode | null {
  const wanted = [...new Set(ids)]
  const keep = new Set(wanted)
  let t = tree
  for (const id of leafIds(tree)) if (!keep.has(id)) t = remove(t, id)
  if (!t) return autoTile(wanted)
  for (const id of wanted) {
    if (leafIds(t).includes(id)) continue
    const near = focusedId !== undefined && leafIds(t).includes(focusedId) ? focusedId : undefined
    t = insert(t, id, near)
  }
  return t
}

export function edgeAt(x: number, y: number, w: number, h: number): MosaicEdge {
  const nx = x / w
  const ny = y / h
  if (nx >= 0.25 && nx <= 0.75 && ny >= 0.25 && ny <= 0.75) return 'center'
  const dists: Array<[MosaicSide, number]> = [['left', nx], ['right', 1 - nx], ['top', ny], ['bottom', 1 - ny]]
  let best = dists[0]
  for (const d of dists) if (d[1] < best[1]) best = d
  return best[0]
}

export function isMosaicNode(v: unknown): v is MosaicNode {
  const seen = new Set<string>()
  const check = (n: unknown): boolean => {
    if (typeof n !== 'object' || n === null) return false
    const o = n as Record<string, unknown>
    if (o.kind === 'leaf') {
      if (typeof o.id !== 'string' || o.id === '' || seen.has(o.id)) return false
      seen.add(o.id)
      return true
    }
    if (o.kind === 'split') {
      if (o.dir !== 'row' && o.dir !== 'col') return false
      if (typeof o.ratio !== 'number' || !Number.isFinite(o.ratio) || o.ratio < MIN_RATIO || o.ratio > MAX_RATIO) return false
      return check(o.a) && check(o.b)
    }
    return false
  }
  return check(v)
}
