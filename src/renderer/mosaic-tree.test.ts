import { describe, it, expect } from 'vitest'
import {
  autoTile, insert, remove, move, setRatio, reconcile, leafIds, leafRects, edgeAt, isMosaicNode,
  type MosaicNode
} from './mosaic-tree'

const L = (id: string) => ({ kind: 'leaf', id }) as const

describe('mosaic-tree', () => {
  it('autoTile 0/1 ids', () => { expect(autoTile([])).toBeNull(); expect(autoTile(['a'])).toEqual(L('a')) })
  it('autoTile 3 ids alternates row then col', () => {
    expect(autoTile(['a','b','c'])).toEqual({ kind:'split', dir:'row', ratio:0.5,
      a: { kind:'split', dir:'col', ratio:0.5, a:L('a'), b:L('b') }, b: L('c') })
  })
  it('autoTile 5 ids keeps every id once', () => expect(leafIds(autoTile(['1','2','3','4','5']))).toEqual(['1','2','3','4','5']))
  it('insert into null is a leaf', () => expect(insert(null,'a')).toEqual(L('a')))
  it('insert each side', () => {
    expect(insert(L('a'),'b','a','left')).toEqual({ kind:'split', dir:'row', ratio:0.5, a:L('b'), b:L('a') })
    expect(insert(L('a'),'b','a','right')).toEqual({ kind:'split', dir:'row', ratio:0.5, a:L('a'), b:L('b') })
    expect(insert(L('a'),'b','a','top')).toEqual({ kind:'split', dir:'col', ratio:0.5, a:L('b'), b:L('a') })
    expect(insert(L('a'),'b','a','bottom')).toEqual({ kind:'split', dir:'col', ratio:0.5, a:L('a'), b:L('b') })
  })
  it('insert with no target splits the largest leaf on its longer axis', () => {
    const t = { kind:'split', dir:'row', ratio:0.7, a:L('big'), b:L('small') } as MosaicNode
    // big is 11.2x9 → wider than tall → right
    expect(insert(t,'n')).toEqual({ ...t, a: { kind:'split', dir:'row', ratio:0.5, a:L('big'), b:L('n') } })
  })
  it('insert of an existing id is a no-op', () => { const t = autoTile(['a','b'])!; expect(insert(t,'a')).toBe(t) })
  it('remove collapses to sibling / last leaf to null / unknown no-op', () => {
    const t = autoTile(['a','b'])!
    expect(remove(t,'a')).toEqual(L('b')); expect(remove(L('a'),'a')).toBeNull(); expect(remove(t,'zz')).toBe(t)
  })
  it('move center swaps; self is no-op; edge relocates', () => {
    const t = autoTile(['a','b','c'])!
    expect(leafIds(move(t,'a','c','center'))).toEqual(['c','b','a'])
    expect(move(t,'a','a','left')).toBe(t)
    expect(move(t,'a','c','bottom')).toEqual({ kind:'split', dir:'row', ratio:0.5, a:L('b'),
      b: { kind:'split', dir:'col', ratio:0.5, a:L('c'), b:L('a') } })
  })
  it('setRatio clamps', () => {
    const t = autoTile(['a','b'])!
    expect((setRatio(t,[],0.02) as any).ratio).toBe(0.1); expect((setRatio(t,[],5) as any).ratio).toBe(0.9)
    expect(setRatio(t,['a'],0.3)).toBe(t)
  })
  it('reconcile drops orphans, adds new next to focused, rebuilds from null', () => {
    const t = autoTile(['a','b'])!
    expect(leafIds(reconcile(t,['b']))).toEqual(['b'])
    // Focus b, not a: a is also where an unfocused insert would go (largest leaf, first on ties).
    expect(reconcile(t,['a','b','n'],'b')).toEqual({ kind:'split', dir:'row', ratio:0.5,
      a:L('a'), b: { kind:'split', dir:'col', ratio:0.5, a:L('b'), b:L('n') } })
    expect(reconcile(null,['x','y'])).toEqual(autoTile(['x','y']))
    expect(reconcile(t,[])).toBeNull()
  })
  it('reconcile dedupes ids', () => expect(leafIds(reconcile(null,['a','a','b']))).toEqual(['a','b']))
  it('leafRects covers the whole area', () => {
    const rects = leafRects(autoTile(['a','b','c']), 100, 50)
    expect(rects.reduce((s,r)=>s+r.rect.w*r.rect.h,0)).toBeCloseTo(5000)
    expect(rects[0]).toEqual({ id:'a', rect:{ x:0, y:0, w:50, h:25 } })
  })
  it('edgeAt', () => {
    expect(edgeAt(50,50,100,100)).toBe('center'); expect(edgeAt(5,50,100,100)).toBe('left')
    expect(edgeAt(95,50,100,100)).toBe('right'); expect(edgeAt(50,5,100,100)).toBe('top')
    expect(edgeAt(50,95,100,100)).toBe('bottom'); expect(edgeAt(3,10,100,100)).toBe('left')
  })
  it('isMosaicNode accepts valid trees', () => expect(isMosaicNode(autoTile(['a','b','c']))).toBe(true))
  it('isMosaicNode rejects bad ratio', () => {
    expect(isMosaicNode({ kind:'split', dir:'row', ratio:NaN, a:L('a'), b:L('b') })).toBe(false)
    expect(isMosaicNode({ kind:'split', dir:'row', ratio:2, a:L('a'), b:L('b') })).toBe(false)
  })
  it('isMosaicNode rejects duplicate leaves and junk', () => {
    expect(isMosaicNode({ kind:'split', dir:'row', ratio:0.5, a:L('a'), b:L('a') })).toBe(false)
    expect(isMosaicNode({ kind:'leaf', id:'' })).toBe(false); expect(isMosaicNode('x')).toBe(false)
  })
})
