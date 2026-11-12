import { describe, it, expect } from 'vitest'
import {
  TASK_STATUS_ORDER, taskStatusPresentation, taskPriorityPresentation, shortTaskId, clip,
  inboxPriorityPresentation, INBOX_FILTER_LABELS, snoozeCountdown,
  scheduleIntervalLabel, hoursMinutes, clockTime, scheduleStatusPresentation, fireOutcomePresentation,
  usagePresentation, uptimeLabel
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

describe('scheduleIntervalLabel', () => {
  it('shows whole hours as h and everything else in min', () => {
    expect(scheduleIntervalLabel(15)).toBe('15min')
    expect(scheduleIntervalLabel(60)).toBe('1h')
    expect(scheduleIntervalLabel(120)).toBe('2h')
    expect(scheduleIntervalLabel(90)).toBe('90min')
  })
})

describe('hoursMinutes', () => {
  it('keeps the old row format', () => {
    expect(hoursMinutes(0)).toBe('0m')
    expect(hoursMinutes(-5)).toBe('0m')
    expect(hoursMinutes(45 * 60_000)).toBe('45m')
    expect(hoursMinutes(120 * 60_000)).toBe('2h')
    expect(hoursMinutes(125 * 60_000 + 30_000)).toBe('2h 5m')
  })
})

describe('clockTime', () => {
  it('pads hours and minutes', () => {
    expect(clockTime(new Date(2026, 0, 1, 7, 5).getTime())).toBe('07:05')
    expect(clockTime(new Date(2026, 0, 1, 23, 59).getTime())).toBe('23:59')
  })
})

describe('scheduleStatusPresentation / fireOutcomePresentation', () => {
  it('gives every status an icon and a word', () => {
    expect(scheduleStatusPresentation('active')).toEqual({ icon: 'circle-dot', word: 'Active', tone: 'working' })
    expect(scheduleStatusPresentation('paused')).toEqual({ icon: 'pause', word: 'Paused', tone: 'warning' })
    expect(scheduleStatusPresentation('stopped').word).toBe('Stopped')
    expect(scheduleStatusPresentation('expired').word).toBe('Expired')
  })

  it('maps fire outcomes to the old words', () => {
    expect(fireOutcomePresentation('fired')).toEqual({ icon: 'circle-check', word: 'Fired', tone: 'success' })
    expect(fireOutcomePresentation('skipped_offline')).toEqual({ icon: 'circle-alert', word: 'Agent offline', tone: 'warning' })
  })
})

describe('usagePresentation', () => {
  it('stays untoned up to 70%, warns above 70% and is danger above 90%, each with a word', () => {
    expect(usagePresentation(70, 100, 'percent')).toMatchObject({ pct: 70, tone: null, word: null, left: '30% remaining' })
    expect(usagePresentation(71, 100, 'percent')).toMatchObject({ tone: 'warning', word: 'Running low' })
    expect(usagePresentation(91, 100, 'percent')).toMatchObject({ tone: 'danger', word: 'Near limit' })
  })

  it('clamps at 100% and handles a zero total', () => {
    expect(usagePresentation(150, 100, 'percent').pct).toBe(100)
    expect(usagePresentation(5, 0, 'percent').pct).toBe(0)
  })

  it('writes absolute units as remaining / total', () => {
    expect(usagePresentation(200, 1000, 'requests').left).toBe(`${(800).toLocaleString()} / ${(1000).toLocaleString()} requests left`)
  })
})

describe('uptimeLabel', () => {
  it('shows minutes, then hours and minutes', () => {
    const now = Date.parse('2026-01-01T12:00:00Z')
    expect(uptimeLabel('2026-01-01T11:48:00Z', now)).toBe('12m')
    expect(uptimeLabel('2026-01-01T08:47:00Z', now)).toBe('3h 13m')
  })
})
