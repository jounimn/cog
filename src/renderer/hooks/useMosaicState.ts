import { useCallback, useEffect, useRef, useState } from 'react'
import { mosaicStore, type MosaicTabState } from '../mosaic-store'
import { reconcile } from '../mosaic-tree'

/** Mosaic state tagged with the tab it belongs to, so it is never applied to another tab. */
export type TaggedMosaicState = { tabId: string } & MosaicTabState

const loadTagged = (tabId: string): TaggedMosaicState => ({ tabId, ...mosaicStore.load(tabId) })

/**
 * Per-tab Mosaic view state: view mode, split tree, maximized pane and the
 * focused pane. Loads the tab's persisted state on a tab switch, persists every
 * change, and keeps the tree in step with the tab's windows while in Mosaic.
 */
export function useMosaicState(activeTabId: string, windowIds: string[]): {
  mosaic: TaggedMosaicState
  updateMosaic: (patch: Partial<MosaicTabState>) => void
  focusedPaneId: string | null
  setFocusedPaneId: (id: string | null) => void
} {
  const [mosaic, setMosaicState] = useState<TaggedMosaicState>(() => loadTagged(activeTabId))
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null)

  // Tab switch: swap in the new tab's state during render, so no frame (and no
  // effect) ever sees the previous tab's tree next to this tab's windows.
  if (mosaic.tabId !== activeTabId) {
    setMosaicState(loadTagged(activeTabId))
    setFocusedPaneId(null)
  }

  // Latest state, updated eagerly so several patches in one tick (divider drag)
  // all build on each other.
  const latest = useRef(mosaic)
  latest.current = mosaic
  const activeTab = useRef(activeTabId)
  activeTab.current = activeTabId

  const updateMosaic = useCallback((patch: Partial<MosaicTabState>) => {
    const prev = latest.current
    if (prev.tabId !== activeTab.current) return
    const next: TaggedMosaicState = { ...prev, ...patch }
    latest.current = next
    const { tabId, ...state } = next
    mosaicStore.save(tabId, state)
    setMosaicState(next)
  }, [])

  // Keep the tree in step with the tab's windows: new windows split the focused
  // pane, closed ones collapse their split, a vanished maximized pane is cleared.
  const idsKey = windowIds.join('\n')
  useEffect(() => {
    const s = latest.current
    if (s.tabId !== activeTabId || s.mode !== 'mosaic') return
    const ids = idsKey ? idsKey.split('\n') : []
    const next = reconcile(s.tree, ids, focusedPaneId ?? undefined)
    const maximizedGone = s.maximizedId !== null && !ids.includes(s.maximizedId)
    if (JSON.stringify(next) !== JSON.stringify(s.tree) || maximizedGone) {
      updateMosaic({ tree: next, maximizedId: maximizedGone ? null : s.maximizedId })
    }
    // focusedPaneId is read, not tracked: focusing a pane must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosaic.mode, idsKey, activeTabId, updateMosaic])

  return { mosaic, updateMosaic, focusedPaneId, setFocusedPaneId }
}
