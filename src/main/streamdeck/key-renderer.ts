import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import path from 'node:path'

export type Tint = 'none' | 'red' | 'orange' | 'green' | 'grey'

export interface RenderInput {
  faceSvg: string         // e.g. 'cogsworth-focused.svg'
  tint: Tint
  badge?: string          // e.g. '3'
  label?: string          // e.g. 'VOICE'
}

export interface RenderTextInput {
  label: string
  tint: Tint
  badge?: string
}

const TINT_RGB: Record<Tint, [number, number, number] | null> = {
  none: null,
  red: [255, 80, 80],
  orange: [255, 160, 60],
  green: [80, 220, 120],
  grey: [140, 140, 140],
}

export interface KeyFontOptions {
  loadSystemFonts: boolean
  fontFiles?: string[]
}

// Fonts the key SVGs ask for ("Segoe UI, Arial, sans-serif", weights 400–700),
// per platform. Loading just these replaces resvg's default of scanning every
// installed font on each `new Resvg` — ~400 ms apiece on Windows, and a key
// takes up to five instances.
function fontCandidates(platform: NodeJS.Platform, winDir: string): string[] {
  if (platform === 'win32') {
    const dir = path.join(winDir, 'Fonts')
    return ['segoeui.ttf', 'seguisb.ttf', 'segoeuib.ttf', 'arial.ttf', 'arialbd.ttf'].map(f => path.join(dir, f))
  }
  if (platform === 'darwin') {
    return [
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
      '/Library/Fonts/Arial.ttf',
    ]
  }
  return [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ]
}

/** Font options for text-bearing keys; falls back to the full system scan when none of the known files exist. */
export function resolveKeyFontOptions(
  platform: NodeJS.Platform = process.platform,
  exists: (file: string) => boolean = fs.existsSync,
  winDir: string = process.env.WINDIR ?? 'C:\\Windows'
): KeyFontOptions {
  const files = fontCandidates(platform, winDir).filter(f => exists(f))
  return files.length > 0 ? { loadSystemFonts: false, fontFiles: files } : { loadSystemFonts: true }
}

// Composites that carry no <text> (faces, tint, final pixel pass) need no fonts at all.
const NO_FONTS: KeyFontOptions = { loadSystemFonts: false }

export class KeyRenderer {
  private textFonts: KeyFontOptions = resolveKeyFontOptions()
  private svgRoot: string
  private size: number
  private cache = new Map<string, Buffer>()
  private svgFileCache = new Map<string, string>()

  constructor(opts: { svgRoot: string; size: number }) {
    this.svgRoot = opts.svgRoot
    this.size = opts.size
  }

  /**
   * Returns the final raw RGBA pixel buffer (size * size * 4 bytes) ready
   * to hand to Stream Deck `fillKeyBuffer(idx, buf, { format: 'rgba' })`.
   * Composite intermediates use PNG-in-SVG embedding; only the final pass
   * extracts pixels.
   */
  async render(input: RenderInput): Promise<Buffer> {
    const key = this.cacheKey('face', input.faceSvg, input.tint, input.badge, input.label)
    const hit = this.cache.get(key)
    if (hit) return hit

    const svg = this.loadSvg(input.faceSvg)
    let png = this.rasterize(svg)
    png = this.applyTint(png, input.tint)
    if (input.badge) png = this.drawBadge(png, input.badge)
    if (input.label) png = this.drawLabel(png, input.label)

    const pixels = this.toPixels(png)
    this.cache.set(key, pixels)
    return pixels
  }

