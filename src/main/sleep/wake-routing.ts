import type { AgentStatus } from '../../shared/types'

export interface RoutableAgent { id: string; name: string; role: string; tabId?: string; status: AgentStatus; sleptAt?: string }
export interface TaskLike { id: string; title: string; createdBy: string; targetAgent?: string; targetRole?: string; tabId?: string }
/** wake: ids to wake (nudge queued first); write: names to nudge now. */
export interface WakeRoute { wake: string[]; write: string[] }

const isAwake = (a: RoutableAgent): boolean =>
  a.status !== 'sleeping' && a.status !== 'waking' && a.status !== 'disconnected'

export function routeTaskNudge(task: TaskLike, agents: RoutableAgent[]): WakeRoute {
  if (task.targetAgent) {
    const target = agents.find(a => a.name === task.targetAgent)
    if (!target) return { wake: [], write: [] }
    if (target.status === 'sleeping') return { wake: [target.id], write: [] }
    return isAwake(target) ? { wake: [], write: [target.name] } : { wake: [], write: [] }
  }

  const candidates = agents.filter(a => {
    if (a.status === 'disconnected' || a.name === 'user') return false
    if (a.name === task.createdBy) return false
    if (task.tabId && a.tabId && task.tabId !== a.tabId) return false
    return task.targetRole ? a.role === task.targetRole : a.role !== 'orchestrator'
  })

  const awake = candidates.filter(isAwake)
  if (awake.length > 0) return { wake: [], write: awake.map(a => a.name) }

  const sleeping = candidates.filter(a => a.status === 'sleeping')
  if (sleeping.length === 0) return { wake: [], write: [] }
  const latest = sleeping.reduce((best, a) => ((a.sleptAt ?? '') > (best.sleptAt ?? '') ? a : best))
  return { wake: [latest.id], write: [] }
}
