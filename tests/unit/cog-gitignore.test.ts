import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { ensureCogGitignore } from '../../src/main/project/project-manager'

describe('ensureCogGitignore', () => {
  let cogDir: string
  let gitignorePath: string

  beforeEach(() => {
    cogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-gi-'))
    gitignorePath = path.join(cogDir, '.gitignore')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(cogDir, { recursive: true, force: true })
  })

  const read = (): string => fs.readFileSync(gitignorePath, 'utf-8')

  it('creates the file with db lines plus worktrees/ and work/', () => {
    ensureCogGitignore(cogDir)

    expect(fs.existsSync(gitignorePath)).toBe(true)
    expect(read()).toBe(
      'cog.db\n' +
        'cog.db-wal\n' +
        'cog.db-shm\n' +
        'agentorch.db\n' +
        'agentorch.db-wal\n' +
        'agentorch.db-shm\n' +
        'worktrees/\n' +
        'work/\n'
    )
  })

  it('appends missing lines to an existing file without rewriting it', () => {
    fs.writeFileSync(gitignorePath, 'cog.db\n', 'utf-8')

    ensureCogGitignore(cogDir)

    expect(read()).toBe('cog.db\nworktrees/\nwork/\n')
  })

  it('keeps existing content byte-for-byte, including CRLF line endings and custom lines', () => {
    const seed = 'node_modules/\r\ncog.db\r\n'
    fs.writeFileSync(gitignorePath, seed, 'utf-8')

    ensureCogGitignore(cogDir)

    const result = read()
    expect(result.startsWith(seed)).toBe(true)
    expect(result).toBe(seed + 'worktrees/\nwork/\n')
  })

  it('starts the appended lines on a new line when the file lacks a trailing newline', () => {
    fs.writeFileSync(gitignorePath, 'cog.db', 'utf-8')

    ensureCogGitignore(cogDir)

    expect(read()).toBe('cog.db\nworktrees/\nwork/\n')
  })

  it('appends only the lines that are missing, comparing trimmed lines', () => {
    fs.writeFileSync(gitignorePath, 'cog.db\n  worktrees/  \n', 'utf-8')

    ensureCogGitignore(cogDir)

    expect(read()).toBe('cog.db\n  worktrees/  \nwork/\n')
  })

  it('is idempotent: a second call leaves the content unchanged', () => {
    ensureCogGitignore(cogDir)
    const afterFirst = read()

    ensureCogGitignore(cogDir)

    expect(read()).toBe(afterFirst)
  })

  it('never throws and warns when the file cannot be written', () => {
    const missingDir = path.join(cogDir, 'does-not-exist')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => ensureCogGitignore(missingDir)).not.toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(fs.existsSync(path.join(missingDir, '.gitignore'))).toBe(false)
  })
})
