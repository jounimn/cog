import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  ensureAgentWorktree,
  releaseAgentWorktree,
  listAgentWorktrees,
  removeAgentWorktree,
  worktreePaths,
  type Run
} from './agent-worktree'

interface Call { cmd: string; cwd: string }

/** Fake git: per command prefix (longest wins) returns a string or throws an Error. Unscripted -> ''. */
function fakeRun(script: Record<string, string | Error>): { run: Run; calls: Call[] } {
  const calls: Call[] = []
  const run: Run = (cmd, cwd) => {
    calls.push({ cmd, cwd })
    const key = Object.keys(script)
      .filter((k) => cmd.startsWith(k))
      .sort((a, b) => b.length - a.length)[0]
    if (key === undefined) return ''
    const v = script[key]
    if (v instanceof Error) throw v
    return v
  }
  return { run, calls }
}

const porcelain = (...paths: string[]): string =>
  paths.map((p) => `worktree ${p.replace(/\\/g, '/')}\nHEAD abc123\nbranch refs/heads/x\n`).join('\n')

let root: string
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-wt-'))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('worktreePaths', () => {
  it('derives slug, branch, worktree and work dir', () => {
    const p = worktreePaths(root, 'Builder 1')
    expect(p.slug).toBe('builder-1')
    expect(p.branch).toBe('cog/builder-1')
    expect(p.worktreePath).toBe(path.join(root, '.cog', 'worktrees', 'builder-1'))
    expect(p.workDir).toBe(path.join(root, '.cog', 'work', 'builder-1'))
  })
})

describe('ensureAgentWorktree', () => {
  it('returns not-git and still creates the work dir when rev-parse fails', () => {
    const { run, calls } = fakeRun({ 'git rev-parse': new Error('fatal: not a git repository') })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('not-git')
    expect(fs.existsSync(r.workDir)).toBe(true)
    expect(calls.map((c) => c.cmd)).toEqual(['git rev-parse --is-inside-work-tree'])
  })

  it('returns git-missing when git is not on PATH', () => {
    const { run } = fakeRun({ 'git rev-parse': new Error('spawnSync git ENOENT') })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('git-missing')
    expect(fs.existsSync(r.workDir)).toBe(true)
  })

  it('reuses a registered worktree without calling add', () => {
    const { worktreePath, branch } = worktreePaths(root, 'builder-1')
    const { run, calls } = fakeRun({
      'git worktree list': porcelain(root, worktreePath)
    })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r).toMatchObject({ ok: true, reused: true, path: worktreePath, branch })
    expect(calls.some((c) => c.cmd.startsWith('git worktree add'))).toBe(false)
  })

  it('adds on the existing branch when cog/<slug> exists', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    const { run, calls } = fakeRun({ 'git worktree list': porcelain(root) })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r).toMatchObject({ ok: true, reused: false, path: worktreePath })
    expect(calls.map((c) => c.cmd)).toEqual([
      'git rev-parse --is-inside-work-tree',
      'git worktree prune',
      'git worktree list --porcelain',
      'git show-ref --verify --quiet refs/heads/cog/builder-1',
      `git worktree add "${worktreePath}" cog/builder-1`
    ])
    expect(calls.every((c) => c.cwd === root)).toBe(true)
  })

  it('creates the branch from HEAD when it does not exist', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    const { run, calls } = fakeRun({
      'git worktree list': porcelain(root),
      'git show-ref': new Error('exit 1')
    })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r.ok).toBe(true)
    expect(calls[calls.length - 1].cmd).toBe(`git worktree add -b cog/builder-1 "${worktreePath}" HEAD`)
  })

  it('returns branch-busy when git refuses the add', () => {
    const { run } = fakeRun({
      'git worktree list': porcelain(root),
      'git worktree add': new Error("fatal: 'cog/builder-1' is already checked out at '/x'")
    })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('branch-busy')
    expect(r.workDir).toBe(worktreePaths(root, 'builder-1').workDir)
  })

  it('returns git-error for other add failures', () => {
    const { run } = fakeRun({
      'git worktree list': porcelain(root),
      'git worktree add': new Error('fatal: disk on fire')
    })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('git-error')
    expect(r.detail).toContain('disk on fire')
  })

  it('renames a non-empty unregistered folder to <slug>.stale-<stamp> before adding', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    fs.mkdirSync(worktreePath, { recursive: true })
    fs.writeFileSync(path.join(worktreePath, 'keep.txt'), 'x')
    const { run, calls } = fakeRun({ 'git worktree list': porcelain(root) })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.staleRenamedTo).toMatch(/builder-1\.stale-\d{8}-\d{6}$/)
    expect(fs.readFileSync(path.join(r.staleRenamedTo!, 'keep.txt'), 'utf-8')).toBe('x')
    expect(fs.existsSync(worktreePath)).toBe(false)
    expect(calls[calls.length - 1].cmd).toContain('git worktree add')
  })

  it('deletes an empty unregistered folder before adding', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    fs.mkdirSync(worktreePath, { recursive: true })
    const { run } = fakeRun({ 'git worktree list': porcelain(root) })
    const r = ensureAgentWorktree(root, 'builder-1', run)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.staleRenamedTo).toBeUndefined()
    expect(fs.existsSync(worktreePath)).toBe(false)
    expect(fs.readdirSync(path.dirname(worktreePath))).toEqual([])
  })
})

