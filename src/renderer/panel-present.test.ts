import { describe, it, expect } from 'vitest'
import {
  TASK_STATUS_ORDER, taskStatusPresentation, taskPriorityPresentation, shortTaskId, clip,
  inboxPriorityPresentation, INBOX_FILTER_LABELS, snoozeCountdown
} from './panel-present'

describe('taskStatusPresentation', () => {
  it('maps every status to an icon, a word and the spec tone', () => {
    expect(taskStatusPresentation('open')).toEqual({ icon: 'circle', word: 'Open', tone: 'muted' })
    expect(taskStatusPresentation('in_progress')).toEqual({ icon: 'circle-dot', word: 'In progress', tone: 'working' })
    expect(taskStatusPresentation('completed')).toEqual({ icon: 'circle-check', word: 'Completed', tone: 'success' })
  })

  it('keeps the old column order', () => {
    expect(TASK_STATUS_ORDER).toEqual(['open', 'in_progress', 'completed'])
  })
})

describe('taskPriorityPresentation', () => {
  it('gives every priority a word; only high and medium take a tone', () => {
    expect(taskPriorityPresentation('high')).toEqual({ word: 'high', tone: 'danger' })
    expect(taskPriorityPresentation('medium')).toEqual({ word: 'medium', tone: 'warning' })
    expect(taskPriorityPresentation('low')).toEqual({ word: 'low', tone: null })
  })
})

describe('shortTaskId', () => {
  it('shows the first 6 characters of a uuid', () => {
    expect(shortTaskId('3f2a9c1e-7b4d-4e2a-9c1e-000000000000')).toBe('3f2a9c')
  })
  it('leaves short ids alone', () => {
    expect(shortTaskId('14')).toBe('14')
  })
})

describe('clip', () => {
  it('cuts long text at the limit and adds an ellipsis', () => {
    expect(clip('abcdef', 3)).toBe('abc…')
  })
  it('leaves text at or under the limit alone', () => {
    expect(clip('abc', 3)).toBe('abc')
    expect(clip('', 3)).toBe('')
  })
})

describe('inboxPriorityPresentation', () => {
  it('maps urgent to danger and high to warning, each with an icon', () => {
    expect(inboxPriorityPresentation('urgent')).toEqual({ word: 'Urgent', tone: 'danger', icon: 'circle-alert' })
    expect(inboxPriorityPresentation('high')).toEqual({ word: 'High', tone: 'warning', icon: 'circle-alert' })
  })
  it('leaves normal and low untoned, word only', () => {
    expect(inboxPriorityPresentation('normal')).toEqual({ word: 'Normal', tone: null, icon: null })
    expect(inboxPriorityPresentation('low')).toEqual({ word: 'Low', tone: null, icon: null })
  })
})

describe('INBOX_FILTER_LABELS', () => {
  it('has a label for every filter value the panel offers', () => {
    expect(Object.keys(INBOX_FILTER_LABELS)).toEqual(['all', 'unread', 'high+', 'urgent'])
  })
})

describe('snoozeCountdown', () => {
  it('formats hours and minutes, minutes and seconds, or seconds', () => {
    expect(snoozeCountdown((2 * 3600 + 5 * 60 + 9) * 1000)).toBe('2h 5m')
    expect(snoozeCountdown((5 * 60 + 9) * 1000)).toBe('5m 9s')
    expect(snoozeCountdown(9_500)).toBe('9s')
  })
  it('never goes below zero', () => {
    expect(snoozeCountdown(-1000)).toBe('0s')
  })
})
