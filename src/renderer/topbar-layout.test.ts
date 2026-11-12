import { describe, it, expect } from 'vitest'
import { topbarLabels } from './topbar-layout'

describe('topbarLabels', () => {
  it('keeps every label at 1440 and wider', () => {
    expect(topbarLabels(1440)).toEqual({ presets: true, help: true, panels: true, appearance: true })
    expect(topbarLabels(1920)).toEqual({ presets: true, help: true, panels: true, appearance: true })
  })

  it('drops Presets and Help below 1440', () => {
    expect(topbarLabels(1439)).toEqual({ presets: false, help: false, panels: true, appearance: true })
    expect(topbarLabels(1280)).toEqual({ presets: false, help: false, panels: true, appearance: true })
  })

  it('also drops Panels and Terminal appearance below 1280', () => {
    expect(topbarLabels(1279)).toEqual({ presets: false, help: false, panels: false, appearance: false })
    expect(topbarLabels(900)).toEqual({ presets: false, help: false, panels: false, appearance: false })
  })
})
