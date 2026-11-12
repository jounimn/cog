import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { c, type Token } from './tokens'

const ALL: Token[] = [
  'canvas', 'surface', 'surface-muted', 'surface-sunk', 'line', 'line-strong', 'grid', 'steel',
  'ink', 'ink-muted', 'ink-subtle', 'hint', 'hint-hover', 'on-hint', 'focus',
  'working', 'warning', 'danger', 'success'
]

describe('tokens', () => {
  it('c() builds an rgb var reference', () => {
    expect(c('ink')).toBe('rgb(var(--ink))')
  })

  it('c() adds alpha', () => {
    expect(c('line', 0.5)).toBe('rgb(var(--line) / 0.5)')
  })

  it('tokens.css declares every token', () => {
    const css = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8')
    for (const t of ALL) expect(css).toContain(`--${t}:`)
  })
})
