import type { ITheme } from '@xterm/xterm'
import type { AgentTheme } from '../shared/types'
import { DEFAULT_THEME, resolveTheme } from './themes'
import { PALETTES } from './palettes'
import type { Palette } from './palettes'

export { PALETTES }
export type { Palette }

export type FontId = 'cascadia' | 'jetbrains' | 'plex' | 'fira' | 'ubuntu'
export type PaletteId = 'graphite' | 'paper' | 'phosphor' | 'harbor' | 'ember' | 'moss'

export interface Appearance {
  font: FontId
  size: number
  palette: PaletteId
}

export interface AppearanceSettings {
  global: Appearance
  /** Keyed by agent name; entries override only the fields they carry. */
  perAgent: Record<string, Partial<Appearance>>
}

export const DEFAULT_APPEARANCE: Appearance = { font: 'cascadia', size: 13, palette: 'graphite' }

const FALLBACK = ', "IBM Plex Mono", monospace'

/** Font stack for a face: the system name first, then an optional vendored copy, then the shared fallback. */
export function fontStack(name: string, bundledName?: string): string {
  return `"${name}"` + (bundledName ? `, "${bundledName}"` : '') + FALLBACK
}

/** `document.fonts.load` specs for every quoted family in a stack. */
export function fontLoadSpecs(family: string, size: number): string[] {
  return [...family.matchAll(/"([^"]+)"/g)].map(m => `${size}px "${m[1]}"`)
}

export const FONTS: { id: FontId; label: string; family: string }[] = [
  { id: 'cascadia', label: 'Cascadia Code', family: fontStack('Cascadia Code', 'Cascadia Code Bundled') },
  { id: 'jetbrains', label: 'JetBrains Mono', family: '"JetBrains Mono"' + FALLBACK },
  { id: 'plex', label: 'IBM Plex Mono', family: '"IBM Plex Mono"' + FALLBACK },
  { id: 'fira', label: 'Fira Code', family: '"Fira Code"' + FALLBACK },
  { id: 'ubuntu', label: 'Ubuntu Mono', family: '"Ubuntu Mono"' + FALLBACK }
]

const MIN_SIZE = 10
const MAX_SIZE = 20

const isFontId = (v: unknown): v is FontId => FONTS.some(f => f.id === v)
const isPaletteId = (v: unknown): v is PaletteId => PALETTES.some(p => p.id === v)
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function cleanSize(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(v)))
}

function cleanPartial(raw: unknown): Partial<Appearance> {
  const out: Partial<Appearance> = {}
  if (!isRecord(raw)) return out
  if (isFontId(raw.font)) out.font = raw.font
  const size = cleanSize(raw.size)
  if (size !== undefined) out.size = size
  if (isPaletteId(raw.palette)) out.palette = raw.palette
  return out
}

/** Coerce untrusted persisted data into valid settings. */
export function sanitizeSettings(raw: unknown): AppearanceSettings {
  const src = isRecord(raw) ? raw : {}
  const perAgent: Record<string, Partial<Appearance>> = {}
  if (isRecord(src.perAgent)) {
    for (const [name, entry] of Object.entries(src.perAgent)) perAgent[name] = cleanPartial(entry)
  }
  return { global: { ...DEFAULT_APPEARANCE, ...cleanPartial(src.global) }, perAgent }
}

function paletteToXterm(p: Palette, background: string, foreground: string): ITheme {
  const [black, red, green, yellow, blue, magenta, cyan, white,
    brightBlack, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite] = p.ansi
  return {
    background,
    foreground,
    cursor: p.cursor,
    selectionBackground: p.selection,
    black, red, green, yellow, blue, magenta, cyan, white,
    brightBlack, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite
  }
}

/**
 * Colour precedence: (1) a per-agent palette; (2) a non-default agent theme's
 * bg/text over the global palette's ANSI set; (3) the global palette.
 */
export function resolveAppearance(
  s: AppearanceSettings,
  agentName: string,
  agentTheme?: AgentTheme
): { fontFamily: string; fontSize: number; xterm: ITheme } {
  const own = Object.prototype.hasOwnProperty.call(s.perAgent, agentName) ? s.perAgent[agentName] : {}
  const eff: Appearance = { ...s.global, ...own }
  const font = FONTS.find(f => f.id === eff.font) ?? FONTS[0]
  const palette = PALETTES.find(p => p.id === eff.palette) ?? PALETTES[0]

  let bg = palette.bg
  let fg = palette.fg
  if (!own.palette) {
    const t = resolveTheme(agentTheme)
    if (t.bg !== DEFAULT_THEME.bg || t.text !== DEFAULT_THEME.text) {
      bg = t.bg
      fg = t.text
    }
  }
  return { fontFamily: font.family, fontSize: eff.size, xterm: paletteToXterm(palette, bg, fg) }
}
