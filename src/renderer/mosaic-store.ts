/**
 * Per-tab mosaic view persistence: view mode, split tree and maximized pane.
 *
 * Same shape as viewport-store: one localStorage entry keyed by tab id, every
 * field validated on load so a stale or hand-edited entry degrades to defaults
 * instead of breaking the tab.
 */
import { isMosaicNode, type MosaicNode } from './mosaic-tree'

export type ViewMode = 'canvas' | 'mosaic'

export interface MosaicTabState {
  mode: ViewMode
  tree: MosaicNode | null
  maximizedId: string | null
}

export const DEFAULT_MOSAIC_STATE: MosaicTabState = { mode: 'canvas', tree: null, maximizedId: null }

const STORAGE_KEY = 'cog.mosaic.v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export interface MosaicStore {
  load(tabId: string): MosaicTabState
  save(tabId: string, s: MosaicTabState): void
  remove(tabId: string): void
}

export function createMosaicStore(storage: StorageLike): MosaicStore {
  const readAll = (): Record<string, unknown> => {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  const writeAll = (map: Record<string, unknown>): void => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(map))
    } catch {
      /* storage unavailable — the layout just won't persist */
    }
  }

  return {
    load(tabId) {
      const v = readAll()[tabId]
      if (!v || typeof v !== 'object') return { ...DEFAULT_MOSAIC_STATE }
      const o = v as Record<string, unknown>
      return {
        mode: o.mode === 'mosaic' ? 'mosaic' : 'canvas',
        tree: isMosaicNode(o.tree) ? o.tree : null,
        maximizedId: typeof o.maximizedId === 'string' ? o.maximizedId : null
      }
    },
    save(tabId, s) {
      const map = readAll()
      map[tabId] = s
      writeAll(map)
    },
    remove(tabId) {
      const map = readAll()
      if (tabId in map) {
        delete map[tabId]
        writeAll(map)
      }
    }
  }
}

/** Default store backed by the renderer's localStorage. */
export const mosaicStore: MosaicStore = createMosaicStore(
  typeof localStorage !== 'undefined'
    ? localStorage
    : { getItem: () => null, setItem: () => undefined }
)
