import React, { useEffect, useRef } from 'react'
import { MosaicPane } from './MosaicPane'
import { renderWindowContent, windowAgent, windowStatusColor, windowTitle } from './window-content'
import { setRatio, type MosaicNode, type MosaicPath } from '../mosaic-tree'
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
  // Latest tree for divider drags, which fire faster than re-renders.
  const treeRef = useRef(tree)
  treeRef.current = tree

  const maximizedWin = maximizedId ? windows.find(w => w.id === maximizedId) : undefined

  // Escape restores a maximized pane.
  const isMaximized = maximizedWin !== undefined
  useEffect(() => {
    if (!isMaximized) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onMaximize(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isMaximized, onMaximize])

  const renderPane = (win: WindowState): React.ReactElement => {
    const agent = windowAgent(win, agents)
    const maximized = win.id === maximizedId
    return (
      <MosaicPane
        key={win.id}
        id={win.id}
        title={windowTitle(win, agents)}
        statusColor={windowStatusColor(win, agents)}
        linkedNames={agent ? linkedAgentNames(agent, agents, links) : []}
        focused={win.id === focusedId}
        maximized={maximized}
        onFocus={() => { if (win.id !== focusedId) onFocus(win.id) }}
        onToggleMaximize={() => onMaximize(maximized ? null : win.id)}
        onClose={() => onClose(win.id)}
      >
        {renderWindowContent(win, { agents, tabs, activeTabId })}
      </MosaicPane>
    )
  }

  const startDividerDrag = (e: React.PointerEvent<HTMLDivElement>, path: MosaicPath, dir: 'row' | 'col'): void => {
    const divider = e.currentTarget
    const container = divider.parentElement
    if (!container) return
    e.preventDefault()
    divider.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
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
        onTreeChange(next)
      }
    }
    const end = (ev: PointerEvent): void => {
      if (divider.hasPointerCapture(ev.pointerId)) divider.releasePointerCapture(ev.pointerId)
      divider.removeEventListener('pointermove', move)
      divider.removeEventListener('pointerup', end)
      divider.removeEventListener('pointercancel', end)
    }
    divider.addEventListener('pointermove', move)
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
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', backgroundColor: '#111', padding: DIVIDER, boxSizing: 'border-box' }}>
      {maximizedWin ? (
        renderPane(maximizedWin)
      ) : tree === null || windows.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#666', fontSize: '13px' }}>
          <span>No windows in this workspace yet.</span>
          <button onClick={onSpawnClick} style={{
            height: '30px', padding: '0 14px', borderRadius: '6px', border: '1px solid #444',
            backgroundColor: '#2a2a2a', color: '#4caf50', fontSize: '12px', cursor: 'pointer'
          }}>Spawn agent</button>
        </div>
      ) : (
        renderNode(tree, [])
      )}
    </div>
  )
}
