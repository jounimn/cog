import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { mosaicStore, type MosaicTabState } from '../mosaic-store'
import type { MosaicNode } from '../mosaic-tree'
import { deriveMosaicTree, visibleMaximizedId, type DerivedTree } from '../mosaic-view-state'

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
  // Last COMMITTED render of this tab and the stored tree it came from, so
  // unsaved inserts keep their place until the stored tree changes.
  const prevRendered = useRef<({ tabId: string } & DerivedTree) | null>(null)

  const idsKey = windowIds.join('\n')
  const tree = useMemo(() => {
    const ids = idsKey ? idsKey.split('\n') : []
    const p = prevRendered.current
    const prev = p?.tabId === mosaic.tabId ? p : undefined
    return deriveMosaicTree(mosaic.tree, prev, ids, focusRef.current ?? undefined)
  }, [mosaic.tabId, mosaic.tree, idsKey])
  const maximizedId = visibleMaximizedId(mosaic.maximizedId, windowIds)

  // Latest committed values for updateMosaic (also updated eagerly by it, so
  // several patches in one tick compose).
  const hasWindows = windowIds.length > 0
  const latest = useRef({ mosaic, tree, hasWindows, activeTabId })

  // Refs are written after commit, never during render.
  useLayoutEffect(() => {
    focusRef.current = focusedPaneId
    prevRendered.current = { tabId: mosaic.tabId, stored: mosaic.tree, tree }
    latest.current = { mosaic, tree, hasWindows, activeTabId }
  })

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
