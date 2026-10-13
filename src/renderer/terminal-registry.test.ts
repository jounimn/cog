import { describe, it, expect, vi } from 'vitest'
import { createTerminalRegistry } from './terminal-registry'

interface FakeHandle {
  id: string
  dispose: () => void
}

function fakeFactory() {
  const created: FakeHandle[] = []
  const factory = vi.fn((agentId: string): FakeHandle => {
    const h = { id: agentId, dispose: vi.fn() }
    created.push(h)
    return h
  })
  return { factory, created }
}

describe('terminal registry', () => {
  it('creates a handle the first time an agent is acquired', () => {
    const { factory } = fakeFactory()
    const reg = createTerminalRegistry(factory)
    const h = reg.acquire('a1')
    expect(h.id).toBe('a1')
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('returns the SAME handle on re-acquire (tab switch must not rebuild the terminal)', () => {
    const { factory } = fakeFactory()
    const reg = createTerminalRegistry(factory)
    const first = reg.acquire('a1')
    const second = reg.acquire('a1')
    expect(second).toBe(first)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('keeps separate handles per agent', () => {
    const { factory } = fakeFactory()
    const reg = createTerminalRegistry(factory)
    expect(reg.acquire('a1')).not.toBe(reg.acquire('a2'))
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('dispose tears the handle down and forgets it', () => {
    const { factory, created } = fakeFactory()
    const reg = createTerminalRegistry(factory)
    reg.acquire('a1')
    reg.dispose('a1')
    expect(created[0].dispose).toHaveBeenCalledTimes(1)
    expect(reg.has('a1')).toBe(false)
  })

  it('acquire after dispose builds a fresh handle', () => {
    const { factory, created } = fakeFactory()
    const reg = createTerminalRegistry(factory)
    const first = reg.acquire('a1')
    reg.dispose('a1')
    const again = reg.acquire('a1')
    expect(again).not.toBe(first)
    expect(created).toHaveLength(2)
  })

  it('dispose of an unknown agent is a no-op', () => {
    const { factory } = fakeFactory()
    const reg = createTerminalRegistry(factory)
    expect(() => reg.dispose('ghost')).not.toThrow()
  })

  it('lists the agents it currently holds', () => {
    const { factory } = fakeFactory()
    const reg = createTerminalRegistry(factory)
    reg.acquire('a1')
    reg.acquire('a2')
    reg.dispose('a1')
    expect(reg.ids()).toEqual(['a2'])
  })
})
