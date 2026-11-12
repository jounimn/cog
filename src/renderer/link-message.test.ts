import { describe, it, expect } from 'vitest'
import { linkKeyForMessage } from './link-message'

const agents = [
  { id: 'o', name: 'orchestrator', tabId: 't1' },
  { id: 'b', name: 'backend', tabId: 't1' },
  { id: 'f', name: 'frontend', tabId: 't2' },
  { id: 'q', name: 'qa', tabId: 't1' }
]
const links = [{ from: 'o', to: 'b' }, { from: 'o', to: 'f' }]

describe('linkKeyForMessage', () => {
  it('returns the key for a message along a link', () => {
    expect(linkKeyForMessage({ from: 'orchestrator', to: 'backend' }, links, agents, 't1')).toEqual({ key: 'o->b', reversed: false })
  })
  it('returns the link key, reversed, for a reverse-direction message', () => {
    expect(linkKeyForMessage({ from: 'backend', to: 'orchestrator' }, links, agents, 't1')).toEqual({ key: 'o->b', reversed: true })
  })
  it('accepts ids and name-keyed links', () => {
    expect(linkKeyForMessage({ from: 'o', to: 'b' }, [{ from: 'orchestrator', to: 'backend' }], agents, 't1')).toEqual({ key: 'o->b', reversed: false })
  })
  it('returns null for an unlinked pair', () => {
    expect(linkKeyForMessage({ from: 'backend', to: 'qa' }, links, agents, 't1')).toBeNull()
  })
  it('returns null when addressed to the user', () => {
    expect(linkKeyForMessage({ from: 'orchestrator', to: 'user' }, links, agents, 't1')).toBeNull()
  })
  it('returns null for an agent on another tab', () => {
    expect(linkKeyForMessage({ from: 'orchestrator', to: 'frontend' }, links, agents, 't1')).toBeNull()
  })
  it('returns null for an event tab that is not active', () => {
    expect(linkKeyForMessage({ from: 'orchestrator', to: 'backend', tabId: 't2' }, links, agents, 't1')).toBeNull()
  })
  it('returns null and does not throw for an unknown agent', () => {
    expect(linkKeyForMessage({ from: 'ghost', to: 'backend' }, links, agents, 't1')).toBeNull()
  })
})
