// Presentation of panel data (tasks, messages, schedules, usage): pure mappings to icon, word and tone.
import type { InboxPriority, PinboardTask, ScheduleStatus, FireHistoryEntry } from '../shared/types'
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

// ---------- Schedules ----------

/** "15min", or whole hours as "2h" (the old inline rule of both schedule rows). */
export function scheduleIntervalLabel(intervalMinutes: number): string {
  return intervalMinutes >= 60 && intervalMinutes % 60 === 0
    ? `${intervalMinutes / 60}h`
    : `${intervalMinutes}min`
}

/** A duration as "0m", "45m", "2h" or "2h 5m". */
export function hoursMinutes(ms: number): string {
  if (ms <= 0) return '0m'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remMin = mins % 60
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`
}

/** Local wall-clock time as "HH:MM". */
export function clockTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const SCHEDULE_STATUS: Record<ScheduleStatus, { icon: IconName; word: string; tone: Tone }> = {
  active: { icon: 'circle-dot', word: 'Active', tone: 'working' },
  paused: { icon: 'pause', word: 'Paused', tone: 'warning' },
  stopped: { icon: 'square', word: 'Stopped', tone: 'muted' },
  expired: { icon: 'square', word: 'Expired', tone: 'muted' }
}

export function scheduleStatusPresentation(status: ScheduleStatus): { icon: IconName; word: string; tone: Tone } {
  return SCHEDULE_STATUS[status]
}

export function fireOutcomePresentation(outcome: FireHistoryEntry['outcome']): { icon: IconName; word: string; tone: Tone } {
  return outcome === 'fired'
    ? { icon: 'circle-check', word: 'Fired', tone: 'success' }
    : { icon: 'circle-alert', word: 'Agent offline', tone: 'warning' }
}

// ---------- Usage ----------

export interface UsagePresentation {
  /** Percent used, 0..100. */
  pct: number
  /** null below 70% (the bar stays steel); warning above 70%, danger above 90%, as before. */
  tone: 'warning' | 'danger' | null
  /** The word that goes with the tone, so colour is never alone. */
  word: string | null
  /** "40% remaining" or "1,200 / 5,000 tokens left". */
  left: string
}

export function usagePresentation(used: number, total: number, unit: string): UsagePresentation {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const remaining = total - used
  const tone = pct > 90 ? 'danger' : pct > 70 ? 'warning' : null
  const word = tone === 'danger' ? 'Near limit' : tone === 'warning' ? 'Running low' : null
  const left = unit === 'percent'
    ? `${Math.round(100 - pct)}% remaining`
    : `${remaining.toLocaleString()} / ${total.toLocaleString()} ${unit} left`
  return { pct, tone, word, left }
}

/** Time since spawn as "3h 12m" or "12m" (the old Usage rule). */
export function uptimeLabel(spawnedAt: string, now: number = Date.now()): string {
  const ms = now - new Date(spawnedAt).getTime()
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(mins / 60)
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}
