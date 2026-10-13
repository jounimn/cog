import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { resolveProjectPath } from '../../src/main/shared/project-path'

describe('resolveProjectPath baseDir', () => {
  let tmp: string
  let root: string
  let w1: string

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-pp-'))
    root = path.join(tmp, 'root')
    w1 = path.join(root, '.cog', 'worktrees', 'w1')
    fs.mkdirSync(w1, { recursive: true })
    fs.writeFileSync(path.join(root, 'package.json'), '{}')
    fs.writeFileSync(path.join(w1, 'package.json'), '{}')
  })

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('resolves relative paths against baseDir', () => {
    const r = resolveProjectPath(root, 'package.json', w1)
    expect(r).not.toBeNull()
    expect(path.resolve(r as string)).toBe(path.resolve(w1, 'package.json'))
  })

  it('still resolves against root without baseDir', () => {
    const r = resolveProjectPath(root, 'package.json')
    expect(r).not.toBeNull()
    expect(path.resolve(r as string)).toBe(path.resolve(root, 'package.json'))
  })

  it('accepts absolute paths inside the root from any base', () => {
    const abs = path.join(root, 'package.json')
    const r = resolveProjectPath(root, abs, w1)
    expect(r).not.toBeNull()
    expect(path.resolve(r as string)).toBe(path.resolve(abs))
  })

  it('refuses escapes from the base dir', () => {
    // w1 is three levels below root, so four `..` land above it.
    expect(resolveProjectPath(root, '../../../../outside', w1)).toBeNull()
    expect(resolveProjectPath(root, '../../../../../etc/passwd', w1)).toBeNull()
    // Climbing back up to the root itself stays contained.
    const r = resolveProjectPath(root, '../../../outside', w1)
    expect(r && path.resolve(r)).toBe(path.resolve(root, 'outside'))
  })

  it('refuses a baseDir outside the root', () => {
    expect(resolveProjectPath(root, 'package.json', tmp)).toBeNull()
  })
})
