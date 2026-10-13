// Pure helpers for agent worktrees. No fs, no child_process: safe to unit-test.

export interface WorktreeEntry {
  path: string
  head: string
  branch: string | null
  detached: boolean
}

/** Parses `git worktree list --porcelain` output into one entry per block. */
export function parseWorktreeList(porcelain: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = []
  let current: WorktreeEntry | null = null

  const flush = (): void => {
    if (current) entries.push(current)
    current = null
  }

  for (const raw of porcelain.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (line === '') {
      flush()
      continue
    }
    if (line.startsWith('worktree ')) {
      flush()
      current = { path: line.slice('worktree '.length), head: '', branch: null, detached: false }
    } else if (current && line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length)
    } else if (current && line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
    } else if (current && line === 'detached') {
      current.detached = true
    }
  }
  flush()
  return entries
}

/** True when git refuses a branch because another worktree already has it checked out. */
export function isBranchBusyError(stderr: string): boolean {
  return /already (checked out|used by worktree)/.test(stderr)
}

/**
 * True for failures that clear up by themselves once a dying process lets go
 * of a folder: the Windows handle-timing family (EBUSY/EPERM/Permission
 * denied/Directory not empty). Worth a short retry; anything else is not.
 */
export function isTransientFsError(detail: string): boolean {
  return /EBUSY|EPERM|EACCES|Permission denied|Directory not empty|resource busy|being used by another process/i.test(detail)
}
