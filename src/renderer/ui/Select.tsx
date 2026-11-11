import React from 'react'

export interface SelectProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  id?: string
}

export function Select<T extends string>({ value, options, onChange, id }: SelectProps<T>): React.ReactElement {
  return (
    <span className="cog-select">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {/* Lucide chevron-down; not part of IconName, so drawn here */}
      <svg
        className="cog-select__chev"
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}
