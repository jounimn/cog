// Derives what the Mosaic view shows from the persisted tab state and the tab's
// live windows. Pure; nothing here is ever saved by itself. Windows arrive one
// by one after a launch (lazy respawn), so the stored tree is never pruned to
// match a partial window list. Only user actions persist, and they save the
// rendered tree.
import { leafIds, reconcile, type MosaicNode } from './mosaic-tree'

/**
 * The tree to render. Builds on the previously rendered tree (`prev`) so that
 * windows added since the last save keep the place they were given, unless
 * `prev` is missing a stored leaf that is present again (hydration after a
 * restart or a respawn). In that case it rebuilds from the stored tree, so
 * the saved shape comes back.
 */
export function deriveMosaicTree(
  stored: MosaicNode | null,
  prev: MosaicNode | null | undefined,
  ids: string[],
  focusedId?: string
): MosaicNode | null {
  const present = new Set(ids)
  const prevLeaves = new Set(leafIds(prev ?? null))
  const prevKeepsStored = prev !== undefined &&
    leafIds(stored).every(id => !present.has(id) || prevLeaves.has(id))
  return reconcile(prevKeepsStored ? prev : stored, ids, focusedId)
}

/** The maximized pane to show: ignored (not cleared) while its window is absent. */
export function visibleMaximizedId(maximizedId: string | null, ids: string[]): string | null {
  return maximizedId !== null && ids.includes(maximizedId) ? maximizedId : null
}
