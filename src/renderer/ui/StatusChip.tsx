import React from 'react'
import type { AgentStatus } from '../../shared/types'
import { statusPresentation } from '../status-chip'
import { Icon } from './Icon'

export function StatusChip({ status }: { status: AgentStatus }): React.ReactElement {
  const p = statusPresentation(status)
  return (
    <span className={`cog-chip cog-chip--${p.tone}`} data-status={status}>
      {p.breathing ? (
        <span className="cog-chip__dot" data-anim="breathe" aria-hidden="true" />
      ) : (
        <Icon name={p.icon} size={14} />
      )}
      <span>{p.label}</span>
    </span>
  )
}
