import { useSyncExternalStore } from 'react'
import { DEFAULT_APPEARANCE, sanitizeSettings } from './terminal-appearance'
import type { Appearance, AppearanceSettings } from './terminal-appearance'

const KEY = 'terminalAppearance'
const MOTION_KEY = 'motionPaused'

interface SettingsApi {
  getSettings(): Promise<Record<string, unknown>>
  setSetting(k: string, v: unknown): Promise<unknown>
}

export interface AppearanceStore {
  get(): AppearanceSettings
  load(): Promise<void>
  setGlobal(p: Partial<Appearance>): void
  /** Merge `p` into the agent's overrides; `null` removes the entry. */
  setAgent(name: string, p: Partial<Appearance> | null): void
  subscribe(fn: () => void): () => void
}

export function createAppearanceStore(api: SettingsApi): AppearanceStore {
  let state: AppearanceSettings = { global: { ...DEFAULT_APPEARANCE }, perAgent: {} }
  const listeners = new Set<() => void>()

  let loading = false
  // Edits made while load() is in flight; replayed over the persisted data afterwards
  let queued: Array<(s: AppearanceSettings) => AppearanceSettings> = []

  const persist = (): void => {
    void Promise.resolve(api.setSetting(KEY, state)).catch(() => {})
  }

  const commit = (update: (s: AppearanceSettings) => AppearanceSettings): void => {
    state = sanitizeSettings(update(state))
    if (loading) queued.push(update)
    else persist()
    listeners.forEach(fn => fn())
  }

  return {
    get: () => state,
    async load() {
      loading = true
      try {
        const all = await api.getSettings()
        let next = sanitizeSettings(all?.[KEY])
        for (const u of queued) next = sanitizeSettings(u(next))
        const edited = queued.length > 0
        state = next
        queued = []
        loading = false
        if (edited) persist()
        listeners.forEach(fn => fn())
      } catch {
        // keep the in-memory state; flush any edits made meanwhile
        const edited = queued.length > 0
        queued = []
        loading = false
        if (edited) persist()
      }
    },
    setGlobal: (p) => commit(s => ({ ...s, global: { ...s.global, ...p } })),
    setAgent(name, p) {
      commit(s => {
        const perAgent = { ...s.perAgent }
        if (p === null) delete perAgent[name]
        else perAgent[name] = { ...perAgent[name], ...p }
        return { ...s, perAgent }
      })
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    }
  }
}

export const appearanceStore = createAppearanceStore({
  getSettings: () => window.electronAPI.getSettings() as Promise<Record<string, unknown>>,
  setSetting: (k, v) => window.electronAPI.setSetting(k, v)
})

export function useAppearance(): AppearanceSettings {
  return useSyncExternalStore(appearanceStore.subscribe, appearanceStore.get)
}

let paused = false
const motionListeners = new Set<() => void>()
const applyMotion = (): void => {
  if (typeof document === 'undefined') return
  if (paused) document.documentElement.dataset.motion = 'paused'
  else delete document.documentElement.dataset.motion
}

export const motionStore = {
  get: () => paused,
  set(v: boolean): void {
    paused = v
    applyMotion()
    void Promise.resolve(window.electronAPI.setSetting(MOTION_KEY, v)).catch(() => {})
    motionListeners.forEach(fn => fn())
  },
  async load(): Promise<void> {
    try {
      const all = await window.electronAPI.getSettings() as Record<string, unknown>
      paused = all?.[MOTION_KEY] === true
      applyMotion()
      motionListeners.forEach(fn => fn())
    } catch {
      // keep default
    }
  },
  subscribe(fn: () => void): () => void {
    motionListeners.add(fn)
    return () => { motionListeners.delete(fn) }
  }
}
