import { describe, it, expect } from 'vitest'
import { topVisibleWindow } from './window-stack'

const win = (id: string, zIndex: number, minimized = false) => ({ id, zIndex, minimized })

describe('topVisibleWindow', () => {
  it('is undefined with no windows', () => {
    expect(topVisibleWindow([])).toBeUndefined()
  })
  it('picks the highest zIndex', () => {
    expect(topVisibleWindow([win('a', 1), win('b', 3), win('c', 2)])?.id).toBe('b')
  })
  it('skips minimized windows, however high', () => {
    expect(topVisibleWindow([win('a', 1), win('b', 9, true), win('c', 2)])?.id).toBe('c')
  })
  it('is undefined when every window is minimized', () => {
    expect(topVisibleWindow([win('a', 1, true), win('b', 2, true)])).toBeUndefined()
  })
  it('keeps the earlier window on a zIndex tie', () => {
    expect(topVisibleWindow([win('a', 5), win('b', 5)])?.id).toBe('a')
  })
})
