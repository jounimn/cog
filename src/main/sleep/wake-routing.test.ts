import { describe, it, expect } from 'vitest'
import { routeTaskNudge, type RoutableAgent, type TaskLike } from './wake-routing'

const a = (name: string, o: Partial<RoutableAgent> = {}): RoutableAgent => ({
  id: `id-${name}`, name, role: 'worker', status: 'idle', ...o
})
const task = (o: Partial<TaskLike> = {}): TaskLike => ({ id: 't1', title: 'T', createdBy: 'boss', ...o })

describe('routeTaskNudge', () => {
  it('direct target awake is written', () => {
    expect(routeTaskNudge(task({ targetAgent: 'w1' }), [a('w1')])).toEqual({ wake: [], write: ['w1'] })
  })
  it('direct target sleeping is woken', () => {
    expect(routeTaskNudge(task({ targetAgent: 'w1' }), [a('w1', { status: 'sleeping' })])).toEqual({ wake: ['id-w1'], write: [] })
  })
  it('direct target unknown yields nothing', () => {
    expect(routeTaskNudge(task({ targetAgent: 'nope' }), [a('w1')])).toEqual({ wake: [], write: [] })
  })
  it('direct target waking is neither written nor woken', () => {
    expect(routeTaskNudge(task({ targetAgent: 'w1' }), [a('w1', { status: 'waking' })])).toEqual({ wake: [], write: [] })
  })
  it('role with two awake writes both and leaves sleeping alone', () => {
    const r = routeTaskNudge(task({ targetRole: 'worker' }), [a('w1'), a('w2', { status: 'working' }), a('w3', { status: 'sleeping', sleptAt: '2026-01-01T00:00:00Z' })])
    expect(r).toEqual({ wake: [], write: ['w1', 'w2'] })
  })
  it('role with none awake wakes only the most recently slept', () => {
    const r = routeTaskNudge(task({ targetRole: 'worker' }), [
      a('w1', { status: 'sleeping', sleptAt: '2026-01-01T00:00:00Z' }),
      a('w2', { status: 'sleeping', sleptAt: '2026-03-01T00:00:00Z' }),
      a('w3', { status: 'sleeping', sleptAt: '2026-02-01T00:00:00Z' })
    ])
    expect(r).toEqual({ wake: ['id-w2'], write: [] })
  })
  it('tab mismatch is excluded', () => {
    const r = routeTaskNudge(task({ targetRole: 'worker', tabId: 'A' }), [a('w1', { tabId: 'B' }), a('w2', { tabId: 'A' }), a('w3')])
    expect(r.write).toEqual(['w2', 'w3'])
  })
  it('creator, user and disconnected are excluded', () => {
    const r = routeTaskNudge(task(), [a('boss'), a('user'), a('w1', { status: 'disconnected' }), a('w2')])
    expect(r).toEqual({ wake: [], write: ['w2'] })
  })
  it('no target and no role routes to non-orchestrators', () => {
    const r = routeTaskNudge(task(), [a('o1', { role: 'orchestrator' }), a('w1'), a('r1', { role: 'researcher' })])
    expect(r).toEqual({ wake: [], write: ['w1', 'r1'] })
  })
})
