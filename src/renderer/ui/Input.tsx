import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Plex Mono, for values that are data (branch names, paths, ids). */
  mono?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono, className, type = 'text', ...rest },
  ref
) {
  const cls = ['cog-input', mono && 'cog-input--mono', className].filter(Boolean).join(' ')
  return <input ref={ref} type={type} className={cls} {...rest} />
})

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { mono, className, ...rest },
  ref
) {
  const cls = ['cog-input', 'cog-textarea', mono && 'cog-input--mono', className].filter(Boolean).join(' ')
  return <textarea ref={ref} className={cls} {...rest} />
})
