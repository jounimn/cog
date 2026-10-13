import { describe, it, expect } from 'vitest'
import { shouldReleaseOnRespawn } from './worktree-respawn'

const root = 'C:\\p\\proj'
const wt = 'C:\\p\\proj\\.cog\\worktrees\\builder-1'
const current = { name: 'Builder 1', worktreePath: wt, projectRoot: root }
const next = { name: 'Builder 1', role: 'worker', cli: 'claude', cwd: wt, worktree: true as boolean | undefined, projectRoot: root as string | undefined }

describe('shouldReleaseOnRespawn', () => {
  it('keeps the worktree when the edit dialog sends the same agent back (cwd = worktree)', () => {
    expect(shouldReleaseOnRespawn(current, next, null)).toBe(false)
  })
  it('keeps the worktree when the caller passes the project root as cwd', () => {
    expect(shouldReleaseOnRespawn(current, { ...next, cwd: root }, null)).toBe(false)
  })
  it('keeps the worktree when the workspace is bound to the same folder', () => {
    expect(shouldReleaseOnRespawn(current, { ...next, cwd: 'C:\\elsewhere' }, root)).toBe(false)
  })
  it('releases on rename (slug changes)', () => {
    expect(shouldReleaseOnRespawn(current, { ...next, name: 'Builder 2' }, null)).toBe(true)
  })
  it('releases when the agent no longer wants a worktree', () => {
    expect(shouldReleaseOnRespawn(current, { ...next, worktree: false }, null)).toBe(true)
    expect(shouldReleaseOnRespawn(current, { ...next, cli: 'terminal' }, null)).toBe(true)
  })
  it('releases when the project folder really changes', () => {
    expect(shouldReleaseOnRespawn(current, { ...next, cwd: 'C:\\p\\other', projectRoot: undefined }, null)).toBe(true)
    expect(shouldReleaseOnRespawn(current, next, 'C:\\p\\other')).toBe(true)
  })
  it('never releases an agent that has no worktree', () => {
    expect(shouldReleaseOnRespawn({ ...current, worktreePath: undefined }, { ...next, name: 'Other' }, null)).toBe(false)
  })
})
