import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MosaicPane } from './MosaicPane'
import { renderWindowContent, windowAgent, windowHeading } from './window-content'
import { edgeAt, move, setRatio, type MosaicEdge, type MosaicNode, type MosaicPath } from '../mosaic-tree'
import type { WindowState } from '../hooks/useWindowManager'
import type { AgentState, WorkspaceTab } from '../../shared/types'

export interface MosaicViewProps {
  windows: WindowState[]
  agents: AgentState[]
  tabs: WorkspaceTab[]
  activeTabId: string
  links: Array<{ from: string; to: string }>
  tree: MosaicNode | null
  maximizedId: string | null
  focusedId: string | null
  onTreeChange(tree: MosaicNode | null): void
  onMaximize(id: string | null): void
  onFocus(id: string): void
  onClose(id: string): void
  onSpawnClick(): void
}

const DIVIDER = 4
/** Pointer travel before a header press becomes a drag, so click and double-click keep working. */
const DRAG_THRESHOLD = 4

interface DropTarget { targetId: string; edge: MosaicEdge; rect: { left: number; top: number; width: number; height: number } }

/** The part of `rect` a drop on `edge` would claim: the half on that side, or all of it for `center`. */
function previewRect(rect: DropTarget['rect'], edge: MosaicEdge): DropTarget['rect'] {
  const { left, top, width, height } = rect
  switch (edge) {
    case 'left': return { left, top, width: width / 2, height }
    case 'right': return { left: left + width / 2, top, width: width / 2, height }
    case 'top': return { left, top, width, height: height / 2 }
    case 'bottom': return { left, top: top + height / 2, width, height: height / 2 }
    default: return rect
  }
}

/** Names of the agents linked to `agent`. Links are keyed by agent name (as in LinkOverlay); ids are accepted too. */
function linkedAgentNames(agent: AgentState, agents: AgentState[], links: Array<{ from: string; to: string }>): string[] {
  const self = (key: string): boolean => key === agent.name || key === agent.id
  const names = new Set<string>()
  for (const link of links) {
    const other = self(link.from) ? link.to : self(link.to) ? link.from : null
    if (other === null || self(other)) continue
    names.add(agents.find(a => a.name === other || a.id === other)?.name ?? other)
  }
  return [...names]
}

/**
 * Tiled alternative to the canvas: every window of the tab is a leaf of a
 * binary split tree, splits are resized by dragging the divider between them.
 */
