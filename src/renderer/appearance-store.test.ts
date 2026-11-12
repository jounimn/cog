import { describe, it, expect, vi } from 'vitest'
import { createAppearanceStore } from './appearance-store'
import { DEFAULT_APPEARANCE } from './terminal-appearance'

function fakeApi(settings: Record<string, unknown> = {}) {
  return {
    getSettings: vi.fn(async () => settings),
    setSetting: vi.fn(async () => undefined)
  }
}

describe('appearance store', () => {
  it('load() reads persisted settings', async () => {
    const store = createAppearanceStore(fakeApi({ terminalAppearance: { global: { size: 15 } } }))
    await store.load()
    expect(store.get().global.size).toBe(15)
    expect(store.get().global.font).toBe(DEFAULT_APPEARANCE.font)
  })

  it('setGlobal persists once with merged sanitised data and notifies', () => {
    const api = fakeApi()
    const store = createAppearanceStore(api)
    const fn = vi.fn()
    store.subscribe(fn)
    store.setGlobal({ palette: 'moss' })
    expect(api.setSetting).toHaveBeenCalledTimes(1)
    expect(api.setSetting).toHaveBeenCalledWith('terminalAppearance', {
      global: { ...DEFAULT_APPEARANCE, palette: 'moss' },
      perAgent: {}
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(store.get().global.palette).toBe('moss')
  })

  it('setAgent merges overrides and null removes the entry', () => {
    const store = createAppearanceStore(fakeApi())
    store.setAgent('backend', { size: 16 })
    store.setAgent('backend', { palette: 'ember' })
    expect(store.get().perAgent.backend).toEqual({ size: 16, palette: 'ember' })
    store.setAgent('backend', null)
    expect(store.get().perAgent).not.toHaveProperty('backend')
  })

  it('unsubscribe stops notifications', () => {
    const store = createAppearanceStore(fakeApi())
    const fn = vi.fn()
    store.subscribe(fn)()
    store.setGlobal({ size: 14 })
    expect(fn).not.toHaveBeenCalled()
  })

  it('a rejected getSettings keeps defaults and does not throw', async () => {
    const api = { getSettings: vi.fn(async () => { throw new Error('x') }), setSetting: vi.fn() }
    const store = createAppearanceStore(api)
    await expect(store.load()).resolves.toBeUndefined()
    expect(store.get().global).toEqual(DEFAULT_APPEARANCE)
  })

  it('edits made before load() resolves are not persisted over stored data, then replay on top of it', async () => {
    let release!: (v: Record<string, unknown>) => void
    const api = {
      getSettings: vi.fn(() => new Promise<Record<string, unknown>>(r => { release = r })),
      setSetting: vi.fn(async () => undefined)
    }
    const store = createAppearanceStore(api)
    const loading = store.load()
    store.setGlobal({ palette: 'moss' })
    expect(api.setSetting).not.toHaveBeenCalled()
    release({ terminalAppearance: { global: { size: 15 }, perAgent: { a: { size: 12 } } } })
    await loading
    expect(store.get().global).toEqual({ ...DEFAULT_APPEARANCE, size: 15, palette: 'moss' })
    expect(store.get().perAgent.a).toEqual({ size: 12 })
    expect(api.setSetting).toHaveBeenCalledTimes(1)
  })
})
