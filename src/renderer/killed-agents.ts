// Text and formatting for the kill confirmation and the Killed list.

/** Confirmation shown before a kill from the window's X or the Agents menu. */
export function killConfirmText(name: string): string {
  return `Kill "${name}"?\n\nIt can be restored later from Agents → Killed; a Claude session resumes where it was.`
}

/** "14:05" when killed today, "22/10 14:05" otherwise (local time). */
export function formatKilledAt(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (sameDay) return hm
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`
}
