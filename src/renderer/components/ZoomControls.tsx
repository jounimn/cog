import React from 'react'
import { Button, Icon, c, font } from '../ui'

interface ZoomControlsProps {
  zoom: number
  /** Visible world range, shown beside the zoom readout. */
  range: { x0: number; x1: number; y0: number; y1: number }
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFitAll: () => void
}

/** Fit and 1:1 sit in the bar without frames of their own, as in the audition's .zoombar. */
const borderless: React.CSSProperties = { borderColor: 'transparent' }

const num = (n: number): string => String(n).replace('-', '−')

export function ZoomControls({ zoom, range, onZoomIn, onZoomOut, onReset, onFitAll }: ZoomControlsProps): React.ReactElement {
  const sep = <span aria-hidden="true" style={{ width: 1, height: 22, margin: '0 3px', flex: 'none', background: c('line') }} />
  return (
    <div
      role="toolbar"
      aria-label="Zoom"
      style={{
        position: 'absolute', left: 40, bottom: 12, zIndex: 99999,
        display: 'flex', alignItems: 'center', gap: 2, height: 38, padding: '0 3px',
        background: c('surface'), border: `1px solid ${c('line-strong')}`, borderRadius: 'var(--r)',
        userSelect: 'none'
      }}
    >
      <Button variant="icon" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out"><Icon name="minus" /></Button>
      <output
        aria-live="polite"
        style={{ minWidth: 58, textAlign: 'center', font: `800 16px/1 ${font.instrument}`, color: c('ink'), letterSpacing: '0.03em' }}
      >
        {Math.round(zoom * 100)}%
      </output>
      <Button variant="icon" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in"><Icon name="plus" /></Button>
      {sep}
      <Button onClick={onFitAll} title="Fit all (Ctrl+Shift+0)" style={borderless}><Icon name="scan" size={14} />Fit</Button>
      <Button onClick={onReset} title="Reset zoom (Ctrl+0)" style={borderless}>1:1</Button>
      {sep}
      <span
        aria-label="Visible range"
        style={{ padding: '0 8px', font: `400 11px/1 ${font.mono}`, color: c('ink-subtle'), whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
      >
        {`x ${num(range.x0)}…${num(range.x1)}  y ${num(range.y0)}…${num(range.y1)}`}
      </span>
    </div>
  )
}
