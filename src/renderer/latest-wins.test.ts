import { describe, it, expect } from 'vitest'
import { createLatestWins } from './latest-wins'

describe('createLatestWins', () => {
  it('keeps a lone request current', () => {
    const lw = createLatestWins()
    const isLatest = lw.begin()
    expect(isLatest()).toBe(true)
  })

  it('drops an older request once a newer one began', () => {
    const lw = createLatestWins()
    const first = lw.begin()
    const second = lw.begin()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  it('applies only the latest when requests settle out of order', async () => {
    const lw = createLatestWins()
    const applied: string[] = []
    const request = (font: string, delay: number): Promise<void> => {
      const isLatest = lw.begin()
      return new Promise<void>(r => setTimeout(r, delay)).then(() => { if (isLatest()) applied.push(font) })
    }
    // The global font's load is slow and settles after the per-agent override.
    await Promise.all([request('global', 20), request('override', 1)])
    expect(applied).toEqual(['override'])
  })

  it('keeps separate appliers independent', () => {
    const a = createLatestWins()
    const b = createLatestWins()
    const isA = a.begin()
    b.begin()
    expect(isA()).toBe(true)
  })
})
