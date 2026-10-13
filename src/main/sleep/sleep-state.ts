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
