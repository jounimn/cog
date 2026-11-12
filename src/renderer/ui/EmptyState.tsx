import React from 'react'
import { Icon, type IconName } from './Icon'

export interface EmptyStateProps {
  icon: IconName
  /** One sentence: what will appear here and how. */
  children: React.ReactNode
  action?: React.ReactNode
  /** One left-aligned line, for an empty section inside a list. */
  compact?: boolean
}

export function EmptyState({ icon, children, action, compact }: EmptyStateProps): React.ReactElement {
  return (
    <div className={compact ? 'cog-empty cog-empty--compact' : 'cog-empty'}>
      <span className="cog-empty__icon"><Icon name={icon} size={compact ? 14 : 20} /></span>
      <p className="cog-empty__text">{children}</p>
      {action && <div className="cog-empty__action">{action}</div>}
    </div>
  )
}

/** The loading state: one line, no spinner. */
export function Loading({ children = 'Loading…' }: { children?: React.ReactNode }): React.ReactElement {
  return <div className="cog-loading" role="status">{children}</div>
}
