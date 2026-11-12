import { describe, it, expect } from 'vitest'
import { commitKind } from './commit-kind'

describe('commitKind', () => {
  it('reads feat and fix with or without a scope', () => {
    expect(commitKind('feat: add x')).toBe('feat')
    expect(commitKind('feat(ui): add x')).toBe('feat')
    expect(commitKind('fix: y')).toBe('fix')
    expect(commitKind('fix(main): y')).toBe('fix')
  })

  it('reads refactor only without a scope, as before', () => {
    expect(commitKind('refactor: z')).toBe('refactor')
    expect(commitKind('refactor(ui): z')).toBe('other')
  })

  it('groups chore, docs and test', () => {
    expect(commitKind('chore: bump')).toBe('chore')
    expect(commitKind('docs: readme')).toBe('chore')
    expect(commitKind('test: more')).toBe('chore')
  })

  it('falls back to other', () => {
    expect(commitKind('Merge branch main')).toBe('other')
    expect(commitKind('features: not a prefix')).toBe('other')
  })
})
