import { describe, it, expect } from 'vitest'
import { createViewportStore, type Viewport } from './viewport-store'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v) }
  }
}

describe('viewport store', () => {
  it('returns null for a tab that was never saved', () => {
    const store = createViewportStore(memoryStorage())
    expect(store.load('tab-1')).toBeNull()
  })

  it('round-trips a viewport per tab', () => {
    const store = createViewportStore(memoryStorage())
    const a: Viewport = { zoom: 0.8, panX: -120, panY: 40 }
    const b: Viewport = { zoom: 1.2, panX: 300, panY: -10 }
    store.save('tab-a', a)
    store.save('tab-b', b)
    expect(store.load('tab-a')).toEqual(a)
    expect(store.load('tab-b')).toEqual(b)
  })

  it('forgets a tab on remove without touching the others', () => {
    const store = createViewportStore(memoryStorage())
    store.save('tab-a', { zoom: 1, panX: 0, panY: 0 })
    store.save('tab-b', { zoom: 1, panX: 5, panY: 5 })
    store.remove('tab-a')
    expect(store.load('tab-a')).toBeNull()
    expect(store.load('tab-b')).toEqual({ zoom: 1, panX: 5, panY: 5 })
  })

  it('ignores corrupt or non-finite stored data', () => {
    const storage = memoryStorage()
    storage.setItem('cog.viewports.v1', '{"tab-x":{"zoom":"nope","panX":1,"panY":2},"tab-y":null}')
    const store = createViewportStore(storage)
    expect(store.load('tab-x')).toBeNull()
    expect(store.load('tab-y')).toBeNull()
    storage.setItem('cog.viewports.v1', 'not json')
    expect(createViewportStore(storage).load('tab-x')).toBeNull()
  })

  it('survives a storage that throws (private mode, quota)', () => {
    const broken: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: () => { throw new Error('nope') },
      setItem: () => { throw new Error('nope') }
    }
    const store = createViewportStore(broken)
    expect(() => store.save('t', { zoom: 1, panX: 0, panY: 0 })).not.toThrow()
    expect(store.load('t')).toBeNull()
  })
})
