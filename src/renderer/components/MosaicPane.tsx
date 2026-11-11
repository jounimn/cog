import React from 'react'

export interface MosaicPaneProps {
  id: string
  title: string
  statusColor?: string
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

/** One tile of the Mosaic view: a FloatingWindow-style title bar over the window's content. */
export function MosaicPane({
  id, title, statusColor, linkedNames, focused, maximized,
  onFocus, onToggleMaximize, onClose, onHeaderPointerDown, dragging, children
}: MosaicPaneProps): React.ReactElement {
  const stop = (e: React.SyntheticEvent): void => e.stopPropagation()
  return (
    <div
      data-mosaic-leaf={id}
      onPointerDownCapture={onFocus}
      style={{
        ...paneStyle,
        border: `1px solid ${focused ? FOCUS_COLOR : '#333'}`
      }}
    >
      <div style={dragging ? { ...headerStyle, opacity: 0.5 } : headerStyle} onDoubleClick={onToggleMaximize} onPointerDown={onHeaderPointerDown}>
        {statusColor && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor, marginRight: 8, flexShrink: 0 }} />}
        <span style={titleStyle}>{title}</span>
        {linkedNames.length > 0 && (
          <span title={linkedNames.join(', ')} style={{ fontSize: '11px', color: '#8cc4ff', marginRight: 4, flexShrink: 0 }}>
            {`⇄ ${linkedNames.length}`}
          </span>
        )}
        <button
          onPointerDown={stop} onMouseDown={stop} onDoubleClick={stop}
          onClick={onToggleMaximize}
          title={maximized ? 'Restore' : 'Maximize'}
          style={btnStyle}
        >{maximized ? '❐' : '□'}</button>
        <button
          onPointerDown={stop} onMouseDown={stop} onDoubleClick={stop}
          onClick={onClose}
          title="Close"
          style={{ ...btnStyle, color: '#e55' }}
        >✕</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

const FOCUS_COLOR = '#4a9eff'

const paneStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  borderRadius: '6px',
  overflow: 'hidden',
  backgroundColor: '#0d0d0d'
}

const headerStyle: React.CSSProperties = {
  height: '32px',
  backgroundColor: '#1e1e1e',
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  userSelect: 'none',
  flexShrink: 0
}

const titleStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: '12px',
  color: '#ccc',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
}

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#888',
  cursor: 'pointer',
  padding: '0 6px',
  fontSize: '14px',
  lineHeight: '32px'
}
