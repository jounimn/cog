import { describe, it, expect } from 'vitest'
import { parseWorktreeList, isBranchBusyError, isTransientFsError } from './agent-worktree-pure'

const sample = [
  'worktree C:/p/proj', 'HEAD 84297db0000000000000000000000000000000ab', 'branch refs/heads/main', '',
  'worktree C:/p/proj/.cog/worktrees/builder-1', 'HEAD 959cb530000000000000000000000000000000ab', 'branch refs/heads/cog/builder-1', '',
  'worktree C:/p/proj/.cog/worktrees/tester', 'HEAD d0951930000000000000000000000000000000ab', 'detached', ''
].join('\n')

describe('parseWorktreeList', () => {
  it('parses one entry per block with branch stripped of refs/heads/', () => {
    const list = parseWorktreeList(sample)
    expect(list).toHaveLength(3)
    expect(list[1]).toEqual({ path: 'C:/p/proj/.cog/worktrees/builder-1', head: '959cb530000000000000000000000000000000ab', branch: 'cog/builder-1', detached: false })
  })
  it('marks detached entries', () => expect(parseWorktreeList(sample)[2]).toMatchObject({ branch: null, detached: true }))
  it('returns [] for empty output', () => expect(parseWorktreeList('')).toEqual([]))
})

describe('isBranchBusyError', () => {
  it('recognises both git phrasings', () => {
    expect(isBranchBusyError("fatal: 'cog/x' is already checked out at 'C:/p/other'")).toBe(true)
    expect(isBranchBusyError("fatal: 'cog/x' is already used by worktree at 'C:/p/other'")).toBe(true)
    expect(isBranchBusyError('fatal: not a git repository')).toBe(false)
  })
})

describe('isTransientFsError', () => {
  it('recognises Windows handle-timing failures from git and node', () => {
    expect(isTransientFsError("EBUSY: resource busy or locked, rmdir 'C:\\p\\.cog\\worktrees\\b'")).toBe(true)
    expect(isTransientFsError("fatal: failed to delete 'C:/p/.cog/worktrees/b': Permission denied")).toBe(true)
    expect(isTransientFsError("EPERM: operation not permitted, rename 'C:\\p\\x'")).toBe(true)
    expect(isTransientFsError('warning: failed to remove .cog/worktrees/b: Directory not empty')).toBe(true)
  })
  it('does not match ordinary git failures', () => {
    expect(isTransientFsError("fatal: 'cog/x' is already checked out at 'C:/p/other'")).toBe(false)
    expect(isTransientFsError('fatal: not a git repository')).toBe(false)
    expect(isTransientFsError('')).toBe(false)
  })
})
