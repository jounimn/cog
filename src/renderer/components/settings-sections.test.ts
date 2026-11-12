import { describe, it, expect } from 'vitest'
import { SETTINGS_SECTIONS, SETTINGS_SECTION_ORDER, isScrolledToEnd, pickActiveSection } from './settings-sections'

describe('SETTINGS_SECTIONS', () => {
  it('lists the dialog groups in body order, sentence case', () => {
    expect(SETTINGS_SECTIONS.map(s => s.label)).toEqual([
      'Notifications', 'Agents', 'Themes', 'Remote view', 'Telegram bot', 'Agent autonomy', 'Stream Deck'
    ])
    expect(SETTINGS_SECTION_ORDER).toEqual(SETTINGS_SECTIONS.map(s => s.id))
    expect(new Set(SETTINGS_SECTION_ORDER).size).toBe(SETTINGS_SECTION_ORDER.length)
  })
})

describe('isScrolledToEnd', () => {
  it('is false when the content does not overflow', () => {
    expect(isScrolledToEnd(0, 500, 500)).toBe(false)
    expect(isScrolledToEnd(0, 500, 501)).toBe(false)
  })
  it('is true at the bottom, within 2px', () => {
    expect(isScrolledToEnd(500, 500, 1000)).toBe(true)
    expect(isScrolledToEnd(498, 500, 1000)).toBe(true)
  })
  it('is false above the bottom', () => {
    expect(isScrolledToEnd(0, 500, 1000)).toBe(false)
    expect(isScrolledToEnd(490, 500, 1000)).toBe(false)
  })
})

describe('pickActiveSection', () => {
  const order = ['a', 'b', 'c'] as const
  it('picks the section whose top is nearest the body top', () => {
    expect(pickActiveSection(order, { a: -600, b: 40, c: 700 }, 'a')).toBe('b')
    expect(pickActiveSection(order, { a: -30, b: 300, c: 900 }, 'c')).toBe('a')
  })
  it('does not lag: a section just below the top beats a long one that started far above', () => {
    expect(pickActiveSection(order, { a: -900, b: 120, c: 800 }, 'a')).toBe('b')
  })
  it('gives a tie to the earlier section', () => {
    expect(pickActiveSection(order, { a: -50, b: 50 }, 'c')).toBe('a')
  })
  it('keeps the current section when no section was measured', () => {
    expect(pickActiveSection(order, {}, 'b')).toBe('b')
  })
  it('ignores ids that are not sections', () => {
    expect(pickActiveSection(order, { x: 0 }, 'c')).toBe('c')
  })
  it('picks the last section at the end of the scroll', () => {
    expect(pickActiveSection(order, { a: 0, b: 300 }, 'a', true)).toBe('c')
  })
})
