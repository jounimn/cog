import path from 'path'

// Pure derivation of an agent's real project folder (never a worktree). No Electron imports.
export function deriveProjectRoot(input: { wsPath: string | null; projectRoot?: string; worktreePath?: string; cwd: string }): string {
  const root = input.wsPath
    ?? input.projectRoot
    ?? ((input.worktreePath && input.cwd === input.worktreePath)
      ? path.resolve(input.worktreePath, '..', '..', '..')
      : input.cwd)
  // Defence in depth: a root that points inside a worktree is cut back to the project.
  const idx = root.replace(/\\/g, '/').toLowerCase().indexOf('/.cog/worktrees/')
  if (idx >= 0) return path.resolve(root.slice(0, idx))
  return root
}
