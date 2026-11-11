import { describe, it, expect } from 'vitest'
import { KeyRenderer, resolveKeyFontOptions } from '../../src/main/streamdeck/key-renderer'
import path from 'node:path'

const svgRoot = path.resolve(__dirname, '../../src/main/streamdeck/assets/cogsworth')

describe('KeyRenderer', () => {
  it('renders a 72x72 RGBA pixel buffer for a known SVG', async () => {
    const r = new KeyRenderer({ svgRoot, size: 72 })
    const buf = await r.render({ faceSvg: 'cogsworth-happy.svg', tint: 'none' })
    expect(buf).toBeInstanceOf(Buffer)
    // 72 * 72 * 4 (RGBA) = 20736 bytes — what fillKeyBuffer expects with format: 'rgba'
    expect(buf.byteLength).toBe(72 * 72 * 4)
  })

  it('caches identical renders (returns same buffer reference)', async () => {
    const r = new KeyRenderer({ svgRoot, size: 72 })
    const a = await r.render({ faceSvg: 'cogsworth-neutral.svg', tint: 'none' })
    const b = await r.render({ faceSvg: 'cogsworth-neutral.svg', tint: 'none' })
    expect(a).toBe(b)
  })

  it('invalidates cache when tint changes', async () => {
    const r = new KeyRenderer({ svgRoot, size: 72 })
    const a = await r.render({ faceSvg: 'cogsworth-neutral.svg', tint: 'none' })
    const b = await r.render({ faceSvg: 'cogsworth-neutral.svg', tint: 'red' })
    expect(a).not.toBe(b)
  })

  it('renders an action key with text label', async () => {
    const r = new KeyRenderer({ svgRoot, size: 72 })
    const png = await r.renderText({ label: 'VOICE', tint: 'none' })
    expect(png).toBeInstanceOf(Buffer)
    expect(png.byteLength).toBeGreaterThan(0)
  })

  it('still draws label glyphs with the narrowed font set', async () => {
    const r = new KeyRenderer({ svgRoot, size: 72 })
    const blank = await r.renderText({ label: '', tint: 'none' })
    const voice = await r.renderText({ label: 'VOICE', tint: 'none' })
    expect(voice.equals(blank)).toBe(false)
  })

  // Each Resvg instance used to scan every installed system font (~400 ms on
  // Windows), and a key takes 2–5 instances, so a full deck refresh took
  // many seconds. Generous ceiling: a regression guard, not a benchmark.
  it('renders 15 distinct text keys in well under the old cost', async () => {
    const r = new KeyRenderer({ svgRoot, size: 72 })
    const t = Date.now()
    for (let i = 0; i < 15; i++) await r.renderText({ label: `K${i}`, tint: 'green', badge: String(i) })
    expect(Date.now() - t).toBeLessThan(3000)
  })
})

describe('resolveKeyFontOptions', () => {
  it('loads only the known font files when they exist', () => {
    const opts = resolveKeyFontOptions('win32', () => true, 'C:\\Windows')
    expect(opts.loadSystemFonts).toBe(false)
    expect(opts.fontFiles).toContain(path.join('C:\\Windows', 'Fonts', 'segoeui.ttf'))
    expect(opts.fontFiles).toContain(path.join('C:\\Windows', 'Fonts', 'arial.ttf'))
  })

  it('keeps only the files that exist', () => {
    const opts = resolveKeyFontOptions('win32', (f) => f.endsWith('arial.ttf'), 'C:\\Windows')
    expect(opts.fontFiles).toEqual([path.join('C:\\Windows', 'Fonts', 'arial.ttf')])
  })

  it('falls back to scanning system fonts when none of the files exist', () => {
    expect(resolveKeyFontOptions('linux', () => false)).toEqual({ loadSystemFonts: true })
  })
})
