import { describe, it, expect } from 'vitest'
import { buildInitialPrompt } from './agent-prompt'
import type { AgentConfig } from '../shared/types'

function cfg(over: Partial<AgentConfig> = {}): AgentConfig {
  return { id: 'a1', name: 'w1', role: 'developer', cwd: String.raw`C:\p`, ...over } as AgentConfig
}

describe('buildInitialPrompt', () => {
  it('mentions the work dir when set', () => {
    const p = buildInitialPrompt(cfg({ workDir: String.raw`C:\p\.cog\work\w1` }), String.raw`C:\p`)
    expect(p).toContain(String.raw`scratch files go under "C:\p\.cog\work\w1" — never outside the project folder.`)
    expect(buildInitialPrompt(cfg(), String.raw`C:\p`)).not.toContain('scratch files')
  })

  it('adds the worktree block only when worktreePath is set', () => {
    expect(buildInitialPrompt(cfg(), String.raw`C:\p`)).not.toContain('isolated git worktree')
    const p = buildInitialPrompt(cfg({ worktreePath: String.raw`C:\p\.cog\worktrees\w1` }), String.raw`C:\p`)
    expect(p).toContain(String.raw`isolated git worktree at "C:\p\.cog\worktrees\w1" on branch "cog/w1"`)
    expect(p).toContain(String.raw`The main checkout is "C:\p"; do not edit it directly.`)
  })

  it('keeps the existing orchestrator tool sentence', () => {
    const p = buildInitialPrompt(cfg({ role: 'orchestrator' }), String.raw`C:\p`)
    expect(p).toContain('propose_team')
    expect(p).toContain('WAIT for nudges')
    expect(buildInitialPrompt(cfg(), String.raw`C:\p`)).not.toContain('propose_team')
  })
})
