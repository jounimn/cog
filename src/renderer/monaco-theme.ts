/** "R G B" channel token → Monaco's colour string, read from the live CSS tokens (no literals here). */
export function channelsToHex(channels: string): string | null {
  const parts = channels.trim().split(/\s+/).map(Number)
  if (parts.length < 3 || parts.slice(0, 3).some(n => !Number.isFinite(n))) return null
  return '#' + parts.slice(0, 3).map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')
}

