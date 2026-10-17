import { describe, it, expect } from 'vitest'
import { cardPresentation, parseSleepNumber } from './sleep-ui'

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

describe('cardPresentation sleep eligibility', () => {
  const awake = { opacity: 1, titlePrefix: '' }
  it('offers sleep for a started, resumable, awake agent', () => {
    expect(cardPresentation({ status: 'active', cli: 'claude', sessionStarted: true, neverSleep: false }))
      .toEqual({ ...awake, menu: ['sleep'] })
  })
  it('hides sleep for a plain terminal (no resumable session)', () => {
    expect(cardPresentation({ status: 'idle', cli: 'terminal', sessionStarted: true }).menu).toEqual([])
  })
  it('hides sleep before the agent has a session', () => {
    expect(cardPresentation({ status: 'idle', cli: 'claude', sessionStarted: false }).menu).toEqual([])
  })
  it('hides sleep for never-sleep agents', () => {
    expect(cardPresentation({ status: 'idle', cli: 'codex', sessionStarted: true, neverSleep: true }).menu).toEqual([])
  })
  it('hides sleep for disconnected agents', () => {
    expect(cardPresentation({ status: 'disconnected', cli: 'claude', sessionStarted: true }).menu).toEqual([])
  })
  it('keeps wake for a sleeper whatever the extras say', () => {
    expect(cardPresentation({ status: 'sleeping', cli: 'claude', sessionStarted: true, neverSleep: true }).menu).toEqual(['wake'])
  })
})

describe('parseSleepNumber', () => {
  it('rejects an empty or blank field instead of reading it as 0', () => {
    expect(parseSleepNumber('')).toBeNull()
    expect(parseSleepNumber('  ')).toBeNull()
  })
  it('rejects negatives and non-numbers', () => {
    expect(parseSleepNumber('-1')).toBeNull()
    expect(parseSleepNumber('abc')).toBeNull()
  })
  it('accepts 0 typed on purpose and floors decimals', () => {
    expect(parseSleepNumber('0')).toBe(0)
    expect(parseSleepNumber('12.7')).toBe(12)
  })
})
