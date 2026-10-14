import path from 'node:path'
import type { AgentConfig } from '../../shared/types'
import { agentSlug } from '../../shared/agent-worktree-defaults'

/**
 * Extra reconnect-prompt text for a woken agent. Only a recreated worktree
 * needs a warning; the caller substitutes `<slug>`.
 */
export function reconnectWorktreeNote(r: { ok: true; reused: boolean } | { ok: false }): string {
  if (!r.ok || r.reused) return ''
  return ' Your worktree was recreated from branch cog/<slug>; uncommitted files from before you slept are gone.'
}

const normRoot = (p: string): string => path.resolve(p).toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '')

/** A sleeping roster row (other than `exceptId`) still owns `<projectRoot>/.cog/*\/<slug>`. */
export function slugTakenBySleeper(roster: AgentConfig[], projectRoot: string, slug: string, exceptId: string): boolean {
  const target = normRoot(projectRoot)
  return roster.some(
    (c) =>
      c.sleeping === true &&
      c.id !== exceptId &&
      !!c.projectRoot &&
      normRoot(c.projectRoot) === target &&
      agentSlug(c.name) === slug
  )
}

/**
 * handleSpawnAgent's spawn-asleep branch: only a first creation with the flag
 * set (never a reconnect/respawn after restart, a wake, or an agent whose
 * session already started) gets a roster row and registry card without a PTY.
 */
export function shouldSpawnAsleep(
  config: Pick<AgentConfig, 'spawnAsleep' | 'sessionStarted'>,
  opts?: { reconnect?: boolean; wake?: boolean }
): boolean {
  return !!config.spawnAsleep && !opts?.reconnect && !opts?.wake && !config.sessionStarted
}

/** Roster rows to register as sleeping cards when a workspace context is created. */
export function sleepingRosterRows(roster: AgentConfig[]): AgentConfig[] {
  return roster.filter((c) => c.sleeping === true)
}

/**
 * respawnRosterFor's plan: sleepers are only registered (when their card is
 * missing) and never spawned; awake rows not already running are spawned.
 */
export function planRosterRespawn(
  roster: AgentConfig[],
  isLive: (id: string) => boolean,
  isRegistered: (name: string) => boolean
): { register: AgentConfig[]; spawn: AgentConfig[] } {
  const register: AgentConfig[] = []
  const spawn: AgentConfig[] = []
  for (const c of roster) {
    if (isLive(c.id)) continue
    if (c.sleeping === true) {
      if (!isRegistered(c.name)) register.push(c)
      continue
    }
    spawn.push(c)
  }
  return { register, spawn }
}
