import React from 'react'
import type { AgentStatus, AgentTheme } from '../../shared/types'
import { PlateHeader, PlateTicks, plateAccent } from './PlateHeader'
import { c } from '../ui'

export interface MosaicPaneProps {
  id: string
  /** The agent's name for agent panes: lets an agent pill be dropped here to link (like a canvas window). */
  agentName?: string
  title: string
  /** Agent cli and model, shown under the name. */
  spec?: string[]
  status?: AgentStatus
  /** The agent's theme; a non-default one tints the header and frame. */
  theme?: AgentTheme
  /** Agents linked to this one; the header shows `⇄ N`, names in the tooltip. */
  linkedNames: string[]
  focused: boolean
  maximized: boolean
  onFocus(): void
  onToggleMaximize(): void
  onClose(): void
  /** Header drag start (used to move panes between splits). */
  onHeaderPointerDown?(e: React.PointerEvent): void
  /** This pane is being dragged: its header is dimmed. */
  dragging?: boolean
  children: React.ReactNode
}

/** One tile of the Mosaic view: a FloatingWindow-style plate header over the window's content. */
export function MosaicPane({
  id, agentName, title, spec, status, theme, linkedNames, focused, maximized,
  onFocus, onToggleMaximize, onClose, onHeaderPointerDown, dragging, children
}: MosaicPaneProps): React.ReactElement {
  const accent = plateAccent(theme)
  return (
    <div
      data-mosaic-leaf={id}
      data-agent-name={agentName}
      onPointerDownCapture={onFocus}
      style={{
        ...paneStyle,
        border: `1px solid ${accent?.border ?? (focused ? c('steel') : c('line-strong'))}`
      }}
    >
      <PlateHeader
        title={title}
        spec={spec}
        status={status}
        focused={focused}
        accent={accent}
        maximized={maximized}
        onMaximize={onToggleMaximize}
        onClose={onClose}
        onDoubleClick={onToggleMaximize}
        onPointerDown={onHeaderPointerDown}
        style={dragging ? { opacity: 0.5 } : undefined}
        extra={linkedNames.length > 0 ? (
          <span title={linkedNames.join(', ')} style={{ fontSize: '11px', color: c('steel'), marginRight: 4, flexShrink: 0 }}>
            {`⇄ ${linkedNames.length}`}
          </span>
        ) : undefined}
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
      {focused && <PlateTicks inset />}
    </div>
  )
}

const paneStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  borderRadius: 'var(--r)',
  overflow: 'hidden',
  backgroundColor: c('surface')
}
