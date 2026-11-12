/** The Settings dialog's sections, in the order the body shows them (the left list jumps to each). */
export const SETTINGS_SECTIONS = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'agents', label: 'Agents' },
  { id: 'themes', label: 'Themes' },
  { id: 'remote', label: 'Remote view' },
  { id: 'telegram', label: 'Telegram bot' },
  { id: 'autonomy', label: 'Agent autonomy' },
  { id: 'streamdeck', label: 'Stream Deck' }
] as const

export type SettingsSectionId = typeof SETTINGS_SECTIONS[number]['id']

export const SETTINGS_SECTION_ORDER: readonly SettingsSectionId[] = SETTINGS_SECTIONS.map(s => s.id)

/** True when a scroller that overflows has reached its bottom (within a 2px tolerance). */
export function isScrolledToEnd(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  if (scrollHeight <= clientHeight + 2) return false
  return scrollTop + clientHeight >= scrollHeight - 2
}

/**
 * The section to highlight in the list: the last one when the body is scrolled to its end
 * (a short last section never reaches the top band), else the first in order that is in
 * view, else the current one unchanged.
 */
export function pickActiveSection<T extends string>(
  order: readonly T[],
  visible: ReadonlySet<string>,
  current: T,
  atEnd = false
): T {
  if (atEnd && order.length > 0) return order[order.length - 1]
  for (const id of order) if (visible.has(id)) return id
  return current
}
