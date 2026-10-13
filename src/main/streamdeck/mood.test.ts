import { describe, it, expect } from 'vitest'
import { MOODS, moodForStatus } from './mood'

describe('moodForStatus', () => {
  it('maps sleeping to the sleeping mood', () => {
    expect(moodForStatus('sleeping')).toBe(MOODS.sleeping)
  })
  it('maps waking to the neutral mood', () => {
    expect(moodForStatus('waking')).toBe(MOODS.neutral)
  })
})
