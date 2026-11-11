import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'icon' | 'hint'
  pressed?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', pressed, className, type = 'button', ...rest },
  ref
) {
  const cls = ['cog-btn', variant !== 'default' && `cog-btn--${variant}`, className].filter(Boolean).join(' ')
  return <button ref={ref} type={type} className={cls} aria-pressed={pressed} {...rest} />
})
