import { describe, it, expect } from 'vitest'
import {
  DEFAULT_APPEARANCE, FONTS, PALETTES, resolveAppearance, sanitizeSettings
} from './terminal-appearance'
import type { AppearanceSettings } from './terminal-appearance'
import { DEFAULT_THEME, THEME_PRESETS } from './themes'

const ocean = THEME_PRESETS.find(p => p.id === 'ocean')!.theme
const base: AppearanceSettings = { global: DEFAULT_APPEARANCE, perAgent: {} }
const ember = PALETTES.find(p => p.id === 'ember')!
const graphite = PALETTES[0]

function lum(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('sanitizeSettings', () => {
  it('defaults for undefined', () => {
    expect(sanitizeSettings(undefined)).toEqual({ global: DEFAULT_APPEARANCE, perAgent: {} })
  })
  it('clamps and rejects invalid global values', () => {
    expect(sanitizeSettings({ global: { size: 99, palette: 'nope', font: 7 } }).global)
      .toEqual({ font: 'cascadia', size: 20, palette: 'graphite' })
    expect(sanitizeSettings({ global: { size: 3 } }).global.size).toBe(10)
  })
  it('keeps only valid per-agent fields', () => {
    expect(sanitizeSettings({ perAgent: { a: { size: 'x', palette: 'ember' } } }).perAgent.a)
      .toEqual({ palette: 'ember' })
  })
})

describe('resolveAppearance', () => {
  it('per-agent palette beats agent theme', () => {
    const s = { ...base, perAgent: { backend: { palette: 'ember' as const } } }
    expect(resolveAppearance(s, 'backend', ocean).xterm.background).toBe(ember.bg)
  })
  it('non-default agent theme overrides bg/fg only', () => {
    const x = resolveAppearance(base, 'backend', ocean).xterm
    expect(x.background).toBe('#050f1a')
    expect(x.foreground).toBe('#7ec4f5')
    expect(x.red).toBe(graphite.ansi[1])
  })
  it('falls back to the global palette without a theme or with the default theme', () => {
    expect(resolveAppearance(base, 'backend').xterm.background).toBe(graphite.bg)
    expect(resolveAppearance(base, 'backend', DEFAULT_THEME).xterm.background).toBe(graphite.bg)
  })
  it('per-agent size overrides, font falls back to global', () => {
    const s = { ...base, perAgent: { backend: { size: 16 } } }
    const r = resolveAppearance(s, 'backend')
    expect(r.fontSize).toBe(16)
    expect(r.fontFamily).toBe(FONTS[0].family)
  })
  it('ignores orphan per-agent entries', () => {
    const s = { ...base, perAgent: { 'renamed-agent': { palette: 'ember' as const, size: 18 } } }
    const r = resolveAppearance(s, 'backend')
    expect(r.xterm.background).toBe(graphite.bg)
    expect(r.fontSize).toBe(13)
  })
})

describe('data', () => {
  it('fonts end with the Plex fallback', () => {
    for (const f of FONTS) expect(f.family.endsWith(', "IBM Plex Mono", monospace')).toBe(true)
  })
  it('palettes are ordered, complete and readable', () => {
    expect(PALETTES.map(p => p.label)).toEqual(['Graphite', 'Paper', 'Phosphor', 'Harbor', 'Ember', 'Moss'])
    for (const p of PALETTES) {
      expect(p.ansi).toHaveLength(16)
      for (const c of p.ansi) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
      expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
