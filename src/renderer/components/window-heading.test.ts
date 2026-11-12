import { describe, it, expect } from 'vitest'
import { windowHeading, windowAgent } from './window-heading'
import type { WindowState } from '../hooks/useWindowManager'
import type { AgentState } from '../../shared/types'

const win = (id: string, title = 'Window'): WindowState => ({ id, title, x: 0, y: 0, width: 400, height: 300, zIndex: 1, minimized: false })
const agent = (over: Partial<AgentState>): AgentState => ({
  id: 'a1', name: 'ada', role: 'reviewer', cli: 'claude', model: 'opus', status: 'idle', createdAt: '', ...over
} as AgentState)

describe('windowHeading', () => {
  it('shows an agent as name · role over its cli and model', () => {
    expect(windowHeading(win('a1'), [agent({})])).toEqual({
      title: 'ada · reviewer',
      spec: [{ text: 'claude' }, { text: 'opus', mono: true }]
    })
  })
  it('drops empty spec parts', () => {
    expect(windowHeading(win('a1'), [agent({ model: '' })]).spec).toEqual([{ text: 'claude' }])
  })
  it('shows a panel by its window title, with no spec', () => {
    expect(windowHeading(win('__pinboard__::tab-1', 'Pinboard'), [agent({ id: '__pinboard__::tab-1' })])).toEqual({ title: 'Pinboard' })
  })
  it('gives the Sketchpad panel the book icon', () => {
    expect(windowHeading(win('__board__::tab-1', 'Sketchpad'), [])).toEqual({ title: 'Sketchpad', icon: 'book-open' })
  })
  it('falls back to the window title when the agent is gone', () => {
    expect(windowHeading(win('gone', 'ada (claude)'), [agent({})])).toEqual({ title: 'ada (claude)' })
  })
})

describe('windowAgent', () => {
  it('never matches a panel id to an agent', () => {
    expect(windowAgent(win('__info__'), [agent({ id: '__info__' })])).toBeUndefined()
  })
  it('finds the agent that owns the window', () => {
    expect(windowAgent(win('a1'), [agent({})])?.name).toBe('ada')
  })
})
