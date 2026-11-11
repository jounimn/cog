import { describe, it, expect } from 'vitest'
import { statusPresentation } from './status-chip'
import type { AgentStatus } from '../shared/types'

const ALL: AgentStatus[] = ['idle', 'active', 'working', 'disconnected', 'sleeping', 'waking']

describe('statusPresentation', () => {
  it('maps working and active to a breathing activity chip', () => {
    const expected = { label: 'working', icon: 'activity', tone: 'working', breathing: true }
    expect(statusPresentation('working')).toEqual(expected)
    expect(statusPresentation('active')).toEqual(expected)
  })

  it('maps idle to a muted circle-dot', () => {
    expect(statusPresentation('idle')).toEqual({
      label: 'idle', icon: 'circle-dot', tone: 'muted', breathing: false
    })
  })

  it('maps sleeping to moon', () => {
    const p = statusPresentation('sleeping')
    expect(p.label).toBe('sleeping')
    expect(p.icon).toBe('moon')
  })

  it('maps waking to loader', () => {
    const p = statusPresentation('waking')
    expect(p.label).toBe('waking')
    expect(p.icon).toBe('loader')
  })

  it('maps disconnected to a danger unplug', () => {
    const p = statusPresentation('disconnected')
    expect(p).toMatchObject({ label: 'disconnected', icon: 'unplug', tone: 'danger' })
  })

  it('gives every AgentStatus a non-empty label', () => {
    for (const s of ALL) expect(statusPresentation(s).label.length).toBeGreaterThan(0)
  })
})
