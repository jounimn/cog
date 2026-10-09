import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import { claudeSessionExists, isClaudeSessionId } from '../../src/main/claude-session'

const SID = '7ae74d9a-3aa7-4d34-8ff0-20f3f548584e'

function makeHome(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'cog-claude-session-'))
}

describe('isClaudeSessionId', () => {
  it('accepts a lowercase v4-style UUID', () => {
    expect(isClaudeSessionId(SID)).toBe(true)
  })
  it('rejects anything that could reach a shell command unescaped', () => {
    expect(isClaudeSessionId('agent-1')).toBe(false)
    expect(isClaudeSessionId(`${SID}; rm -rf /`)).toBe(false)
    expect(isClaudeSessionId('')).toBe(false)
  })
})

describe('claudeSessionExists', () => {
  it('returns false when ~/.claude/projects does not exist', () => {
    const home = makeHome()
    try {
      expect(claudeSessionExists(SID, home)).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('finds the session transcript in any project folder', () => {
    const home = makeHome()
    try {
      const proj = path.join(home, '.claude', 'projects', 'C--repo-a')
      mkdirSync(proj, { recursive: true })
      mkdirSync(path.join(home, '.claude', 'projects', 'C--repo-b'), { recursive: true })
      writeFileSync(path.join(proj, `${SID}.jsonl`), '{}\n')
      expect(claudeSessionExists(SID, home)).toBe(true)
      expect(claudeSessionExists('11111111-2222-4333-8444-555555555555', home)).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('never matches on an invalid id (no path traversal)', () => {
    const home = makeHome()
    try {
      mkdirSync(path.join(home, '.claude', 'projects', 'x'), { recursive: true })
      expect(claudeSessionExists('../../x', home)).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
