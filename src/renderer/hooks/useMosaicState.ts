import { useCallback, useMemo, useRef, useState } from 'react'
import { mosaicStore, type MosaicTabState } from '../mosaic-store'
import type { MosaicNode } from '../mosaic-tree'
import { deriveMosaicTree, visibleMaximizedId } from '../mosaic-view-state'

/** Mosaic state tagged with the tab it belongs to, so it is never applied to another tab. */
export type TaggedMosaicState = { tabId: string } & MosaicTabState

const loadTagged = (tabId: string): TaggedMosaicState => ({ tabId, ...mosaicStore.load(tabId) })

/**
 * Per-tab Mosaic view state. The STORED state (mode, tree, maximized pane) is
 * only written by user actions. What is shown is DERIVED at render from the
 * stored tree and the tab's live windows, so a launch that respawns windows one
 * by one never prunes the saved layout.
 */
export function useMosaicState(activeTabId: string, windowIds: string[]): {
  /** Stored state of the active tab (use `.mode`). */
  mosaic: TaggedMosaicState
  /** Tree to render: the stored tree reconciled with the live windows. */
  tree: MosaicNode | null
  /** Maximized pane to render; null while its window is absent. */
  maximizedId: string | null
  /** Persist a user edit. The rendered tree is the base unless the patch has a tree. */
  updateMosaic: (patch: Partial<MosaicTabState>) => void
  focusedPaneId: string | null
  setFocusedPaneId: (id: string | null) => void
} {
  const [mosaic, setMosaicState] = useState<TaggedMosaicState>(() => loadTagged(activeTabId))
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null)

  // Tab switch: swap in the new tab's state during render, so no frame ever
  // pairs the previous tab's tree with this tab's windows.
  if (mosaic.tabId !== activeTabId) {
    setMosaicState(loadTagged(activeTabId))
    setFocusedPaneId(null)
  }

  // Focus is read, not tracked: focusing a pane must not move unsaved panes.
  const focusRef = useRef(focusedPaneId)
  focusRef.current = focusedPaneId
  // Previously rendered tree of this tab, so unsaved inserts keep their place.
  const prevRendered = useRef<{ tabId: string; tree: MosaicNode | null } | null>(null)

  const idsKey = windowIds.join('\n')
  const tree = useMemo(() => {
    const ids = idsKey ? idsKey.split('\n') : []
    const prev = prevRendered.current?.tabId === mosaic.tabId ? prevRendered.current.tree : undefined
    return deriveMosaicTree(mosaic.tree, prev, ids, focusRef.current ?? undefined)
  }, [mosaic.tabId, mosaic.tree, idsKey])
  prevRendered.current = { tabId: mosaic.tabId, tree }
  const maximizedId = visibleMaximizedId(mosaic.maximizedId, windowIds)

  // Latest values, updated eagerly so several patches in one tick compose.
  const latest = useRef({ mosaic, tree, hasWindows: windowIds.length > 0, activeTabId })
  latest.current = { mosaic, tree, hasWindows: windowIds.length > 0, activeTabId }

  const updateMosaic = useCallback((patch: Partial<MosaicTabState>) => {
    const cur = latest.current
    if (cur.mosaic.tabId !== cur.activeTabId) return
    // With no windows yet (launch) the rendered tree is empty only for lack of
    // windows: keep the stored layout rather than saving that emptiness.
    const base = cur.hasWindows ? cur.tree : cur.mosaic.tree
    const next: TaggedMosaicState = { ...cur.mosaic, tree: base, ...patch }
    latest.current = { ...cur, mosaic: next, tree: next.tree }
    const { tabId, ...state } = next
    mosaicStore.save(tabId, state)
    setMosaicState(next)
  }, [])

  return { mosaic, tree, maximizedId, updateMosaic, focusedPaneId, setFocusedPaneId }
}
