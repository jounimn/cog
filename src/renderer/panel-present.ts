// Presentation of Pinboard tasks and Inbox messages: pure mappings to icon, word and tone.
import type { InboxPriority, PinboardTask } from '../shared/types'
import type { IconName } from './ui/Icon'

export type Tone = 'muted' | 'working' | 'success' | 'warning' | 'danger'

/** The order the old Kanban columns used; the list keeps it for its sections. */
export const TASK_STATUS_ORDER: PinboardTask['status'][] = ['open', 'in_progress', 'completed']

const TASK_STATUS: Record<PinboardTask['status'], { icon: IconName; word: string; tone: Tone }> = {
  open: { icon: 'circle', word: 'Open', tone: 'muted' },
  in_progress: { icon: 'circle-dot', word: 'In progress', tone: 'working' },
  completed: { icon: 'circle-check', word: 'Completed', tone: 'success' }
}

export function taskStatusPresentation(status: PinboardTask['status']): { icon: IconName; word: string; tone: Tone } {
  return TASK_STATUS[status]
}

const TASK_PRIORITY: Record<PinboardTask['priority'], { word: string; tone: Tone | null }> = {
  high: { word: 'high', tone: 'danger' },
  medium: { word: 'medium', tone: 'warning' },
  low: { word: 'low', tone: null }
}

export function taskPriorityPresentation(priority: PinboardTask['priority']): { word: string; tone: Tone | null } {
  return TASK_PRIORITY[priority]
}

/** Task ids are uuids; the list shows a short mono prefix, the detail view the full id. */
export function shortTaskId(id: string): string {
  return id.slice(0, 6)
}

export function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

const INBOX_PRIORITY: Record<InboxPriority, { word: string; tone: Tone | null; icon: IconName | null }> = {
  low: { word: 'Low', tone: null, icon: null },
  normal: { word: 'Normal', tone: null, icon: null },
  high: { word: 'High', tone: 'warning', icon: 'circle-alert' },
  urgent: { word: 'Urgent', tone: 'danger', icon: 'circle-alert' }
}

export function inboxPriorityPresentation(priority: InboxPriority): { word: string; tone: Tone | null; icon: IconName | null } {
  return INBOX_PRIORITY[priority]
}

export const INBOX_FILTER_LABELS = {
  all: 'All',
  unread: 'Unread',
  'high+': 'High+ only',
  urgent: 'Urgent only'
} as const

/** Time left on a stale-alert snooze: "2h 5m", "5m 9s" or "9s". */
export function snoozeCountdown(remainingMs: number): string {
  const totalSec = Math.floor(Math.max(0, remainingMs) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
