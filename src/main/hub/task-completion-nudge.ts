import type { AgentStatus } from '../../shared/types'

// Pure: who to nudge, and with what, when a pinboard task is completed or
// abandoned. No hub, no PTY — the caller delivers through deliverNudge.

export interface CompletionTask {
  id: string
  title: string
  status: 'open' | 'in_progress' | 'completed'
  createdBy: string | null
  claimedBy: string | null
  result: string | null
  tabId?: string
}

export interface CompletionAgent {
  name: string
  role: string
  status: AgentStatus
  tabId?: string
}

export interface CompletionNudge {
  targets: string[]
  text: string
}

const RESULT_MAX = 500

/**
 * Completed: the task's creator (when it is an agent other than the one who
 * completed it) plus every orchestrator on the task's tab. Abandoned (status
 * back to open, nobody claiming it): the same audience. A claim (in_progress)
 * is nobody's business. Works for any role and any CLI: the creator can be
 * any agent, and orchestrators are matched by role name only.
 */
export function taskCompletionNudge(task: CompletionTask, agents: CompletionAgent[]): CompletionNudge | null {
  let text: string
  if (task.status === 'completed') {
    const by = task.claimedBy ?? 'unknown'
    // The nudge is typed into a terminal: collapse newlines (a bare Enter would
    // submit half a message) and keep long summaries short; get_task has the rest.
    const collapsed = (task.result ?? '').replace(/\s+/g, ' ').trim()
    const result = collapsed ? (collapsed.length > RESULT_MAX ? `${collapsed.slice(0, RESULT_MAX)}…` : collapsed) : 'no summary given'
    text = `[Cog] Task "${task.title}" (id: ${task.id}) completed by ${by}. Result: ${result}. Call get_task("${task.id}") and keep the plan moving: post the next task or integrate the work.`
  } else if (task.status === 'open' && task.claimedBy === null) {
    text = `[Cog] Task "${task.title}" (id: ${task.id}) was abandoned and is open again. Call read_tasks() and reassign it or pick it up.`
  } else {
    return null
  }

  const live = agents.filter(a => a.status !== 'disconnected' && a.name !== task.claimedBy)
  const sameTab = (a: CompletionAgent): boolean => !task.tabId || !a.tabId || task.tabId === a.tabId
  const targets: string[] = []
  const creator = task.createdBy ? live.find(a => a.name === task.createdBy) : undefined
  if (creator) targets.push(creator.name)
  for (const a of live) {
    if ((a.role || '').trim().toLowerCase() === 'orchestrator' && sameTab(a) && !targets.includes(a.name)) targets.push(a.name)
  }
  return targets.length > 0 ? { targets, text } : null
}
