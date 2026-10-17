import type Database from 'better-sqlite3'
import { DEFAULT_SLEEP_SETTINGS, type SleepSettings } from '../../shared/types'

const KEY = 'sleep'

function clampInt(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback
}

export class SleepSettingsStore {
  private getStmt: Database.Statement
  private setStmt: Database.Statement

  constructor(db: Database.Database) {
    this.getStmt = db.prepare('SELECT value FROM project_settings WHERE key = ?')
    this.setStmt = db.prepare(
      `INSERT INTO project_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
  }

  get(): SleepSettings {
    const row = this.getStmt.get(KEY) as { value: string } | undefined
    if (!row) return { ...DEFAULT_SLEEP_SETTINGS }
    try {
      const p = JSON.parse(row.value)
      return {
        enabled: typeof p?.enabled === 'boolean' ? p.enabled : DEFAULT_SLEEP_SETTINGS.enabled,
        sleepAfterMinutes: clampInt(p?.sleepAfterMinutes, DEFAULT_SLEEP_SETTINGS.sleepAfterMinutes),
        memoryFloorMb: clampInt(p?.memoryFloorMb, DEFAULT_SLEEP_SETTINGS.memoryFloorMb)
      }
    } catch {
      return { ...DEFAULT_SLEEP_SETTINGS }
    }
  }

  set(patch: Partial<SleepSettings>): SleepSettings {
    const cur = this.get()
    const next: SleepSettings = {
      enabled: typeof patch.enabled === 'boolean' ? patch.enabled : cur.enabled,
      sleepAfterMinutes: clampInt(patch.sleepAfterMinutes, cur.sleepAfterMinutes),
      memoryFloorMb: clampInt(patch.memoryFloorMb, cur.memoryFloorMb)
    }
    this.setStmt.run(KEY, JSON.stringify(next))
    return next
  }
}
