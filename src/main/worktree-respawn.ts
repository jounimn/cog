import { agentSlug, defaultWorktreeForRole } from '../shared/agent-worktree-defaults'
import { deriveProjectRoot } from './agent-root'

export interface RespawnCurrent {
  name: string
  worktreePath?: string
  projectRoot: string
}

export interface RespawnNext {
  name: string
  role: string
  cli: string
  cwd: string
  worktree?: boolean
  projectRoot?: string
}

/**
 * Whether a respawn must give up the running agent's worktree. It must when
 * the new spawn would not land on the same one: a new slug, no worktree
 * wanted any more, or a different project folder. The folder is compared by
 * derived project root, not raw cwd: the edit dialog sends the worktree path
 * back as cwd, and a caller may send the root, and both mean "same project".
 */
export function shouldReleaseOnRespawn(current: RespawnCurrent, next: RespawnNext, wsPath: string | null): boolean {
  if (!current.worktreePath) return false
  const stillWants = (next.worktree ?? defaultWorktreeForRole(next.role, next.cli)) && next.cli !== 'terminal'
  if (!stillWants) return true
  if (agentSlug(next.name.trim()) !== agentSlug(current.name)) return true
  const nextRoot = deriveProjectRoot({ wsPath, projectRoot: next.projectRoot, worktreePath: current.worktreePath, cwd: next.cwd })
  return normalize(nextRoot) !== normalize(current.projectRoot)
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}
