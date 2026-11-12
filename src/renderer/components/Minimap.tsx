import React, { useRef } from 'react'
import { c, font } from '../ui'
import { visibleRange } from '../ruler'
import { worldBounds, toMinimap, minimapClickToPan, type MinimapMap } from '../minimap-math'
import type { WindowState } from '../hooks/useWindowManager'

const MAP_W = 160
const MAP_H = 112

interface MinimapProps {
  windows: WindowState[]
  /** Links as agent-name pairs, with the name -> window id lookup needed to place them. */
  links: Array<{ from: string; to: string }>
  agents: Array<{ id: string; name: string }>
  focusedWindowId?: string
  zoom: number
  pan: { x: number; y: number }
  viewportWidth: number
  viewportHeight: number
  sheetName: string
  onSetPan: (x: number, y: number) => void
}

/** The canvas minimap, drawn as the sheet's title block. */
export function Minimap({
  windows, links, agents, focusedWindowId, zoom, pan, viewportWidth, viewportHeight, sheetName, onSetPan
}: MinimapProps): React.ReactElement {
  const dragging = useRef(false)
  // The map is frozen for the length of a drag: its bounds include the moving view rect.
  const dragMap = useRef<MinimapMap | null>(null)
  const visible = windows.filter(w => !w.minimized)
  const view = visibleRange(zoom, pan, viewportWidth, viewportHeight)
  const m = toMinimap(worldBounds(visible, view), MAP_W, MAP_H)
  const sx = (v: number) => v * m.scale + m.ox
  const sy = (v: number) => v * m.scale + m.oy

  const rectOf = (name: string) => {
    const agent = agents.find(a => a.name === name)
    return agent ? visible.find(w => w.id === agent.id) : undefined
  }

  const panTo = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const p = minimapClickToPan({ x: e.clientX - box.left, y: e.clientY - box.top }, dragMap.current ?? m, zoom, viewportWidth, viewportHeight)
    onSetPan(p.x, p.y)
  }

  const cell: React.CSSProperties = { padding: '4px 8px 5px' }
  const label: React.CSSProperties = { fontFamily: font.text, fontSize: 11, color: c('ink-subtle'), marginBottom: 3 }
  const value: React.CSSProperties = { margin: 0, fontFamily: font.text, fontSize: 12, fontWeight: 500, color: c('ink'), whiteSpace: 'nowrap' }

  return (
    <div
      style={{
        position: 'absolute', right: 12, bottom: 12, zIndex: 99999, width: 162,
        background: c('surface'), border: `1px solid ${c('line-strong')}`, borderRadius: 2, userSelect: 'none'
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <svg
        width={MAP_W}
        height={MAP_H}
        role="img"
        aria-label={`Minimap of ${visible.length} ${visible.length === 1 ? 'window' : 'windows'}`}
        style={{ display: 'block', background: c('surface-sunk'), borderBottom: `1px solid ${c('line-strong')}`, cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={e => {
          e.stopPropagation()
          dragging.current = true
          dragMap.current = m
          e.currentTarget.setPointerCapture(e.pointerId)
          panTo(e)
        }}
        onPointerMove={e => { if (dragging.current) panTo(e) }}
        onPointerUp={e => {
          dragging.current = false
          dragMap.current = null
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => { dragging.current = false; dragMap.current = null }}
        onLostPointerCapture={() => { dragging.current = false; dragMap.current = null }}
      >
        {links.map((l, i) => {
          const a = rectOf(l.from)
          const b = rectOf(l.to)
          if (!a || !b) return null
          return (
            <line
              key={`${l.from}>${l.to}>${i}`}
              x1={sx(a.x + a.width / 2)} y1={sy(a.y + a.height / 2)}
              x2={sx(b.x + b.width / 2)} y2={sy(b.y + b.height / 2)}
              stroke={c('steel')} strokeWidth={1}
            />
          )
        })}
        {visible.map(w => (
          <rect
            key={w.id}
            x={sx(w.x)} y={sy(w.y)} width={w.width * m.scale} height={w.height * m.scale}
            fill={c('surface-muted')}
            stroke={w.id === focusedWindowId ? c('ink') : c('ink-subtle')}
            strokeWidth={1}
          />
        ))}
        <rect
          x={sx(view.x0)} y={sy(view.y0)} width={(view.x1 - view.x0) * m.scale} height={(view.y1 - view.y0) * m.scale}
          fill="none" stroke={c('ink-muted')} strokeWidth={1.25} strokeDasharray="4 3"
        />
      </svg>
      <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', margin: 0 }}>
        <div style={cell}>
          <dt style={label}>Sheet</dt>
          <dd style={{ ...value, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sheetName}</dd>
        </div>
        <div style={{ ...cell, borderLeft: `1px solid ${c('line-strong')}` }}>
          <dt style={label}>Scale</dt>
          <dd style={{ ...value, fontFamily: font.mono }}>{`1:${Math.max(1, Math.round(1 / m.scale))}`}</dd>
        </div>
      </dl>
    </div>
  )
}
