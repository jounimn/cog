import React from 'react'
import { Icon } from './Icon'

export interface StepperProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  ariaLabel: string
}

export function Stepper({ value, min, max, onChange, ariaLabel }: StepperProps): React.ReactElement {
  return (
    <div className="cog-stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="cog-stepper__btn"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon name="minus" size={14} />
      </button>
      <output className="cog-stepper__value" aria-live="polite">{value}</output>
      <button
        type="button"
        className="cog-stepper__btn"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  )
}
