import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { ensureAgentWorktree, releaseAgentWorktree, listAgentWorktrees } from '../../src/main/git/agent-worktree'

const hasGit = (() => {
  try {
    execSync('git --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
})()

describe.skipIf(!hasGit)('agent worktree against a real repo', () => {
  let root = ''

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-wt-'))
    const opts = { cwd: root, stdio: 'pipe' as const }
    execSync('git init -q', opts)
    execSync('git -c user.email=t@t -c user.name=t -c core.autocrlf=false commit --allow-empty -q -m init', opts)
  })

  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } catch {
      /* Windows may hold worktree folders briefly; tolerate */
    }
  })

  it('creates, reuses, releases clean, keeps dirty', () => {
    const a = ensureAgentWorktree(root, 'Builder 1')
    if (!a.ok) throw new Error(`ensure failed: ${a.detail}`)
    expect(a.reused).toBe(false)
    expect(a.branch).toBe('cog/builder-1')
    expect(fs.existsSync(a.path)).toBe(true)

    const b = ensureAgentWorktree(root, 'Builder 1')
    if (!b.ok) throw new Error(`ensure failed: ${b.detail}`)
    expect(b.reused).toBe(true)
    expect(b.path).toBe(a.path)

    expect(listAgentWorktrees(root).map((w) => w.slug)).toEqual(['builder-1'])

    expect(releaseAgentWorktree(root, 'Builder 1')).toMatchObject({ removed: true, reason: 'clean' })
    expect(fs.existsSync(a.path)).toBe(false)

    const c = ensureAgentWorktree(root, 'Builder 1')
    if (!c.ok) throw new Error(`ensure failed: ${c.detail}`)
    expect(c.reused).toBe(false)

    fs.writeFileSync(path.join(c.path, 'x.txt'), 'dirty')
    expect(releaseAgentWorktree(root, 'Builder 1')).toMatchObject({ removed: false, reason: 'dirty' })
    expect(execSync('git branch --list cog/builder-1', { cwd: root, encoding: 'utf-8' })).toContain('cog/builder-1')
  }, 60000)
})
