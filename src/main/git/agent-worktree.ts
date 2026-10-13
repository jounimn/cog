import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { agentSlug } from '../../shared/agent-worktree-defaults'
import { isBranchBusyError, parseWorktreeList, type WorktreeEntry } from './agent-worktree-pure'

/** Runs a git command; throws on non-zero exit with the stderr in error.message. */
export type Run = (cmd: string, cwd: string) => string

export const defaultRun: Run = (cmd, cwd) => {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (e) {
    const err = e as { message?: string; stderr?: string | Buffer }
    const stderr = err.stderr ? String(err.stderr) : ''
    throw new Error(`${err.message ?? 'git failed'}${stderr ? `\n${stderr}` : ''}`)
  }
}

export function worktreePaths(
  projectRoot: string,
  agentName: string
): { slug: string; worktreePath: string; branch: string; workDir: string } {
  const slug = agentSlug(agentName)
  return {
    slug,
    worktreePath: path.join(projectRoot, '.cog', 'worktrees', slug),
    branch: `cog/${slug}`,
    workDir: path.join(projectRoot, '.cog', 'work', slug)
  }
}

export function ensureWorkDir(projectRoot: string, agentName: string): string {
  const { workDir } = worktreePaths(projectRoot, agentName)
  fs.mkdirSync(workDir, { recursive: true })
  return workDir
}

const norm = (p: string): string => path.resolve(p).toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '')
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function findRegistered(entries: WorktreeEntry[], worktreePath: string): WorktreeEntry | undefined {
  const target = norm(worktreePath)
  return entries.find((e) => (e.head !== '' || e.branch !== null || e.detached) && norm(e.path) === target)
}

function stamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export type EnsureResult =
  | { ok: true; path: string; branch: string; workDir: string; reused: boolean; staleRenamedTo?: string }
  | { ok: false; reason: 'not-git' | 'git-missing' | 'branch-busy' | 'git-error'; detail: string; workDir: string }

export function ensureAgentWorktree(projectRoot: string, agentName: string, run: Run = defaultRun): EnsureResult {
  const { worktreePath, branch } = worktreePaths(projectRoot, agentName)
  const workDir = ensureWorkDir(projectRoot, agentName)
  const fail = (reason: 'not-git' | 'git-missing' | 'branch-busy' | 'git-error', detail: string): EnsureResult => ({
    ok: false,
    reason,
    detail,
    workDir
  })

  try {
    run('git rev-parse --is-inside-work-tree', projectRoot)
  } catch (e) {
    const detail = msg(e)
    return fail(/ENOENT|not recognized|not found/i.test(detail) ? 'git-missing' : 'not-git', detail)
  }

  try {
    try { run('git worktree prune', projectRoot) } catch { /* best effort */ }
    const entries = parseWorktreeList(run('git worktree list --porcelain', projectRoot))
    if (findRegistered(entries, worktreePath)) {
      return { ok: true, path: worktreePath, branch, workDir, reused: true }
    }

    let staleRenamedTo: string | undefined
    if (fs.existsSync(worktreePath)) {
      if (fs.readdirSync(worktreePath).length === 0) {
        fs.rmdirSync(worktreePath)
      } else {
        staleRenamedTo = `${worktreePath}.stale-${stamp(new Date())}`
        fs.renameSync(worktreePath, staleRenamedTo)
      }
    }
    fs.mkdirSync(path.dirname(worktreePath), { recursive: true })

    let branchExists = true
    try {
      run(`git show-ref --verify --quiet refs/heads/${branch}`, projectRoot)
    } catch {
      branchExists = false
    }
    const addCmd = branchExists
      ? `git worktree add "${worktreePath}" ${branch}`
      : `git worktree add -b ${branch} "${worktreePath}" HEAD`
    try {
      run(addCmd, projectRoot)
    } catch (e) {
      const detail = msg(e)
      return fail(isBranchBusyError(detail) ? 'branch-busy' : 'git-error', detail)
    }
    return { ok: true, path: worktreePath, branch, workDir, reused: false, ...(staleRenamedTo ? { staleRenamedTo } : {}) }
  } catch (e) {
    return fail('git-error', msg(e))
  }
}

export type ReleaseResult = {
  removed: boolean
  reason: 'clean' | 'dirty' | 'absent' | 'git-error'
  path: string
  detail?: string
}

export function releaseAgentWorktree(projectRoot: string, agentName: string, run: Run = defaultRun): ReleaseResult {
  const { worktreePath } = worktreePaths(projectRoot, agentName)
  try {
    const entries = parseWorktreeList(run('git worktree list --porcelain', projectRoot))
    if (!findRegistered(entries, worktreePath)) return { removed: false, reason: 'absent', path: worktreePath }
    if (run('git status --porcelain', worktreePath).trim() !== '') {
      return { removed: false, reason: 'dirty', path: worktreePath }
    }
    run(`git worktree remove "${worktreePath}"`, projectRoot)
    return { removed: true, reason: 'clean', path: worktreePath }
  } catch (e) {
    return { removed: false, reason: 'git-error', path: worktreePath, detail: msg(e) }
  }
}

export interface AgentWorktreeInfo {
  slug: string
  path: string
  branch: string | null
  dirty: boolean
}

export function listAgentWorktrees(projectRoot: string, run: Run = defaultRun): AgentWorktreeInfo[] {
  let entries: WorktreeEntry[]
  try {
    entries = parseWorktreeList(run('git worktree list --porcelain', projectRoot))
  } catch {
    return []
  }
  const base = norm(path.join(projectRoot, '.cog', 'worktrees')) + '/'
  const out: AgentWorktreeInfo[] = []
  for (const e of entries) {
    const n = norm(e.path)
    if (!n.startsWith(base)) continue
    const slug = e.path.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() ?? ''
    const wtPath = path.join(projectRoot, '.cog', 'worktrees', slug)
    let dirty = false
    try {
      dirty = run('git status --porcelain', wtPath).trim() !== ''
    } catch { /* unreadable worktree: report clean */ }
    out.push({ slug, path: wtPath, branch: e.branch, dirty })
  }
  return out
}

export function removeAgentWorktree(
  projectRoot: string,
  slug: string,
  opts: { force: boolean },
  run: Run = defaultRun
): { removed: boolean; detail?: string } {
  const { worktreePath } = worktreePaths(projectRoot, slug)
  try {
    run(`git worktree remove "${worktreePath}"${opts.force ? ' --force' : ''}`, projectRoot)
    return { removed: true }
  } catch (e) {
    return { removed: false, detail: msg(e) }
  }
}
