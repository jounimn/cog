import { describe, it, expect } from 'vitest'
import { diffLineKind, fileStatusPresentation, splitPath } from './git-present'

describe('diffLineKind', () => {
  it('classifies additions and removals, not the file headers', () => {
    expect(diffLineKind('+const a = 1')).toBe('add')
    expect(diffLineKind('-const a = 0')).toBe('del')
    expect(diffLineKind('+++ b/src/a.ts')).toBe('ctx')
    expect(diffLineKind('--- a/src/a.ts')).toBe('ctx')
  })

  it('classifies hunk headers and meta lines', () => {
    expect(diffLineKind('@@ -1,3 +1,4 @@')).toBe('hunk')
    expect(diffLineKind('diff --git a/x b/x')).toBe('meta')
    expect(diffLineKind('index 1234567..89abcde 100644')).toBe('meta')
  })

  it('treats context and empty lines as context', () => {
    expect(diffLineKind(' unchanged')).toBe('ctx')
    expect(diffLineKind('')).toBe('ctx')
  })
})

describe('fileStatusPresentation', () => {
  it('maps every git status to a letter, a word and a tone', () => {
    expect(fileStatusPresentation('added')).toEqual({ letter: 'A', label: 'added', tone: 'success' })
    expect(fileStatusPresentation('modified')).toEqual({ letter: 'M', label: 'modified', tone: 'warning' })
    expect(fileStatusPresentation('deleted')).toEqual({ letter: 'D', label: 'deleted', tone: 'danger' })
    expect(fileStatusPresentation('renamed')).toEqual({ letter: 'R', label: 'renamed', tone: 'working' })
  })

  it('returns a copy', () => {
    const p = fileStatusPresentation('added')
    p.letter = 'X'
    expect(fileStatusPresentation('added').letter).toBe('A')
  })
})

describe('splitPath', () => {
  it('splits a nested path', () => {
    expect(splitPath('src/renderer/a.ts')).toEqual({ name: 'a.ts', dir: 'src/renderer' })
  })
  it('keeps a root file whole', () => {
    expect(splitPath('README.md')).toEqual({ name: 'README.md', dir: '' })
  })
})
