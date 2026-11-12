import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getStatus } from './git-ops'

describe('getStatus', () => {
  it('keeps the first unstaged file intact (leading space of porcelain output)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-gitops-'))
    const git = (c: string) => execSync(`git ${c}`, { cwd: dir, stdio: 'pipe' })
    git('init -q')
    fs.writeFileSync(path.join(dir, 'math.js'), 'a\n')
    git('add -A')
    git('-c user.name=t -c user.email=t@example.invalid commit -qm init')
    fs.writeFileSync(path.join(dir, 'math.js'), 'b\n')
    const s = getStatus(dir)
    expect(s.staged).toEqual([])
    expect(s.unstaged.map(f => f.path)).toEqual(['math.js'])
    expect(s.unstaged[0].status).toBe('modified')
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 }) } catch { /* Windows may hold a handle; temp dir */ }
  })
})