  async renderText(input: RenderTextInput): Promise<Buffer> {
    const key = this.cacheKey('text', input.label, input.tint, input.badge)
    const hit = this.cache.get(key)
    if (hit) return hit

    // Black background SVG with the label centered
    const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.size}" height="${this.size}">
      <rect width="100%" height="100%" fill="#1a1a1a"/>
      <text x="50%" y="55%" font-size="16" fill="#fff" text-anchor="middle"
            font-family="Segoe UI, Arial, sans-serif" font-weight="600">${this.escape(input.label)}</text>
    </svg>`

    let png = this.rasterize(labelSvg)
    png = this.applyTint(png, input.tint)
    if (input.badge) png = this.drawBadge(png, input.badge)

    const pixels = this.toPixels(png)
    this.cache.set(key, pixels)
    return pixels
  }

  /**
   * Convert a final PNG buffer to a raw RGBA pixel buffer by re-rasterizing
   * it inside a wrapper SVG. One extra Resvg call per cache miss; cache hits
   * skip this step.
   */
  private toPixels(png: Buffer): Buffer {
    const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.size}" height="${this.size}">
      <image href="data:image/png;base64,${png.toString('base64')}" width="${this.size}" height="${this.size}"/>
    </svg>`
    const r = new Resvg(wrapper, {
      fitTo: { mode: 'width', value: this.size },
      background: '#1a1a1a',
      font: NO_FONTS,
    })
    return r.render().pixels
  }

  clearCache(): void {
    this.cache.clear()
  }

  private cacheKey(...parts: (string | undefined)[]): string {
    return parts.map(p => p ?? '').join('|')
  }

  private loadSvg(name: string): string {
    const cached = this.svgFileCache.get(name)
    if (cached) return cached
    const full = path.join(this.svgRoot, name)
    const svg = fs.readFileSync(full, 'utf-8')
    this.svgFileCache.set(name, svg)
    return svg
  }

  private rasterize(svg: string | Buffer, fonts: KeyFontOptions = this.textFonts): Buffer {
    const r = new Resvg(svg, {
      fitTo: { mode: 'width', value: this.size },
      background: '#1a1a1a',
      font: fonts,
    })
    return r.render().asPng()
  }

  private applyTint(png: Buffer, tint: Tint): Buffer {
    const rgb = TINT_RGB[tint]
    if (!rgb) return png
    // Cheap approach: parse PNG via Resvg's re-encode pipeline by overlaying
    // a translucent rect. Re-rasterize a composite SVG with the tint layer.
    // For v1 the tint is "good enough if the LCD is recognizable" — exact
    // color science isn't important.
    const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.size}" height="${this.size}">
      <image href="data:image/png;base64,${png.toString('base64')}" width="${this.size}" height="${this.size}"/>
      <rect width="100%" height="100%" fill="rgb(${rgb[0]},${rgb[1]},${rgb[2]})" opacity="0.35"/>
    </svg>`
    return this.rasterize(composite, NO_FONTS)
  }

  private drawBadge(png: Buffer, text: string): Buffer {
    const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.size}" height="${this.size}">
      <image href="data:image/png;base64,${png.toString('base64')}" width="${this.size}" height="${this.size}"/>
      <circle cx="${this.size - 14}" cy="14" r="11" fill="#e23b3b" stroke="#fff" stroke-width="1.5"/>
      <text x="${this.size - 14}" y="18" font-size="13" fill="#fff" text-anchor="middle"
            font-family="Segoe UI, Arial, sans-serif" font-weight="700">${this.escape(text)}</text>
    </svg>`
    return this.rasterize(composite)
  }

  private drawLabel(png: Buffer, text: string): Buffer {
    const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.size}" height="${this.size}">
      <image href="data:image/png;base64,${png.toString('base64')}" width="${this.size}" height="${this.size}"/>
      <rect x="0" y="${this.size - 16}" width="100%" height="16" fill="#000" opacity="0.55"/>
      <text x="50%" y="${this.size - 4}" font-size="11" fill="#fff" text-anchor="middle"
            font-family="Segoe UI, Arial, sans-serif">${this.escape(text)}</text>
    </svg>`
    return this.rasterize(composite)
  }

  private escape(s: string): string {
    return s.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[ch]!))
  }
}
