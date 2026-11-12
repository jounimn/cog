import { describe, it, expect } from 'vitest'

describe('channelsToHex', () => {
  it('converts an "R G B" token to a 6-digit colour', async () => {
    const { channelsToHex } = await import('./monaco-theme')
    expect(channelsToHex(' 10 14 21')).toBe('#0a0e15')
    expect(channelsToHex('255 0 300')).toBe('#ff00ff')
  })
  it('returns null for an empty or malformed token', async () => {
    const { channelsToHex } = await import('./monaco-theme')
    expect(channelsToHex('')).toBeNull()
    expect(channelsToHex('a b c')).toBeNull()
  })
})
