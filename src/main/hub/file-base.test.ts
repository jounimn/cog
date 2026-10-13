import { describe, it, expect } from 'vitest'
import { resolveFileBase } from './file-base'

const root = 'C:\\proj'
const agents: Record<string, { cwd: string }> = {
  'Dev 🚀 — one': { cwd: 'C:\\proj\\.cog\\worktrees\\dev-one' },
  Outside: { cwd: 'D:\\elsewhere' },
}
const get = (n: string) => agents[n]

describe('resolveFileBase', () => {
  it('uses the root without a header', () => {
    expect(resolveFileBase(get, undefined, root)).toBe(root)
  })
  it('uses the cwd of an agent whose name is URL-encoded', () => {
    expect(resolveFileBase(get, encodeURIComponent('Dev 🚀 — one'), root)).toBe('C:\\proj\\.cog\\worktrees\\dev-one')
  })
  it('falls back to the raw header when it is not valid encoding', () => {
    agents['100%'] = { cwd: 'C:\\proj\\sub' }
    expect(resolveFileBase(get, '100%', root)).toBe('C:\\proj\\sub')
  })
  it('uses the root for an unknown agent', () => {
    expect(resolveFileBase(get, 'nobody', root)).toBe(root)
  })
  it('uses the root when the agent cwd is outside the root', () => {
    expect(resolveFileBase(get, 'Outside', root)).toBe(root)
  })
  it('does not treat a sibling prefix as inside', () => {
    agents.Sibling = { cwd: 'C:\\proj-evil' }
    expect(resolveFileBase(get, 'Sibling', root)).toBe(root)
  })
  it('accepts a cwd equal to the root, case-insensitively', () => {
    agents.Same = { cwd: 'c:/PROJ/' }
    expect(resolveFileBase(get, 'Same', root)).toBe('c:/PROJ/')
  })
})
