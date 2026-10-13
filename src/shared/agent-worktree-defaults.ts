// Pure helpers for per-agent git worktrees. Shared with the renderer: no fs, path or Electron imports.

const SLUG_MAX_LENGTH = 60

// Roles whose agents work on the project itself rather than writing code, so they run in the main checkout by default.
const NO_WORKTREE_ROLES = new Set(['orchestrator', 'researcher'])

// Filesystem-safe, lowercase identifier for an agent name, used as the worktree directory name.
export function agentSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '')
  return slug || 'agent'
}

// Whether a newly created agent gets its own worktree when the user has not chosen otherwise.
export function defaultWorktreeForRole(role: string, cli: string): boolean {
  if (cli === 'terminal') return false
  return !NO_WORKTREE_ROLES.has(role.trim().toLowerCase())
}
