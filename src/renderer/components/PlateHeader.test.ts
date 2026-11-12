import { describe, it, expect } from 'vitest'
import { plateAccent } from './PlateHeader'
import { DEFAULT_THEME, THEME_PRESETS } from '../themes'

describe('plateAccent', () => {
  it('leaves an agent without a theme in the board tokens', () => {
    expect(plateAccent(undefined)).toBeUndefined()
  })
  it('leaves the default theme untinted, whatever the hex case', () => {
    expect(plateAccent({ chrome: DEFAULT_THEME.chrome.toUpperCase(), border: DEFAULT_THEME.border.toUpperCase() })).toBeUndefined()
  })
  it('ignores bg and text: only chrome and border decide the tint', () => {
    expect(plateAccent({ bg: '#123456', text: '#abcdef' })).toBeUndefined()
  })
  it('tints with a preset theme', () => {
    const ocean = THEME_PRESETS.find(p => p.id === 'ocean')!.theme
    expect(plateAccent(ocean)).toEqual({ chrome: ocean.chrome, border: ocean.border })
  })
  it('tints when only the border differs, keeping the default chrome', () => {
    expect(plateAccent({ border: '#a02030' })).toEqual({ chrome: DEFAULT_THEME.chrome, border: '#a02030' })
  })
})
