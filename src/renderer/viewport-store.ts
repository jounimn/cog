/**
 * Per-tab canvas viewport (zoom + pan) persistence.
 *
 * Each workspace tab lays its windows out in its own region of the infinite
 * canvas, so sharing one zoom/pan across tabs lands the user on empty space
 * after a switch. The store remembers where each tab was left (localStorage,
 * like window-layout's bounds) so switching tabs — or relaunching — returns to
 * the same view.
 */
import type { Viewport } from './canvas-math'

export type { Viewport }

const STORAGE_KEY = 'cog.viewports.v1'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export interface ViewportStore {
  load(tabId: string): Viewport | null
  save(tabId: string, viewport: Viewport): void
  remove(tabId: string): void
}

function isViewport(v: unknown): v is Viewport {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return Number.isFinite(o.zoom) && Number.isFinite(o.panX) && Number.isFinite(o.panY)
}

export function createViewportStore(storage: StorageLike): ViewportStore {
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
      /* storage unavailable — the view just won't persist */
    }
  }

  return {
    load(tabId) {
      const v = readAll()[tabId]
      return isViewport(v) ? { zoom: v.zoom, panX: v.panX, panY: v.panY } : null
    },
    save(tabId, viewport) {
      const map = readAll()
      map[tabId] = viewport
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
export const viewportStore: ViewportStore = createViewportStore(
  typeof localStorage !== 'undefined'
    ? localStorage
    : { getItem: () => null, setItem: () => undefined }
)
