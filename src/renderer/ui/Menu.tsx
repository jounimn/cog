import React, { useEffect, useRef } from 'react'
import { Icon, type IconName } from './Icon'
import { menuNavIndex } from './menu-nav'

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])'

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return menu ? Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) : []
}

export interface MenuProps {
  open: boolean
  onClose: () => void
  /** The button that opens the menu; focus returns to it on Escape. */
  anchorRef: React.RefObject<HTMLElement | null>
  label: string
  align?: 'left' | 'right'
  /** Close on a mouse press outside the menu and its button (default true). */
  closeOnOutside?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Popover menu under its button. Keyboard: arrows/Home/End move between items,
 * Enter activates (native button), Escape closes and returns focus to the button.
 * Callers place the button and the Menu inside one `.cog-menu-wrap`.
 */
export function Menu({
  open, onClose, anchorRef, label, align = 'left', closeOnOutside = true, className, children
}: MenuProps): React.ReactElement | null {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const closeToAnchor = () => {
    onCloseRef.current()
    anchorRef.current?.focus()
  }

  // Outside press closes; the anchor is excluded so its own click can toggle.
  useEffect(() => {
    if (!open || !closeOnOutside) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return
      onCloseRef.current()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closeOnOutside, anchorRef])

  // From the button: arrows enter the menu, Escape closes it.
  useEffect(() => {
    const anchor = anchorRef.current
    if (!open || !anchor) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCloseRef.current(); return }
      const items = menuItems(ref.current)
      const next = menuNavIndex(e.key, -1, items.length)
      if (next !== null && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); items[next].focus() }
    }
    anchor.addEventListener('keydown', handler)
    return () => anchor.removeEventListener('keydown', handler)
  }, [open, anchorRef])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeToAnchor(); return }
    if (e.key === 'Tab') { onCloseRef.current(); return }
    const items = menuItems(ref.current)
    const next = menuNavIndex(e.key, items.indexOf(document.activeElement as HTMLElement), items.length)
    if (next !== null) { e.preventDefault(); items[next].focus() }
  }

  const cls = ['cog-menu', align === 'right' && 'cog-menu--right', className].filter(Boolean).join(' ')
  return (
    <div ref={ref} role="menu" aria-label={label} className={cls} data-anim="fade" onKeyDown={onKeyDown}>
      {children}
    </div>
  )
}

export interface MenuItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'role'> {
  icon?: IconName
  /** Present (true/false) for a toggle row: a check marks it on. */
  checked?: boolean
  /** Trailing content, e.g. a count chip. */
  trailing?: React.ReactNode
  tone?: 'danger' | 'success'
}

export function MenuItem({
  icon, checked, trailing, tone, className, children, type = 'button', ...rest
}: MenuItemProps): React.ReactElement {
  const toggle = checked !== undefined
  const cls = ['cog-menu__item', tone && `cog-tone-${tone}`, className].filter(Boolean).join(' ')
  return (
    <button
      type={type}
      role={toggle ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={toggle ? checked : undefined}
      className={cls}
      {...rest}
    >
      {toggle && <span className="cog-menu__check" aria-hidden="true">{checked && <Icon name="check" size={14} />}</span>}
      {icon && <Icon name={icon} size={15} />}
      <span className="cog-menu__label">{children}</span>
      {trailing}
    </button>
  )
}

export function MenuSeparator(): React.ReactElement {
  return <div className="cog-menu__sep" role="separator" />
}
