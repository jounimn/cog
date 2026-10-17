import { EventEmitter } from 'node:events'
import type { AgentConfig, AgentState, AgentStatus } from '../../shared/types'

// Fields copied from an incoming AgentConfig onto the live AgentState.
// Explicit allowlist so runtime-only fields (status, createdAt, etc.) can
// never be overwritten by a registrant — including special keys like
// __proto__ or constructor.
const ALLOWED_CONFIG_KEYS = [
  'id', 'name', 'cli', 'role', 'model', 'shell', 'cwd',
  'ceoNotes', 'admin', 'autoMode', 'tabId', 'groupId',
  'promptRegex', 'providerUrl', 'experimental', 'skills', 'theme',
  'sleeping', 'sleptAt', 'spawnAsleep', 'neverSleep', 'sessionStarted',
  'worktree', 'worktreePath', 'projectRoot', 'workDir'
] as const

function copyConfigFields(src: AgentConfig, dst: AgentState): void {
  for (const key of ALLOWED_CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      // @ts-expect-error — structural copy, keys are validated against the allowlist above.
      dst[key] = (src as Record<string, unknown>)[key]
    }
  }
}

export class AgentRegistry extends EventEmitter {
  private agents = new Map<string, AgentState>()
  private lastHeartbeat = new Map<string, number>() // name → timestamp ms

  constructor() {
    super()
  }

  register(config: AgentConfig): AgentState {
    const existing = this.agents.get(config.name)
    if (existing) {
      // Upsert via explicit field allowlist. A bare Object.assign let a registrant
      // pick any key present on AgentState (status, createdAt, __proto__, etc.)
      // and clobber server-managed runtime state.
      copyConfigFields(config, existing)
      // An awake re-register (wake, respawn) must not keep a stale sleptAt.
      if (config.sleeping !== true) {
        delete existing.sleeping
        delete existing.sleptAt
      }
      existing.status = config.sleeping === true ? 'sleeping' : 'idle'
      this.emit('status', { name: existing.name, status: existing.status })
      return existing
    }
    const state: AgentState = {
      status: config.sleeping === true ? 'sleeping' : 'idle',
      createdAt: new Date().toISOString()
    } as AgentState
    copyConfigFields(config, state)
    this.agents.set(config.name, state)
    this.emit('register', state)
    return state
  }

  get(name: string): AgentState | undefined {
    return this.agents.get(name)
  }

  list(): AgentState[] {
    return Array.from(this.agents.values())
  }

  updateStatus(name: string, status: AgentStatus): void {
    const agent = this.agents.get(name)
    // A sleeping agent has no live process; late PTY output or exit must not
    // replace 'sleeping' (task routing and message queueing key off it).
    // markWaking and register are the only ways out of that state.
    if (agent?.sleeping) return
    if (agent && agent.status !== status) {
      agent.status = status
      this.emit('status', { name, status })
    }
  }

  markSleeping(name: string, sleptAt: string): void {
    const agent = this.agents.get(name)
    if (!agent) return
    agent.sleeping = true
    agent.sleptAt = sleptAt
    agent.status = 'sleeping'
    this.emit('status', { name, status: 'sleeping' })
  }

  markWaking(name: string): void {
    const agent = this.agents.get(name)
    if (!agent) return
    agent.status = 'waking'
    this.emit('status', { name, status: 'waking' })
  }

  remove(name: string): void {
    if (!this.agents.has(name)) return
    this.agents.delete(name)
    this.lastHeartbeat.delete(name)
    this.emit('remove', name)
  }

  recordHeartbeat(name: string): void {
    this.lastHeartbeat.set(name, Date.now())
  }

  getLastHeartbeat(name: string): number | null {
    return this.lastHeartbeat.get(name) ?? null
  }

  isHealthy(name: string, maxAge = 60000): boolean {
    if (this.agents.get(name)?.status === 'sleeping') return true // no process, no heartbeats
    const last = this.lastHeartbeat.get(name)
    if (!last) return true // No heartbeats expected yet
    return Date.now() - last < maxAge
  }
}
