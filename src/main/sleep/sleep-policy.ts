import type { AgentStatus, SleepSettings } from '../../shared/types'
import { sessionStrategyFor } from '../agent-session'

export interface SleepCandidate {
  id: string
  name: string
  role: string
  cli: string
  status: AgentStatus
  /** Epoch ms when the agent last became idle. */
  idleSince: number | null
  sessionStarted: boolean
  neverSleep: boolean
  worktreePath?: string
}

export interface SleepPolicyInput {
  agents: SleepCandidate[]
  now: number
  settings: SleepSettings
  freeMemMb: number
  /** Consecutive ticks already below the floor, before this one. */
  lowMemStreak: number
  pendingNudgeNames: Set<string>
  inProgressTaskAgents: Set<string>
  /**
   * Lower-cased names of agents with an OPEN task posted directly to them.
   * The nudge for such a task was already delivered while the agent was
   * awake; if it slept now, nothing would ever wake it for that task.
   */
  openTargetedTaskAgents: Set<string>
  promptNotInjectedIds: Set<string>
  lastMemoryNoteAt: number | null
}

export interface SleepDecision {
  sleep: Array<{ id: string; reason: 'idle' | 'memory' }>
  lowMemStreak: number
  memoryNote: boolean
}

const MEMORY_NOTE_INTERVAL_MS = 10 * 60_000
const LOW_MEM_TICKS_REQUIRED = 2

export function canSleep(
  a: Pick<SleepCandidate, 'cli' | 'role' | 'sessionStarted' | 'neverSleep'>,
  auto: boolean
): boolean {
  if (sessionStrategyFor(a.cli) === 'none') return false
  if (a.neverSleep || !a.sessionStarted) return false
  if (auto && a.role === 'orchestrator') return false
  return true
}

export function pickAgentsToSleep(input: SleepPolicyInput): SleepDecision {
  const { settings, now } = input
  if (!settings.enabled) return { sleep: [], lowMemStreak: 0, memoryNote: false }

  const eligible = input.agents.filter(
    (a) =>
      (a.status === 'idle' || a.status === 'active') &&
      a.idleSince !== null &&
      canSleep(a, true) &&
      !input.pendingNudgeNames.has(a.name) &&
      !input.inProgressTaskAgents.has(a.name) &&
      !input.openTargetedTaskAgents.has(a.name.toLowerCase()) &&
      !input.promptNotInjectedIds.has(a.id)
  )

  const sleep: SleepDecision['sleep'] = []
  const picked = new Set<string>()

  if (settings.sleepAfterMinutes > 0) {
    const limit = settings.sleepAfterMinutes * 60_000
    for (const a of eligible) {
      if (now - (a.idleSince as number) > limit) {
        sleep.push({ id: a.id, reason: 'idle' })
        picked.add(a.id)
      }
    }
  }

  let lowMemStreak = 0
  let memoryNote = false
  if (settings.memoryFloorMb > 0 && input.freeMemMb < settings.memoryFloorMb) {
    lowMemStreak = input.lowMemStreak + 1
    if (lowMemStreak >= LOW_MEM_TICKS_REQUIRED) {
      const victim = eligible
        .filter((a) => !picked.has(a.id))
        .sort((x, y) => (x.idleSince as number) - (y.idleSince as number))[0]
      if (victim) {
        sleep.push({ id: victim.id, reason: 'memory' })
      } else if (
        sleep.length === 0 &&
        (input.lastMemoryNoteAt === null || now - input.lastMemoryNoteAt > MEMORY_NOTE_INTERVAL_MS)
      ) {
        memoryNote = true
      }
    }
  }

  return { sleep, lowMemStreak, memoryNote }
}
