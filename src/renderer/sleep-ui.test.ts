import { describe, it, expect } from 'vitest'
import { cardPresentation } from './sleep-ui'

describe('cardPresentation', () => {
  it('idle shows full opacity and a sleep action', () => {
    expect(cardPresentation('idle')).toEqual({ opacity: 1, titlePrefix: '', menu: ['sleep'] })
  })
  it('working shows full opacity and a sleep action', () => {
    expect(cardPresentation('working')).toEqual({ opacity: 1, titlePrefix: '', menu: ['sleep'] })
  })
  it('sleeping is dimmed, prefixed with the moon and offers wake', () => {
    expect(cardPresentation('sleeping')).toEqual({ opacity: 0.5, titlePrefix: '🌙 ', menu: ['wake'] })
  })
  it('waking is dimmed, prefixed with the hourglass and offers nothing', () => {
    expect(cardPresentation('waking')).toEqual({ opacity: 0.5, titlePrefix: '⏳ ', menu: [] })
  })
})
