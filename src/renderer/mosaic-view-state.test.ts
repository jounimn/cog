import { describe, it, expect } from 'vitest'
import { deriveMosaicTree, visibleMaximizedId, type DerivedTree } from './mosaic-view-state'
import { leafIds, type MosaicNode } from './mosaic-tree'

const L = (id: string) => ({ kind: 'leaf', id }) as const
// Saved, hand-tuned layout: a | (b / c) with non-default ratios.
const saved: MosaicNode = {
  kind: 'split', dir: 'row', ratio: 0.3,
  a: L('a'),
  b: { kind: 'split', dir: 'col', ratio: 0.7, a: L('b'), b: L('c') }
}

const sibling = (t: MosaicNode | null, id: string): MosaicNode | undefined => {
  if (!t || t.kind === 'leaf') return undefined
  if (t.a.kind === 'leaf' && t.a.id === id) return t.b
  if (t.b.kind === 'leaf' && t.b.id === id) return t.a
  return sibling(t.a, id) ?? sibling(t.b, id)
}

describe('mosaic-view-state', () => {
  it('keeps the stored tree untouched while no windows exist yet (app restart)', () => {
    const copy = JSON.parse(JSON.stringify(saved))
    expect(deriveMosaicTree(saved, undefined, [])).toBeNull()
    expect(saved).toEqual(copy)
  })

  it('progressive hydration restores the saved shape', () => {
    let prev: DerivedTree | undefined = undefined
    for (const ids of [[], ['b'], ['b', 'a'], ['b', 'a', 'c']]) {
      prev = { stored: saved, tree: deriveMosaicTree(saved, prev, ids) }
    }
    expect(prev?.tree).toEqual(saved)
  })

  it('keeps a window added since the last save where it was placed', () => {
    const withD = deriveMosaicTree(saved, { stored: saved, tree: saved }, ['a', 'b', 'c', 'd'], 'a')
    const withE = deriveMosaicTree(saved, { stored: saved, tree: withD }, ['a', 'b', 'c', 'd', 'e'], 'c')
    // d still sits next to a (its first placement), e went next to c.
    expect(sibling(withE, 'd')).toEqual(L('a'))
    expect(sibling(withE, 'e')).toEqual(L('c'))
    expect(leafIds(withE).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('a closed window drops out of the rendered tree', () => {
    expect(leafIds(deriveMosaicTree(saved, { stored: saved, tree: saved }, ['a', 'c']))).toEqual(['a', 'c'])
  })

  it('a user edit that changes only a ratio is what gets rendered', () => {
    const prev: DerivedTree = { stored: saved, tree: saved }
    const edited: MosaicNode = { ...(saved as Extract<MosaicNode, { kind: 'split' }>), ratio: 0.8 }
    expect(deriveMosaicTree(edited, prev, ['a', 'b', 'c'])).toEqual(edited)
  })

  it('a user edit that reshapes the tree (same leaves) is what gets rendered', () => {
    const prev: DerivedTree = { stored: saved, tree: saved }
    const moved: MosaicNode = {
      kind: 'split', dir: 'col', ratio: 0.4,
      a: { kind: 'split', dir: 'row', ratio: 0.6, a: L('c'), b: L('a') },
      b: L('b')
    }
    expect(deriveMosaicTree(moved, prev, ['a', 'b', 'c'])).toEqual(moved)
  })

  it('with nothing stored, tiles the windows', () => {
    expect(leafIds(deriveMosaicTree(null, undefined, ['x', 'y']))).toEqual(['x', 'y'])
  })

  it('ignores a maximized pane whose window is absent, keeps it when present', () => {
    expect(visibleMaximizedId('b', [])).toBeNull()
    expect(visibleMaximizedId('b', ['a', 'b'])).toBe('b')
    expect(visibleMaximizedId(null, ['a'])).toBeNull()
  })
})
