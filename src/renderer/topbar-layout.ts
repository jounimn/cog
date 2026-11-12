/** Window widths below which the top bar drops labels (spec: surfaces/topbar.md, "Narrow windows"). */
export const TOPBAR_COMPACT_BELOW = 1440
export const TOPBAR_NARROW_BELOW = 1280

export interface TopbarLabels {
  presets: boolean
  help: boolean
  panels: boolean
  appearance: boolean
}

/**
 * Which right-hand controls keep their word at a given window width.
 * Spawn agent and Agents always keep theirs, so they are not listed.
 * Icon-only controls keep the word as their tooltip and accessible name.
 */
export function topbarLabels(width: number): TopbarLabels {
  const compact = width < TOPBAR_COMPACT_BELOW
  const narrow = width < TOPBAR_NARROW_BELOW
  return {
    presets: !compact,
    help: !compact,
    panels: !narrow,
    appearance: !narrow
  }
}
