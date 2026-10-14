import type { AgentConfig } from '../shared/types'
import { agentSlug } from '../shared/agent-worktree-defaults'

// Build the initial prompt injected when the CLI first becomes ready.
// Keeps it short so the agent doesn't waste context — just tells it who it is
// and to check MCP tools for instructions.
export function buildInitialPrompt(config: AgentConfig, projectRoot?: string): string {
  const isOrchestrator = (config.role || '').trim().toLowerCase() === 'orchestrator'
  const baseTools = `send_message, get_messages, get_agents, read_ceo_notes, get_agent_output, post_task, read_tasks, claim_task, complete_task, abandon_task, get_task, post_info, read_info, delete_info, update_info, update_status, get_message_history, ack_messages, read_file, write_file, list_directory`
  const orchestratorTools = isOrchestrator ? `, notify_user, propose_team` : ''
  const lines = [
    `You are "${config.name}" (role: ${config.role}) in a Cog workspace.`,
    `You have Cog MCP tools: ${baseTools}${orchestratorTools}.`,
    isOrchestrator
      ? `As orchestrator you have two extra tools: notify_user(message, priority) posts to the user's inbox panel for messages targeted at the human (use sparingly, with priority high/urgent only when the user genuinely needs to act). propose_team({summary, agents}) submits a team for the user to approve in a confirmation modal — agents do NOT spawn until the user clicks Approve, so wait for the user response.`
      : '',
    `Do these steps NOW: 1) Call read_ceo_notes() for your instructions. 2) Call get_messages() to check for messages. 3) Call read_tasks() to check for open tasks you can claim.`,
    `Your CEO notes define your workflow. Follow them exactly. After initial setup, WAIT for nudges — do NOT poll.`,
    `When you finish a task you claimed: call complete_task(task_id, summary) — say what you did and where the work is (branch, files) — then send_message to the agent that posted it (the orchestrator if unsure) with the same summary. Do both before you go idle; never leave a claimed task silent.`,
    isOrchestrator
      ? `When a task you posted is completed or abandoned you get a nudge: call get_task(id) to read the result and keep the plan moving — post the next task or integrate the work.`
      : '',
    config.workDir
      ? `Temporary outputs, logs and scratch files go under "${config.workDir}" — never outside the project folder.`
      : '',
    config.worktreePath
      ? `Your working directory is an isolated git worktree at "${config.worktreePath}" on branch "cog/${agentSlug(config.name)}". The main checkout is "${projectRoot ?? config.cwd}"; do not edit it directly. Commit on your branch and tell the orchestrator when work is ready to integrate.`
      : '',
  ].filter(Boolean)
  return lines.join(' ')
}
