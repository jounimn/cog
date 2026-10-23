import { describe, it, expect } from 'vitest'
import { killConfirmText, formatKilledAt } from './killed-agents'

describe('killConfirmText', () => {
  it('names the agent and says where to restore it', () => {
    const t = killConfirmText('worker-1')
    expect(t).toContain('Kill "worker-1"?')
    expect(t).toContain('Killed')
  })
})

describe('formatKilledAt', () => {
  const now = new Date(2026, 9, 22, 15, 30) // 22 Oct 2026, local

  it('shows only the time for a kill earlier today', () => {
    expect(formatKilledAt(new Date(2026, 9, 22, 9, 5).toISOString(), now)).toBe('09:05')
  })

  it('adds day/month for an older kill', () => {
    expect(formatKilledAt(new Date(2026, 9, 3, 23, 59).toISOString(), now)).toBe('03/10 23:59')
  })

  it('returns an empty string for garbage', () => {
    expect(formatKilledAt('not a date', now)).toBe('')
  })
})
