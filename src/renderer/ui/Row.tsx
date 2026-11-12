import React from 'react'

export interface RowProps {
  /** Icon column: an <Icon>, a status letter, or nothing. */
  icon?: React.ReactNode
  /** Mono data before the title (#14, a hash). */
  id?: React.ReactNode
  title: React.ReactNode
  /** Second line, left, in --ink-subtle. */
  meta?: React.ReactNode
  /** Second line, right (a status word, a time). */
  state?: React.ReactNode
  /** Controls at the right edge; their clicks do not reach onClick. */
  actions?: React.ReactNode
  selected?: boolean
  /** For a row that toggles a disclosure: sets aria-expanded, and `selected` stays visual only (no aria-pressed). */
  expanded?: boolean
  /** For a row in a list of places (a section list): the current one gets aria-current="true", and `selected` stays visual only. */
  current?: boolean
  /** Accessible name when the visible title alone does not carry the row's state. */
  ariaLabel?: string
  onClick?: () => void
  /** Native tooltip. */
  tooltip?: string
  className?: string
}

/** The list row from the Pinboard audition: icon, mono id, ellipsed title, a subtle second line. */
export function Row({
  icon, id, title, meta, state, actions, selected, expanded, current, ariaLabel, onClick, tooltip, className
}: RowProps): React.ReactElement {
  const cls = [
    'cog-row',
    onClick && 'cog-row--action',
    selected && 'cog-row--selected',
    className
  ].filter(Boolean).join(' ')
  const interactive = !!onClick
  return (
    <div
      className={cls}
      title={tooltip}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive && expanded === undefined && current === undefined && selected !== undefined ? selected : undefined}
      aria-current={current ? 'true' : undefined}
      aria-expanded={interactive ? expanded : undefined}
      aria-label={ariaLabel}
      onKeyDown={interactive ? (e) => {
        // Only the row itself: a focused action inside handles its own keys.
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      } : undefined}
    >
      {icon != null && <span className="cog-row__icon">{icon}</span>}
      {id != null && <span className="cog-row__id">{id}</span>}
      <span className="cog-row__title">{title}</span>
      {actions != null && (
        <span className="cog-row__actions" onClick={(e) => e.stopPropagation()}>{actions}</span>
      )}
      {(meta != null || state != null) && (
        <span className="cog-row__line2">
          <span className="cog-row__meta">{meta}</span>
          {state != null && <span className="cog-row__state">{state}</span>}
        </span>
      )}
    </div>
  )
}
