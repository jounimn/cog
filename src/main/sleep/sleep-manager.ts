import type { AgentStatus, SleepSettings } from '../../shared/types'
import { pickAgentsToSleep, type SleepCandidate } from './sleep-policy'

export interface SleepManagerDeps {
  settings: () => SleepSettings
  /** Awake agents of this context, idleSince from manager state. */
  candidates: () => SleepCandidate[]
  pendingNudgeNames: () => Set<string>
  /** Pinboard tasks with status 'in_progress' -> claimedBy. */
  inProgressTaskAgents: () => Set<string>
  /** Pinboard tasks with status 'open' and a targetAgent -> that name, lower-cased. */
  openTargetedTaskAgents: () => Set<string>
  /** Ids not yet in hasReceivedInitialPrompt. */
  promptNotInjectedIds: () => Set<string>
  /** os.freemem() / 1048576 */
  freeMemMb: () => number
  sleep: (id: string, reason: 'idle' | 'memory') => void
  /** Inbox: 'Memory below floor and every awake agent is working; nobody was put to sleep.' */
  postMemoryNote: () => void
  now?: () => number
}

export class SleepManager {
  private idleSinceById = new Map<string, number>()
  private lowMemStreak = 0
  private lastMemoryNoteAt: number | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private deps: SleepManagerDeps, private tickMs = 30_000) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), this.tickMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  noteStatus(id: string, status: AgentStatus): void {
    // The status detector reports 'idle' only before the first output byte;
    // an agent sitting at its prompt after silence is 'active'. Both count as
    // idle for sleep purposes; only 'working' (or leaving) clears the clock.
    if (status === 'idle' || status === 'active') {
      if (!this.idleSinceById.has(id)) this.idleSinceById.set(id, this.now())
    } else {
      this.idleSinceById.delete(id)
    }
  }

  /** Drop all state for an agent that left the live set (slept, killed, respawned). */
  forget(id: string): void {
    this.idleSinceById.delete(id)
  }

  idleSince(id: string): number | null {
    return this.idleSinceById.get(id) ?? null
  }

  tick(): void {
    try {
      this.runTick()
    } catch (err) {
      console.error('[sleep] tick failed', err)
    }
  }

  private runTick(): void {
    const now = this.now()
    const decision = pickAgentsToSleep({
      agents: this.deps.candidates(),
      now,
      settings: this.deps.settings(),
      freeMemMb: this.deps.freeMemMb(),
      lowMemStreak: this.lowMemStreak,
      pendingNudgeNames: this.deps.pendingNudgeNames(),
      inProgressTaskAgents: this.deps.inProgressTaskAgents(),
      openTargetedTaskAgents: this.deps.openTargetedTaskAgents(),
      promptNotInjectedIds: this.deps.promptNotInjectedIds(),
      lastMemoryNoteAt: this.lastMemoryNoteAt
    })
    this.lowMemStreak = decision.lowMemStreak
    for (const s of decision.sleep) this.deps.sleep(s.id, s.reason)
    if (decision.memoryNote) {
      this.lastMemoryNoteAt = now
      this.deps.postMemoryNote()
    }
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }
}
