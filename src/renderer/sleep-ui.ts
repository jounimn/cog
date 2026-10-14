import type { AgentStatus } from '../shared/types'
import { sessionStrategyFor } from '../shared/session-strategy'

export interface CardPresentation {
  opacity: number
  titlePrefix: string
  menu: Array<'sleep' | 'wake'>
}

export interface CardSleepInput {
  status: AgentStatus
  /** Defaults to a CLI with a resumable session. */
  cli?: string
  /** Defaults to true. */
  sessionStarted?: boolean
  /** Defaults to false. */
  neverSleep?: boolean
}

/**
 * Mirrors the main process's manual-sleep check (canSleep with auto=false):
 * a resumable CLI, a session that exists, not excluded, and a live process.
 */
export function canSleepNow(input: CardSleepInput): boolean {
  const { status, cli = 'claude', sessionStarted = true, neverSleep = false } = input
  if (status === 'disconnected' || status === 'sleeping' || status === 'waking') return false
  if (sessionStrategyFor(cli) === 'none') return false
  return sessionStarted && !neverSleep
}

export function cardPresentation(input: AgentStatus | CardSleepInput): CardPresentation {
  const info: CardSleepInput = typeof input === 'string' ? { status: input } : input
  if (info.status === 'sleeping') return { opacity: 0.5, titlePrefix: '🌙 ', menu: ['wake'] }
  if (info.status === 'waking') return { opacity: 0.5, titlePrefix: '⏳ ', menu: [] }
  return { opacity: 1, titlePrefix: '', menu: canSleepNow(info) ? ['sleep'] : [] }
}

/** A sleep-settings number field's typed text, or null when it is not a whole number >= 0 (empty included). */
export function parseSleepNumber(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.floor(n)
}
