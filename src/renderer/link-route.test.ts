import { describe, it, expect } from 'vitest'
import { routePoints, routeD, routeLength, arrowPoints, chipLinkIndexes, PORT, ARROW_LEN } from './link-route'

describe('routePoints / routeD', () => {
  it('keeps the existing right-then-vertical-then-right route when the target is to the right', () => {
    const pts = routePoints({ x: 100, y: 50 }, { x: 400, y: 200 }, 2)
    // midX = (130 + 370) / 2 + (2 * 8 - 16) = 250
    expect(routeD(pts)).toBe('M 100 50 H 250 V 200 H 400')
  })

  it('goes round when the target is to the left', () => {
    const pts = routePoints({ x: 500, y: 100 }, { x: 100, y: 300 }, 0)
    // offset -16: clearY = 100 - 60 - 16 = 24
    expect(routeD(pts)).toBe('M 500 100 H 530 V 24 H 70 V 300 H 100')
  })
})

describe('routeLength', () => {
  it('sums the orthogonal segments', () => {
    expect(routeLength([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 30, y: 5 }])).toBe(35)
  })
})

describe('arrowPoints', () => {
  it('puts the tip on the outer edge of the target port, pointing into the plate', () => {
    const pts = [{ x: 0, y: 100 }, { x: 200, y: 100 }]
    const tipX = 200 - PORT / 2
    expect(arrowPoints(pts)).toBe(`${tipX - ARROW_LEN},104.5 ${tipX},100 ${tipX - ARROW_LEN},95.5`)
  })
})

describe('chipLinkIndexes', () => {
  it('gives each group one chip, on its longest link', () => {
    const set = chipLinkIndexes(['a', 'a', 'b', undefined, 'a'], [100, 300, 50, 999, 300])
    expect([...set].sort()).toEqual([1, 2])
  })
})
