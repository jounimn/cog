export type CommitKind = 'feat' | 'fix' | 'refactor' | 'chore' | 'other'

/** Classifies a changelog line by its conventional-commit prefix (What's new colour-coding). */
export function commitKind(commit: string): CommitKind {
  if (commit.startsWith('feat:') || commit.startsWith('feat(')) return 'feat'
  if (commit.startsWith('fix:') || commit.startsWith('fix(')) return 'fix'
  if (commit.startsWith('refactor:')) return 'refactor'
  if (commit.startsWith('chore:') || commit.startsWith('docs:') || commit.startsWith('test:')) return 'chore'
  return 'other'
}