export function MosaicView({
  windows, agents, tabs, activeTabId, links, tree, maximizedId, focusedId,
  onTreeChange, onMaximize, onFocus, onClose, onSpawnClick
}: MosaicViewProps): React.ReactElement {
  // A divider drag edits this in-memory copy live and persists once, on release.
  const [dragTree, setDragTree] = useState<MosaicNode | null>(null)
  const shownTree = dragTree ?? tree
  // Latest tree for divider drags, which fire faster than re-renders.
  const treeRef = useRef(shownTree)
  useLayoutEffect(() => { treeRef.current = shownTree })

  // Header drag: which pane is being dragged and where it would land.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const paneDragCleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => paneDragCleanup.current?.(), [])

  const maximizedWin = maximizedId ? windows.find(w => w.id === maximizedId) : undefined

  // Escape restores a maximized pane.
  const isMaximized = maximizedWin !== undefined
  useEffect(() => {
    if (!isMaximized) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      // Escape typed into a terminal or an editable field belongs to it (e.g. interrupting a CLI).
      const t = e.target
      if (t instanceof Element && t.closest('.xterm, input, textarea, [contenteditable=""], [contenteditable="true"]')) return
      if ((t as HTMLElement | null)?.isContentEditable) return
      onMaximize(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isMaximized, onMaximize])

  const renderPane = (win: WindowState): React.ReactElement => {
    const agent = windowAgent(win, agents)
    const maximized = win.id === maximizedId
    const heading = windowHeading(win, agents)
    return (
      <MosaicPane
        key={win.id}
        id={win.id}
        agentName={agent?.name}
        title={heading.title}
        spec={heading.spec}
        status={agent?.status}
        theme={agent?.theme}
        linkedNames={agent ? linkedAgentNames(agent, agents, links) : []}
        focused={win.id === focusedId}
        maximized={maximized}
        // Also for the focused pane: a click gives its terminal the keyboard back.
        onFocus={() => onFocus(win.id)}
        onToggleMaximize={() => onMaximize(maximized ? null : win.id)}
        onClose={() => onClose(win.id)}
        onHeaderPointerDown={maximized || maximizedWin ? undefined : e => startPaneDrag(e, win.id)}
        dragging={win.id === draggingId}
      >
        {renderWindowContent(win, { agents, tabs, activeTabId })}
      </MosaicPane>
    )
  }

  const startPaneDrag = (e: React.PointerEvent, id: string): void => {
    if (e.button !== 0 || paneDragCleanup.current) return
    const header = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    let active = false
    let target: DropTarget | null = null
    try { header.setPointerCapture(pointerId) } catch { /* pointer already gone */ }

    const onMove = (ev: PointerEvent): void => {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) <= DRAG_THRESHOLD) return
        active = true
        setDraggingId(id)
        // Escape cancels only an actual drag, not a press that may still be a click.
        window.addEventListener('keydown', onKey, true)
      }
      const leaf = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-mosaic-leaf]')
      const targetId = leaf?.dataset.mosaicLeaf
      let next: DropTarget | null = null
      if (leaf && targetId && targetId !== id) {
        const r = leaf.getBoundingClientRect()
        // A zero-size pane has no meaningful edge (edgeAt would divide by zero).
        if (r.width > 0 && r.height > 0) {
          next = {
            targetId,
            edge: edgeAt(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height),
            rect: { left: r.left, top: r.top, width: r.width, height: r.height }
          }
        }
      }
      if (next?.targetId === target?.targetId && next?.edge === target?.edge) return
      target = next
      setDropTarget(next)
    }
    const finish = (drop: boolean): void => {
      // Listeners go first: releasing the capture fires lostpointercapture.
      paneDragCleanup.current?.()
      try { if (header.hasPointerCapture(pointerId)) header.releasePointerCapture(pointerId) } catch { /* detached */ }
      setDraggingId(null)
      setDropTarget(null)
      const current = treeRef.current
      if (drop && active && target && current) {
        const next = move(current, id, target.targetId, target.edge)
        if (next !== current) onTreeChange(next)
      }
    }
    const onUp = (): void => finish(true)
    const onCancel = (): void => finish(false)
    const onLostCapture = (ev: PointerEvent): void => { if (ev.pointerId === pointerId) finish(false) }
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key !== 'Escape') return
      // Escape only cancels the drag; nothing else sees it.
      ev.preventDefault()
      ev.stopPropagation()
      finish(false)
    }
    header.addEventListener('pointermove', onMove)
    header.addEventListener('pointerup', onUp)
    header.addEventListener('pointercancel', onCancel)
    // The header can remount mid-drag (e.g. an agent spawned next to the
    // dragged pane splits its leaf): its pointerup never arrives, but the lost
    // capture does — at the document once the header is detached — so the
    // drag still ends.
    document.addEventListener('lostpointercapture', onLostCapture)
    paneDragCleanup.current = () => {
      paneDragCleanup.current = null
      header.removeEventListener('pointermove', onMove)
      header.removeEventListener('pointerup', onUp)
      header.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('lostpointercapture', onLostCapture)
      window.removeEventListener('keydown', onKey, true)
    }
  }

  const startDividerDrag = (e: React.PointerEvent<HTMLDivElement>, path: MosaicPath, dir: 'row' | 'col'): void => {
    const divider = e.currentTarget
    const container = divider.parentElement
    if (!container) return
    e.preventDefault()
    divider.setPointerCapture(e.pointerId)
    let dragged: MosaicNode | null = null
    const onMove = (ev: PointerEvent): void => {
      const current = treeRef.current
      if (!current) return
      const rect = container.getBoundingClientRect()
      const size = dir === 'row' ? rect.width : rect.height
      if (size <= 0) return
      const ratio = (dir === 'row' ? ev.clientX - rect.left : ev.clientY - rect.top) / size
      if (!Number.isFinite(ratio)) return
      const next = setRatio(current, path, ratio)
      if (next !== current) {
        treeRef.current = next
        dragged = next
        setDragTree(next)
      }
    }
    const end = (ev: PointerEvent): void => {
      if (divider.hasPointerCapture(ev.pointerId)) divider.releasePointerCapture(ev.pointerId)
      divider.removeEventListener('pointermove', onMove)
      divider.removeEventListener('pointerup', end)
      divider.removeEventListener('pointercancel', end)
      if (dragged) onTreeChange(dragged)
      setDragTree(null)
    }
    divider.addEventListener('pointermove', onMove)
    divider.addEventListener('pointerup', end)
    divider.addEventListener('pointercancel', end)
  }

  const renderNode = (node: MosaicNode, path: MosaicPath): React.ReactNode => {
    if (node.kind === 'leaf') {
      const win = windows.find(w => w.id === node.id)
      return win ? renderPane(win) : null
    }
    const row = node.dir === 'row'
    return (
      <div style={{ display: 'flex', flexDirection: row ? 'row' : 'column', width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
        <div style={{ flex: `0 0 calc(${node.ratio * 100}% - ${DIVIDER / 2}px)`, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {renderNode(node.a, [...path, 'a'])}
        </div>
        <div
          onPointerDown={e => startDividerDrag(e, path, node.dir)}
          style={{
            flex: `0 0 ${DIVIDER}px`,
            cursor: row ? 'col-resize' : 'row-resize',
            backgroundColor: '#1a1a1a',
            touchAction: 'none'
          }}
        />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {renderNode(node.b, [...path, 'b'])}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', backgroundColor: '#111', padding: DIVIDER, boxSizing: 'border-box',
      // No text selection in the panes while one is being dragged.
      userSelect: draggingId ? 'none' : undefined
    }}>
      {maximizedWin ? (
        renderPane(maximizedWin)
      ) : windows.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#666', fontSize: '13px' }}>
          <span>No windows in this workspace yet.</span>
          <button onClick={onSpawnClick} style={{
            height: '30px', padding: '0 14px', borderRadius: '6px', border: '1px solid #444',
            backgroundColor: '#2a2a2a', color: '#4caf50', fontSize: '12px', cursor: 'pointer'
          }}>Spawn agent</button>
        </div>
      ) : shownTree ? (
        renderNode(shownTree, [])
      ) : null}
      {dropTarget && (() => {
        const p = previewRect(dropTarget.rect, dropTarget.edge)
        return (
          <div style={{
            position: 'fixed', left: p.left, top: p.top, width: p.width, height: p.height,
            background: 'rgba(70, 130, 255, 0.18)',
            border: '1px solid rgba(120, 170, 255, 0.75)',
            boxShadow: 'inset 0 0 0 1px rgba(180, 210, 255, 0.35)',
            pointerEvents: 'none', zIndex: 99997
          }} />
        )
      })()}
    </div>
  )
}
