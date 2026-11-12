import React from 'react'

export interface ToolbarProps {
  /** Left: search, filter, the thing the panel is scoped to. */
  children?: React.ReactNode
  /** Right: the panel's actions. */
  actions?: React.ReactNode
  label?: string
}

/** The 32px strip at the top of a panel. */
export function Toolbar({ children, actions, label }: ToolbarProps): React.ReactElement {
  return (
    <div className="cog-toolbar" role="toolbar" aria-label={label}>
      <div className="cog-toolbar__left">{children}</div>
      {actions != null && <div className="cog-toolbar__right">{actions}</div>}
    </div>
  )
}

/** A section title inside a panel: Plex Sans 600 12px, sentence case, with an optional count and actions. */
export function SectionHeader({ children, count, actions }: {
  children: React.ReactNode
  count?: number
  actions?: React.ReactNode
}): React.ReactElement {
  return (
    <div className="cog-section">
      <h3 className="cog-section__title">
        {children}
        {count !== undefined && <span className="cog-section__count">{count}</span>}
      </h3>
      {actions != null && <div className="cog-section__actions">{actions}</div>}
    </div>
  )
}
