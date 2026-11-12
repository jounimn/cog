import { describe, it, expect } from 'vitest'
import { menuNavIndex } from './menu-nav'

describe('menuNavIndex', () => {
  it('ArrowDown from no focus goes to the first item, then steps and wraps', () => {
    expect(menuNavIndex('ArrowDown', -1, 3)).toBe(0)
    expect(menuNavIndex('ArrowDown', 0, 3)).toBe(1)
    expect(menuNavIndex('ArrowDown', 2, 3)).toBe(0)
  })

  it('ArrowUp from no focus goes to the last item, then steps and wraps', () => {
    expect(menuNavIndex('ArrowUp', -1, 3)).toBe(2)
    expect(menuNavIndex('ArrowUp', 2, 3)).toBe(1)
    expect(menuNavIndex('ArrowUp', 0, 3)).toBe(2)
  })

  it('Home and End jump to the ends', () => {
    expect(menuNavIndex('Home', 2, 4)).toBe(0)
    expect(menuNavIndex('End', 0, 4)).toBe(3)
  })

  it('ignores other keys and empty menus', () => {
    expect(menuNavIndex('Enter', 0, 3)).toBeNull()
    expect(menuNavIndex('a', 0, 3)).toBeNull()
    expect(menuNavIndex('ArrowDown', -1, 0)).toBeNull()
  })
})
