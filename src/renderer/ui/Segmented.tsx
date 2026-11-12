import React from 'react'
import { Icon, type IconName } from './Icon'

export interface SegmentedOption<T extends string> {
  value: T
  /** Usually text; a node lets a caller mark a part that may truncate. */
  label: React.ReactNode
  icon?: IconName
  disabled?: boolean
}

export interface SegmentedProps<T extends string> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel
}: SegmentedProps<T>): React.ReactElement {
  return (
    <div className="cog-seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="cog-seg__item"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
