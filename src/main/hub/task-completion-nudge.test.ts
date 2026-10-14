import { describe, it, expect } from 'vitest'
import { taskCompletionNudge, type CompletionAgent, type CompletionTask } from './task-completion-nudge'

const agents: CompletionAgent[] = [
  { name: 'lead', role: 'orchestrator', status: 'active', tabId: 't1' },
  { name: 'worker-1', role: 'worker', status: 'working', tabId: 't1' },
  { name: 'reviewer', role: 'reviewer', status: 'idle', tabId: 't1' },
  { name: 'other-lead', role: 'Orchestrator', status: 'idle', tabId: 't2' },
  { name: 'gone', role: 'orchestrator', status: 'disconnected', tabId: 't1' }
]

const done: CompletionTask = {
  id: 'task-9', title: 'Write the parser', status: 'completed',
  createdBy: 'lead', claimedBy: 'worker-1', result: 'Parser in src/parse.ts, branch cog/worker-1', tabId: 't1'
}

describe('taskCompletionNudge', () => {
  it('tells the creator when its task is completed, with the result and the next step', () => {
    const n = taskCompletionNudge(done, agents)
    expect(n?.targets).toEqual(['lead'])
    expect(n?.text).toBe('[Cog] Task "Write the parser" (id: task-9) completed by worker-1. Result: Parser in src/parse.ts, branch cog/worker-1. Call get_task("task-9") and keep the plan moving: post the next task or integrate the work.')
  })

  it('also tells every awake orchestrator on the same tab when the creator is not one (any role can post tasks)', () => {
    const n = taskCompletionNudge({ ...done, createdBy: 'reviewer' }, agents)
    expect(n?.targets).toEqual(['reviewer', 'lead'])
  })

  it('never nudges the agent that completed the task, even if it posted it', () => {
    const n = taskCompletionNudge({ ...done, createdBy: 'worker-1' }, agents)
    expect(n?.targets).toEqual(['lead'])
  })

  it('tells orchestrators when the task was posted by the user or by nobody', () => {
    expect(taskCompletionNudge({ ...done, createdBy: 'user' }, agents)?.targets).toEqual(['lead'])
    expect(taskCompletionNudge({ ...done, createdBy: null }, agents)?.targets).toEqual(['lead'])
  })

  it('skips disconnected agents and orchestrators on other tabs', () => {
    const n = taskCompletionNudge({ ...done, createdBy: 'gone' }, agents)
    expect(n?.targets).toEqual(['lead'])
  })

  it('says "no summary given" when the result is empty', () => {
    const n = taskCompletionNudge({ ...done, result: '  ' }, agents)
    expect(n?.text).toContain('Result: no summary given.')
  })

  it('reports an abandoned task as open again', () => {
    const n = taskCompletionNudge({ ...done, status: 'open', claimedBy: null, result: null }, agents)
    expect(n?.targets).toEqual(['lead'])
    expect(n?.text).toBe('[Cog] Task "Write the parser" (id: task-9) was abandoned and is open again. Call read_tasks() and reassign it or pick it up.')
  })

  it('returns null for a claim (in_progress) and when nobody should be told', () => {
    expect(taskCompletionNudge({ ...done, status: 'in_progress' }, agents)).toBeNull()
    expect(taskCompletionNudge({ ...done, createdBy: 'user' }, [agents[1]])).toBeNull()
  })
})
