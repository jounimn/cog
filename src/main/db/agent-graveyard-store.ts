import type Database from 'better-sqlite3'
import type { AgentConfig } from '../../shared/types'

/**
 * Per-project list of agents the user killed, so a kill is undoable.
 *
 * teardownAgent() drops a killed agent from the roster (so it does not
 * respawn on boot) and parks its ORIGINAL config here instead of losing it.
 * The config still carries sessionId / sessionStarted / permissionMode, so a
 * restore is the same spawn as a boot respawn: the CLI resumes the session
 * it had. Newest first; capped at GRAVEYARD_MAX per project (oldest dropped).
 */
export const GRAVEYARD_MAX = 50

export interface KilledAgent {
  config: AgentConfig
  killedAt: string
}

export class AgentGraveyardStore {
  private upsertStmt: Database.Statement
  private removeStmt: Database.Statement
  private getStmt: Database.Statement
  private listStmt: Database.Statement
  private pruneStmt: Database.Statement

  constructor(db: Database.Database) {
    this.upsertStmt = db.prepare(
      `INSERT INTO agent_graveyard (id, config, killed_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET config = excluded.config, killed_at = excluded.killed_at`
    )
    this.removeStmt = db.prepare(`DELETE FROM agent_graveyard WHERE id = ?`)
    this.getStmt = db.prepare(`SELECT config, killed_at AS killedAt FROM agent_graveyard WHERE id = ?`)
    this.listStmt = db.prepare(`SELECT config, killed_at AS killedAt FROM agent_graveyard ORDER BY killed_at DESC, rowid DESC`)
    this.pruneStmt = db.prepare(
      `DELETE FROM agent_graveyard WHERE id NOT IN (
         SELECT id FROM agent_graveyard ORDER BY killed_at DESC, rowid DESC LIMIT ?
       )`
    )
  }

  /** Park a killed agent's config; the oldest entries beyond the cap are dropped. */
  save(config: AgentConfig, now = new Date().toISOString()): void {
    this.upsertStmt.run(config.id, JSON.stringify(config), now)
    this.pruneStmt.run(GRAVEYARD_MAX)
  }

  /** Remove and return a killed agent's config, or null when it is not there. */
  take(id: string): AgentConfig | null {
    const row = this.getStmt.get(id) as { config: string } | undefined
    if (!row) return null
    this.removeStmt.run(id)
    try {
      return JSON.parse(row.config) as AgentConfig
    } catch {
      return null
    }
  }

  forget(id: string): void {
    this.removeStmt.run(id)
  }

  /** Every killed agent, newest first; corrupt rows are skipped. */
  list(): KilledAgent[] {
    const rows = this.listStmt.all() as Array<{ config: string; killedAt: string }>
    const out: KilledAgent[] = []
    for (const row of rows) {
      try {
        out.push({ config: JSON.parse(row.config) as AgentConfig, killedAt: row.killedAt })
      } catch {
        /* skip */
      }
    }
    return out
  }
}
