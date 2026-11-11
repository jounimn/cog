import { describe, it, expect } from 'vitest'
import { createMosaicStore, DEFAULT_MOSAIC_STATE, type MosaicTabState } from './mosaic-store'
import { autoTile } from './mosaic-tree'

const KEY = 'cog.mosaic.v1'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v) }
  }
}

describe('mosaic store', () => {
  it('default for an unknown tab', () => {
    const store = createMosaicStore(memoryStorage())
    expect(store.load('t')).toEqual(DEFAULT_MOSAIC_STATE)
  })

  it('round-trips state', () => {
    const store = createMosaicStore(memoryStorage())
    const s: MosaicTabState = { mode: 'mosaic', tree: autoTile(['a', 'b']), maximizedId: 'a' }
    store.save('t', s)
    expect(store.load('t')).toEqual(s)
  })

  it('per-tab isolation', () => {
    const store = createMosaicStore(memoryStorage())
    store.save('t1', { mode: 'mosaic', tree: autoTile(['a', 'b']), maximizedId: null })
    expect(store.load('t2')).toEqual(DEFAULT_MOSAIC_STATE)
  })

  it('drops invalid tree but keeps mode', () => {
    const storage = memoryStorage()
    storage.setItem(KEY, JSON.stringify({
      t: {
        mode: 'mosaic',
        tree: { kind: 'split', dir: 'row', ratio: NaN, a: { kind: 'leaf', id: 'a' }, b: { kind: 'leaf', id: 'b' } },
        maximizedId: 5
      }
    }))
    expect(createMosaicStore(storage).load('t')).toEqual({ mode: 'mosaic', tree: null, maximizedId: null })
  })

  it('corrupt JSON falls back', () => {
    const storage = memoryStorage()
    storage.setItem(KEY, '{nope')
    expect(createMosaicStore(storage).load('t')).toEqual(DEFAULT_MOSAIC_STATE)
  })

  it('remove', () => {
    const store = createMosaicStore(memoryStorage())
    store.save('t', { mode: 'mosaic', tree: autoTile(['a', 'b']), maximizedId: 'a' })
    store.remove('t')
    expect(store.load('t')).toEqual(DEFAULT_MOSAIC_STATE)
  })
})
