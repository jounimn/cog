import { describe, it, expect } from 'vitest'
import { openDialog, isTopDialog } from './dialog-stack'

describe('dialog stack', () => {
  it('only the last opened dialog is on top', () => {
    const a = Symbol('a'), b = Symbol('b')
    const closeA = openDialog(a)
    expect(isTopDialog(a)).toBe(true)
    const closeB = openDialog(b)
    expect(isTopDialog(a)).toBe(false)
    expect(isTopDialog(b)).toBe(true)
    closeB()
    expect(isTopDialog(a)).toBe(true)
    closeA()
    expect(isTopDialog(a)).toBe(false)
  })

  it('closing a dialog underneath keeps the top one on top', () => {
    const a = Symbol('a'), b = Symbol('b')
    const closeA = openDialog(a)
    const closeB = openDialog(b)
    closeA()
    expect(isTopDialog(b)).toBe(true)
    closeB()
    closeB()
    expect(isTopDialog(b)).toBe(false)
  })
})
