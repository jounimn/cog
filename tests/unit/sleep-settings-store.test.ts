import { describe, it, expect } from 'vitest'
import { createDatabase } from '../../src/main/db/database'
import { SleepSettingsStore } from '../../src/main/db/sleep-settings-store'
import { DEFAULT_SLEEP_SETTINGS } from '../../src/shared/types'

describe('SleepSettingsStore', () => {
  it('returns defaults when nothing is stored', () => {
    const s = new SleepSettingsStore(createDatabase(':memory:'))
    expect(s.get()).toEqual(DEFAULT_SLEEP_SETTINGS)
  })

  it('set merges a patch over current values', () => {
    const s = new SleepSettingsStore(createDatabase(':memory:'))
    const r = s.set({ sleepAfterMinutes: 3 })
    expect(r).toEqual({ ...DEFAULT_SLEEP_SETTINGS, sleepAfterMinutes: 3 })
    expect(s.get()).toEqual(r)
  })

  it('clamps negative and fractional numbers to integers >= 0', () => {
    const s = new SleepSettingsStore(createDatabase(':memory:'))
    expect(s.set({ sleepAfterMinutes: -5, memoryFloorMb: -1 })).toMatchObject({ sleepAfterMinutes: 0, memoryFloorMb: 0 })
    expect(s.set({ sleepAfterMinutes: 2.7 }).sleepAfterMinutes).toBe(2)
  })

  it('falls back to defaults on a corrupt row', () => {
    const db = createDatabase(':memory:')
    db.prepare(`INSERT INTO project_settings (key, value) VALUES ('sleep', ?)`).run('{not json')
    expect(new SleepSettingsStore(db).get()).toEqual(DEFAULT_SLEEP_SETTINGS)
  })
})
