import { describe, it, expect } from 'vitest'
import path from 'path'
import { deriveProjectRoot } from './agent-root'

const p = path.resolve('/proj')
const wt = path.join(p, '.cog', 'worktrees', 'dev')

describe('deriveProjectRoot', () => {
  it('prefers the workspace path', () => {
    expect(deriveProjectRoot({ wsPath: '/ws', projectRoot: '/x', cwd: '/y' })).toBe('/ws')
  })
  it('uses the persisted project root next', () => {
    expect(deriveProjectRoot({ wsPath: null, projectRoot: p, worktreePath: wt, cwd: wt })).toBe(p)
  })
  it('goes three levels up when cwd is the worktree', () => {
    expect(deriveProjectRoot({ wsPath: null, worktreePath: wt, cwd: wt })).toBe(p)
  })
  it('uses the plain cwd otherwise', () => {
    expect(deriveProjectRoot({ wsPath: null, cwd: p })).toBe(p)
  })
  it('cuts a root under .cog/worktrees back to the project', () => {
    expect(deriveProjectRoot({ wsPath: null, projectRoot: wt, cwd: wt })).toBe(p)
    expect(deriveProjectRoot({ wsPath: null, projectRoot: path.join(wt, 'sub'), cwd: wt })).toBe(p)
  })
})
