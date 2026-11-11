import React from 'react'
import type { AgentStatus, AgentTheme } from '../../shared/types'
import { DEFAULT_THEME, resolveTheme } from '../themes'
import { Button, Icon, StatusChip, c } from '../ui'

export interface PlateAccent {
  chrome: string
  border: string
}

/**
 * The per-agent theme's header and frame tint. Only a non-default theme tints the plate; the
 * default theme leaves it in the drafting-board tokens.
 */
export function plateAccent(theme: AgentTheme | undefined): PlateAccent | undefined {
  const r = resolveTheme(theme)
  const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
  if (same(r.chrome, DEFAULT_THEME.chrome) && same(r.border, DEFAULT_THEME.border)) return undefined
  return { chrome: r.chrome, border: r.border }
}

/** The focused plate's four hint corner ticks. `inset` keeps them inside the frame (tiled panes). */
export function PlateTicks({ inset }: { inset?: boolean }): React.ReactElement {
  return (
    <span className="cog-plate__ticks" aria-hidden="true">
      <i className="tl" style={inset ? { left: 0, top: 0 } : undefined} />
      <i className="tr" style={inset ? { right: 0, top: 0 } : undefined} />
      <i className="bl" style={inset ? { left: 0, bottom: 0 } : undefined} />
      <i className="br" style={inset ? { right: 0, bottom: 0 } : undefined} />
    </span>
  )
}

/** One part of the spec line; `mono` marks data (a model name). */
export interface PlateSpec { text: string; mono?: boolean }

export interface PlateHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string
  /** Data readout under the name (cli, model). Empty parts are omitted. */
  spec?: PlateSpec[]
  status?: AgentStatus
  focused?: boolean
  accent?: PlateAccent
  maximized?: boolean
  onMaximize: () => void
  onClose: () => void
  /** Extra controls (minimize, link count) shown before maximize and close. */
  extra?: React.ReactNode
}

const stop = (e: React.SyntheticEvent): void => e.stopPropagation()

/** The title bar shared by canvas windows and mosaic panes. Extra props go to the bar itself. */
export function PlateHeader({
  title, spec, status, focused, accent, maximized, onMaximize, onClose, extra, style, className, ...bar
}: PlateHeaderProps): React.ReactElement {
  const parts = (spec ?? []).filter(p => !!p.text)
  const cls = ['cog-plate__head', className].filter(Boolean).join(' ')
  return (
    <header
      {...bar}
      className={cls}
      data-focused={focused ? 'true' : undefined}
      style={{
        cursor: 'grab',
        userSelect: 'none',
        borderRadius: 0,
        ...(accent ? { background: accent.chrome, borderBottomColor: accent.border } : null),
        ...style
      }}
    >
      <div className="cog-plate__name" style={{ flex: 1 }}>
        <h2 title={title}>{title}</h2>
        {parts.length > 0 && (
          <div className="cog-plate__spec" style={{ fontFamily: 'var(--font-text)' }}>
            {parts.map((p, i) => (
              <span key={i} style={p.mono ? { fontFamily: 'var(--font-mono)' } : undefined}>{p.text}</span>
            ))}
          </div>
        )}
      </div>
      {status && <StatusChip status={status} />}
      <div
        className="cog-plate__actions"
        onPointerDown={stop} onMouseDown={stop} onDoubleClick={stop}
        style={{ color: c('ink-muted'), cursor: 'default' }}
      >
        {extra}
        <Button
          variant="icon" className="cog-btn--ghost"
          onClick={onMaximize}
          title={maximized ? 'Restore' : 'Maximize'}
          aria-label={maximized ? 'Restore' : 'Maximize'}
        ><Icon name={maximized ? 'minimize' : 'maximize'} size={14} /></Button>
        <Button
          variant="icon" className="cog-btn--ghost"
          onClick={onClose}
          title="Close"
          aria-label="Close"
        ><Icon name="x" size={14} /></Button>
      </div>
    </header>
  )
}
