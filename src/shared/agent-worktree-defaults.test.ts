import { describe, it, expect } from 'vitest'
import { agentSlug, defaultWorktreeForRole } from './agent-worktree-defaults'

describe('agentSlug', () => {
  it('lowercases and dashes separators', () => expect(agentSlug('Builder 1')).toBe('builder-1'))
  it('collapses runs of invalid chars into one dash', () => expect(agentSlug('Revisor ÀÉ 🚀 final')).toBe('revisor-final'))
  it('strips leading and trailing dashes', () => expect(agentSlug('--tester--')).toBe('tester'))
  it('keeps underscores and digits', () => expect(agentSlug('qa_2')).toBe('qa_2'))
  it('truncates to 60 chars', () => expect(agentSlug('a'.repeat(80))).toHaveLength(60))
  it('falls back to "agent" when nothing is left', () => expect(agentSlug('🚀🚀')).toBe('agent'))
})

describe('defaultWorktreeForRole', () => {
  it('is off for orchestrator and researcher', () => {
    expect(defaultWorktreeForRole('Orchestrator', 'claude')).toBe(false)
    expect(defaultWorktreeForRole(' researcher ', 'claude')).toBe(false)
  })
  it('is on for worker and custom roles', () => {
    expect(defaultWorktreeForRole('worker', 'claude')).toBe(true)
    expect(defaultWorktreeForRole('Quality-control', 'codex')).toBe(true)
  })
  it('is off for plain terminals regardless of role', () => expect(defaultWorktreeForRole('worker', 'terminal')).toBe(false))
})
