import React from 'react'
import { Icon } from './Icon'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  children?: React.ReactNode
  disabled?: boolean
  id?: string
  className?: string
  title?: string
}

/** Native checkbox (keyboard and form semantics intact) under a drawn 16px box. */
export function Checkbox({ checked, onChange, children, disabled, id, className, title }: CheckboxProps): React.ReactElement {
  const cls = ['cog-check', disabled && 'cog-check--disabled', className].filter(Boolean).join(' ')
  return (
    <label className={cls} title={title}>
      <input
        id={id}
        type="checkbox"
        className="cog-check__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="cog-check__box" aria-hidden="true">
        <Icon name="check" size={12} />
      </span>
      {children != null && <span className="cog-check__label">{children}</span>}
    </label>
  )
}
