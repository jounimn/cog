// Derives what the Mosaic view shows from the persisted tab state and the tab's
// live windows. Pure; nothing here is ever saved by itself. Windows arrive one
// by one after a launch (lazy respawn), so the stored tree is never pruned to
// match a partial window list. Only user actions persist, and they save the
// rendered tree.
import { leafIds, reconcile, remove, type MosaicNode } from './mosaic-tree'

/** A rendered tree together with the stored tree it was derived from. */
export interface DerivedTree {
  stored: MosaicNode | null
  tree: MosaicNode | null
}

/**
 * The tree to render. Builds on the previously rendered tree (`prev`) so that
 * windows added since the last save keep the place they were given, but only
 * while `prev` was derived from this same stored tree. A user edit (new stored
 * tree) always wins, and so does hydration: when `prev` is missing a stored
 * leaf that is present again (after a restart or a respawn), it rebuilds from
 * the stored tree, so the saved shape comes back.
 */
export function deriveMosaicTree(
  stored: MosaicNode | null,
  prev: DerivedTree | undefined,
  ids: string[],
  focusedId?: string
): MosaicNode | null {
  const present = new Set(ids)
  const prevLeaves = new Set(leafIds(prev?.tree ?? null))
  const reusePrev = prev !== undefined && prev.stored === stored &&
    leafIds(stored).every(id => !present.has(id) || prevLeaves.has(id))
  return reconcile(reusePrev ? prev.tree : stored, ids, focusedId)
}

/** The maximized pane to show: ignored (not cleared) while its window is absent. */
export function visibleMaximizedId(maximizedId: string | null, ids: string[]): string | null {
  return maximizedId !== null && ids.includes(maximizedId) ? maximizedId : null
}

/** The stored fields a close rewrites. */
export interface ClosePatch {
  tree: MosaicNode | null
  maximizedId: string | null
}

/**
 * What to persist when windows disappear (Ruling 7). A window that was present
 * in the last committed render of this same tab session (`prevIds`) and is
 * absent now was closed by the user: its leaf leaves the stored tree, and the
 * stored maximized pane is cleared if it was that window. Panel ids are reused
 * per tab, so a reopened panel must not come back to a stale slot or maximize.
 *
 * Returns null (write nothing) when there is no previous render of this tab
 * session (first render, tab switch), when nothing disappeared (windows
 * arriving after a restart: absent -> present never writes), or when the
 * closed windows were never in the store.
 *
 * `rendered` is the tree derived for `ids`. Once every remaining stored window
 * is back it is what gets saved, so unsaved inserts keep their place; while
 * the layout is still hydrating, only the closed leaves are cut from the
 * stored tree, so windows not back yet keep their slots.
 */
export function closedPanesPatch(
  stored: ClosePatch,
  rendered: MosaicNode | null,
  prevIds: string[] | undefined,
  ids: string[]
): ClosePatch | null {
  if (prevIds === undefined) return null
  const present = new Set(ids)
  const closed = new Set(prevIds.filter(id => !present.has(id)))
  const storedLeaves = leafIds(stored.tree)
  const maximizedClosed = stored.maximizedId !== null && closed.has(stored.maximizedId)
  if (!maximizedClosed && !storedLeaves.some(id => closed.has(id))) return null
  const hydrated = storedLeaves.every(id => closed.has(id) || present.has(id))
  let tree = stored.tree
  if (tree !== null && hydrated) tree = rendered
  else for (const id of closed) tree = remove(tree, id)
  return { tree, maximizedId: maximizedClosed ? null : stored.maximizedId }
}