describe('releaseAgentWorktree', () => {
  it('absent when the worktree is not registered', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    const { run, calls } = fakeRun({ 'git worktree list': porcelain(root) })
    const r = releaseAgentWorktree(root, 'builder-1', run)
    expect(r).toMatchObject({ removed: false, reason: 'absent', path: worktreePath })
    expect(calls.some((c) => c.cmd.startsWith('git worktree remove'))).toBe(false)
  })

  it('removes when status is clean and keeps the branch', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    const { run, calls } = fakeRun({
      'git worktree list': porcelain(root, worktreePath),
      'git status': ''
    })
    const r = releaseAgentWorktree(root, 'builder-1', run)
    expect(r).toMatchObject({ removed: true, reason: 'clean', path: worktreePath })
    const cmds = calls.map((c) => c.cmd)
    expect(cmds).toContain(`git worktree remove "${worktreePath}"`)
    expect(cmds.some((c) => c.startsWith('git branch'))).toBe(false)
    expect(calls.find((c) => c.cmd === 'git status --porcelain')?.cwd).toBe(worktreePath)
  })

  it('keeps when status is dirty', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    const { run, calls } = fakeRun({
      'git worktree list': porcelain(root, worktreePath),
      'git status': ' M a.ts\n'
    })
    const r = releaseAgentWorktree(root, 'builder-1', run)
    expect(r).toMatchObject({ removed: false, reason: 'dirty', path: worktreePath })
    expect(calls.some((c) => c.cmd.startsWith('git worktree remove'))).toBe(false)
  })

  it('reports git-error when remove throws', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    const { run } = fakeRun({
      'git worktree list': porcelain(root, worktreePath),
      'git worktree remove': new Error('fatal: locked')
    })
    const r = releaseAgentWorktree(root, 'builder-1', run)
    expect(r.removed).toBe(false)
    expect(r.reason).toBe('git-error')
    expect(r.detail).toContain('locked')
  })
})

describe('listAgentWorktrees', () => {
  it('lists only entries under .cog/worktrees with dirty flag', () => {
    const a = worktreePaths(root, 'a').worktreePath
    const b = worktreePaths(root, 'b').worktreePath
    const calls: Call[] = []
    const run: Run = (cmd, cwd) => {
      calls.push({ cmd, cwd })
      if (cmd.startsWith('git worktree list')) {
        return `worktree ${root.replace(/\\/g, '/')}\nHEAD 1\nbranch refs/heads/main\n\n` +
          `worktree ${a.replace(/\\/g, '/')}\nHEAD 2\nbranch refs/heads/cog/a\n\n` +
          `worktree ${b.replace(/\\/g, '/')}\nHEAD 3\ndetached\n`
      }
      if (cmd === 'git status --porcelain') return cwd === b ? ' M x\n' : ''
      return ''
    }
    expect(listAgentWorktrees(root, run)).toEqual([
      { slug: 'a', path: a, branch: 'cog/a', dirty: false },
      { slug: 'b', path: b, branch: null, dirty: true }
    ])
  })
})

describe('removeAgentWorktree', () => {
  it('passes --force only when asked', () => {
    const { worktreePath } = worktreePaths(root, 'builder-1')
    const plain = fakeRun({})
    expect(removeAgentWorktree(root, 'builder-1', { force: false }, plain.run).removed).toBe(true)
    expect(plain.calls.map((c) => c.cmd)).toEqual([`git worktree remove "${worktreePath}"`])
    const forced = fakeRun({})
    removeAgentWorktree(root, 'builder-1', { force: true }, forced.run)
    expect(forced.calls.map((c) => c.cmd)).toEqual([`git worktree remove "${worktreePath}" --force`])
  })

  it('reports detail when git fails', () => {
    const { run } = fakeRun({ 'git worktree remove': new Error('contains modified files') })
    const r = removeAgentWorktree(root, 'builder-1', { force: false }, run)
    expect(r.removed).toBe(false)
    expect(r.detail).toContain('modified files')
  })
})
