import { describe, it, expect } from 'vitest'
import { getPanelType } from './panel-ids'

describe('getPanelType', () => {
  it('resolves tab-qualified panel ids', () => {
    expect(getPanelType('__pinboard__::tab-1')).toBe('pinboard')
  })
  it('resolves bare panel ids', () => {
    expect(getPanelType('__inbox__')).toBe('inbox')
  })
  it('rejects ids that merely share a prefix', () => {
    expect(getPanelType('__pinboardx')).toBeUndefined()
  })
  it('returns undefined for agent ids', () => {
    expect(getPanelType('agent-123')).toBeUndefined()
  })
})
