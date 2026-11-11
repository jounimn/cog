import React from 'react'
import type { AgentStatus } from '../../shared/types'
import { StatusChip } from './StatusChip'

export interface PlateProps {
  title: string
  /** Data readout under the title, e.g. model name, path. Rendered in mono. */
  spec?: string[]
  status?: AgentStatus
  focused?: boolean
  accent?: { chrome?: string; border?: string }
  actions?: React.ReactNode
  children?: React.ReactNode
}

export function Plate({ title, spec, status, focused, accent, actions, children }: PlateProps): React.ReactElement {
  const style: React.CSSProperties = {}
  if (accent?.border) style.borderColor = accent.border
  const headStyle: React.CSSProperties | undefined = accent?.chrome ? { background: accent.chrome } : undefined
  return (
    <section className={focused ? 'cog-plate cog-plate--focused' : 'cog-plate'} style={style}>
      {focused && (
        <span className="cog-plate__ticks" aria-hidden="true">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
        </span>
      )}
      <header className="cog-plate__head" style={headStyle}>
        <div className="cog-plate__name">
          <h2>{title}</h2>
          {spec && spec.length > 0 && (
            <div className="cog-plate__spec">
              {spec.map((s, i) => <span key={i}>{s}</span>)}
            </div>
          )}
        </div>
        <span className="cog-plate__spacer" />
        {status && <StatusChip status={status} />}
        {actions && <div className="cog-plate__actions">{actions}</div>}
      </header>
      <div className="cog-plate__body">{children}</div>
    </section>
  )
}
