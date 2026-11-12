import React, { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { Button } from './Button'

export type DialogSize = 'sm' | 'md' | 'lg'

export interface DialogProps {
  title: React.ReactNode
  icon?: IconName
  /** sm 440 / md 560 / lg 760. */
  size?: DialogSize
  /** Shows the header close (x) and is what Escape / backdrop call when enabled. Omit for no close button. */
  onClose?: () => void
  /** Right side of the footer: Cancel (ghost) then the single primary. */
  footer?: React.ReactNode
  /** Left side of the footer: destructive actions, or a status line. */
  footerStart?: React.ReactNode
  /** Extra header content before the close button (a sha range, a count). */
  headerExtra?: React.ReactNode
  /** The dialog's own existing behaviour, passed in: the shell adds none by default. */
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  /** When set, the plate is a <form> so footer submit buttons and Enter submit it. */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  /** Keeps each dialog's existing stacking order. */
  zIndex?: number
  /** Opaque --canvas ground instead of the 70% veil (the full-screen project picker). */
  opaque?: boolean
  bodyClassName?: string
  className?: string
  children?: React.ReactNode
}

/** The dialog shell: backdrop, plate, 44px header, scrolling body, fixed footer. */
export function Dialog({
  title, icon, size = 'md', onClose, footer, footerStart, headerExtra,
  closeOnBackdrop = false, closeOnEscape = false, onSubmit, zIndex, opaque,
  bodyClassName, className, children
}: DialogProps): React.ReactElement {
  const titleId = useId()

  useEffect(() => {
    if (!closeOnEscape || !onClose) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeOnEscape, onClose])

  const plateCls = ['cog-dialog', `cog-dialog--${size}`, className].filter(Boolean).join(' ')
  const inner = (
    <>
      <header className="cog-dialog__head">
        {icon && <span className="cog-dialog__icon"><Icon name={icon} size={16} /></span>}
        <h2 id={titleId} className="cog-dialog__title">{title}</h2>
        {headerExtra != null && <span className="cog-dialog__extra">{headerExtra}</span>}
        {onClose && (
          <Button variant="icon" onClick={onClose} aria-label="Close" title="Close">
            <Icon name="x" size={16} />
          </Button>
        )}
      </header>
      <div className={['cog-dialog__body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
      {(footer != null || footerStart != null) && (
        <footer className="cog-dialog__foot">
          <div className="cog-dialog__foot-start">{footerStart}</div>
          <div className="cog-dialog__foot-end">{footer}</div>
        </footer>
      )}
    </>
  )
  const a11y = { role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId } as const

  // Portal to <body>: a dialog opened from a panel on the canvas would otherwise
  // sit inside the canvas transform and scale with the zoom (position: fixed
  // resolves against a transformed ancestor). React events still bubble to the owner.
  return createPortal(
    <div
      className={opaque ? 'cog-modal-backdrop cog-modal-backdrop--opaque' : 'cog-modal-backdrop'}
      style={zIndex !== undefined ? { zIndex } : undefined}
      onClick={closeOnBackdrop && onClose ? (e) => { if (e.target === e.currentTarget) onClose() } : undefined}
    >
      {onSubmit
        ? <form className={plateCls} data-anim {...a11y} onSubmit={onSubmit}>{inner}</form>
        : <div className={plateCls} data-anim {...a11y}>{inner}</div>}
    </div>,
    document.body
  )
}

/** A labelled field: label above, help below in --ink-subtle, error below in --danger with an icon. */
export function Field({ label, help, error, children, className }: {
  label: React.ReactNode
  help?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactNode
  className?: string
}): React.ReactElement {
  return (
    <label className={['cog-field', className].filter(Boolean).join(' ')}>
      <span className="cog-field__label">{label}</span>
      {children}
      {help != null && help !== '' && <span className="cog-field__hint">{help}</span>}
      {error && <FieldError>{error}</FieldError>}
    </label>
  )
}

export function FieldError({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="cog-field__error" role="alert">
      <Icon name="circle-alert" size={12} />{children}
    </span>
  )
}
