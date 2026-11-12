import React, { useState, useMemo } from 'react'
import { Dialog, EmptyState, Input, Segmented } from '../ui'

// MCP Tools Reference — keep this in sync with src/mcp-server/index.ts.
// Roles indicate TYPICAL usage; in practice every agent has access to every
// tool regardless of its declared role.

type ToolRole = 'orchestrator' | 'worker' | 'researcher' | 'reviewer' | 'all'

interface ToolEntry {
  name: string
  description: string
  args: Array<{ name: string; type: string; required?: boolean; description: string }>
  example?: string
  roles: ToolRole[]
}

interface ToolCategory {
  id: string
  label: string
  description: string
  tools: ToolEntry[]
}

const CATEGORIES: ToolCategory[] = [
  {
    id: 'messaging',
    label: 'Messaging',
    description: 'Direct agent-to-agent communication. Messages are queued and delivered via nudges.',
    tools: [
      {
        name: 'send_message',
        description: 'Send a direct message to another agent. Queued until they call get_messages().',
        args: [
          { name: 'to', type: 'string', required: true, description: 'Target agent name' },
          { name: 'message', type: 'string', required: true, description: 'The message body' },
        ],
        example: 'send_message(to="reviewer-1", message="PR ready for review at branch feat/auth")',
        roles: ['all'],
      },
      {
        name: 'get_messages',
        description: 'Check your inbox. Defaults to peek mode (does not clear queue). Do NOT poll — wait for nudges.',
        args: [
          { name: 'peek', type: 'boolean', description: 'true (default) keeps messages in queue; false clears them on read' },
        ],
        example: 'get_messages()',
        roles: ['all'],
      },
      {
        name: 'ack_messages',
        description: 'Remove processed messages from your queue after handling them.',
        args: [
          { name: 'message_ids', type: 'string[]', required: true, description: 'IDs of messages to acknowledge' },
        ],
        example: 'ack_messages(message_ids=["msg-abc", "msg-def"])',
        roles: ['all'],
      },
      {
        name: 'broadcast',
        description: 'Send a message to ALL other agents at once.',
        args: [
          { name: 'message', type: 'string', required: true, description: 'The message body' },
        ],
        example: 'broadcast(message="Database migration starting in 5 minutes")',
        roles: ['orchestrator'],
      },
      {
        name: 'get_message_history',
        description: 'Retrieve historical messages from the database (vs get_messages which only shows the unread queue).',
        args: [
          { name: 'agent', type: 'string', description: 'Filter by agent name (to/from this agent)' },
          { name: 'limit', type: 'number', description: 'Max messages to return (default 50, max 500)' },
        ],
        example: 'get_message_history(agent="worker-1", limit=20)',
        roles: ['orchestrator', 'reviewer'],
      },
    ],
  },
  {
    id: 'tasks',
    label: 'Pinboard / tasks',
    description: 'Shared task board. Orchestrators post, workers claim and complete.',
    tools: [
      {
        name: 'post_task',
        description: 'Post a task to the shared pinboard. Optionally target a specific role to nudge.',
        args: [
          { name: 'title', type: 'string', required: true, description: 'Short title' },
          { name: 'description', type: 'string', required: true, description: 'Detailed description of the work' },
          { name: 'priority', type: '"low" | "medium" | "high"', description: 'Priority (default medium)' },
          { name: 'target_role', type: 'string', description: 'Only nudge agents with this role (e.g. "worker", "reviewer")' },
        ],
        example: 'post_task(title="Fix login bug", description="Stack trace in #15", priority="high", target_role="worker")',
        roles: ['orchestrator'],
      },
      {
        name: 'read_tasks',
        description: 'List all tasks on the pinboard. Sorted with open tasks first. Do NOT poll — wait for nudges.',
        args: [],
        example: 'read_tasks()',
        roles: ['worker', 'reviewer'],
      },
      {
        name: 'get_task',
        description: 'Fetch a single task by ID. More efficient than read_tasks when you only need one.',
        args: [
          { name: 'task_id', type: 'string', required: true, description: 'ID of the task' },
        ],
        example: 'get_task(task_id="task-abc-123")',
        roles: ['all'],
      },
      {
        name: 'claim_task',
        description: 'Claim an open task. Fails if already claimed by someone else.',
        args: [
          { name: 'task_id', type: 'string', required: true, description: 'ID of the task to claim' },
        ],
        example: 'claim_task(task_id="task-abc-123")',
        roles: ['worker', 'reviewer'],
      },
      {
        name: 'complete_task',
        description: 'Mark a claimed task as done. Only the claiming agent can complete it.',
        args: [
          { name: 'task_id', type: 'string', required: true, description: 'ID of the task' },
          { name: 'result', type: 'string', description: 'Optional summary of the work done' },
        ],
        example: 'complete_task(task_id="task-abc-123", result="Patched in commit a1b2c3d")',
        roles: ['worker', 'reviewer'],
      },
      {
        name: 'abandon_task',
        description: 'Release a claimed task back to open status (use when blocked).',
        args: [
          { name: 'task_id', type: 'string', required: true, description: 'ID of the task to abandon' },
        ],
        example: 'abandon_task(task_id="task-abc-123")',
        roles: ['worker', 'reviewer'],
      },
      {
        name: 'clear_completed_tasks',
        description: 'Remove all completed tasks from the pinboard. Keeps open and in-progress tasks.',
        args: [],
        example: 'clear_completed_tasks()',
        roles: ['orchestrator'],
      },
    ],
  },
  {
    id: 'knowledge',
    label: 'Shared knowledge',
    description: 'Info channel for research findings, status notes, and shared context.',
    tools: [
      {
        name: 'post_info',
        description: 'Post a research note or finding to the shared info channel.',
        args: [
          { name: 'note', type: 'string', required: true, description: 'The note text' },
          { name: 'tags', type: 'string[]', description: 'Optional tags to categorize the note' },
        ],
        example: 'post_info(note="Auth uses JWT with 1h expiry", tags=["auth", "research"])',
        roles: ['researcher', 'worker'],
      },
      {
        name: 'read_info',
        description: 'Read all info entries, optionally filtered by tags.',
        args: [
          { name: 'tags', type: 'string[]', description: 'Filter to entries matching ANY of these tags' },
        ],
        example: 'read_info(tags=["auth"])',
        roles: ['all'],
      },
      {
        name: 'update_info',
        description: 'Update the text of an existing info entry.',
        args: [
          { name: 'id', type: 'string', required: true, description: 'ID of the entry to update' },
          { name: 'note', type: 'string', required: true, description: 'The updated note text' },
        ],
        example: 'update_info(id="info-abc", note="Auth uses JWT with 24h expiry (corrected)")',
        roles: ['researcher'],
      },
      {
        name: 'delete_info',
        description: 'Delete an info entry by ID. Use to remove stale or incorrect notes.',
        args: [
          { name: 'id', type: 'string', required: true, description: 'ID of the entry to delete' },
        ],
        example: 'delete_info(id="info-abc")',
        roles: ['researcher'],
      },
    ],
  },
  {
    id: 'agents',
    label: 'Agents & discovery',
    description: 'Inspect the team — who else is in the workspace and what they are doing.',
    tools: [
      {
        name: 'get_agents',
        description: 'List all agents in the workspace with name, role, CLI, status, and CEO notes.',
        args: [],
        example: 'get_agents()',
        roles: ['all'],
      },
      {
        name: 'read_ceo_notes',
        description: 'Re-read your own CEO notes and role description. Useful after /clear.',
        args: [],
        example: 'read_ceo_notes()',
        roles: ['all'],
      },
      {
        name: 'update_status',
        description: 'Self-report your current status. Helps the team see what you are doing.',
        args: [
          { name: 'status', type: '"idle" | "active" | "working"', required: true, description: 'Current status' },
        ],
        example: 'update_status(status="working")',
        roles: ['all'],
      },
      {
        name: 'get_agent_output',
        description: 'Peek at another agent\u2019s recent terminal output without messaging them.',
        args: [
          { name: 'agent', type: 'string', required: true, description: 'Target agent name' },
          { name: 'lines', type: 'number', description: 'Lines to retrieve (default 50, max 1000)' },
        ],
        example: 'get_agent_output(agent="worker-1", lines=100)',
        roles: ['orchestrator', 'reviewer'],
      },
      {
        name: 'get_my_group',
        description: 'Get info about your communication group (linked agents only). Returns null if unlinked / global access.',
        args: [],
        example: 'get_my_group()',
        roles: ['all'],
      },
    ],
  },
  {
    id: 'files',
    label: 'Project files',
    description: 'Read and write files within the current project directory. Sandboxed — paths cannot escape the project root.',
    tools: [
      {
        name: 'read_file',
        description: 'Read a file from the project directory. 1MB size limit.',
        args: [
          { name: 'path', type: 'string', required: true, description: 'Relative path (e.g. "src/index.ts")' },
        ],
        example: 'read_file(path="package.json")',
        roles: ['all'],
      },
      {
        name: 'write_file',
        description: 'Write content to a file. Creates parent directories if needed.',
        args: [
          { name: 'path', type: 'string', required: true, description: 'Relative path' },
          { name: 'content', type: 'string', required: true, description: 'Full file content' },
        ],
        example: 'write_file(path="src/new-file.ts", content="export const x = 1")',
        roles: ['worker'],
      },
      {
        name: 'list_directory',
        description: 'List files and subdirectories in a project directory.',
        args: [
          { name: 'path', type: 'string', description: 'Relative directory (default: project root)' },
        ],
        example: 'list_directory(path="src")',
        roles: ['all'],
      },
    ],
  },
]

const ROLE_LABELS: Record<ToolRole, string> = {
  orchestrator: 'Orchestrator',
  worker: 'Worker',
  researcher: 'Researcher',
  reviewer: 'Reviewer',
  all: 'Any role',
}

const ALL_ROLES: ToolRole[] = ['all', 'orchestrator', 'worker', 'researcher', 'reviewer']

interface HelpDialogProps {
  onClose: () => void
}

export function HelpDialog({ onClose }: HelpDialogProps): React.ReactElement {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<ToolRole | 'any'>('any')

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CATEGORIES.map(cat => {
      const tools = cat.tools.filter(tool => {
        if (roleFilter !== 'any' && !tool.roles.includes(roleFilter) && !tool.roles.includes('all')) {
          return false
        }
        if (!q) return true
        return (
          tool.name.toLowerCase().includes(q) ||
          tool.description.toLowerCase().includes(q) ||
          tool.args.some(a => a.name.toLowerCase().includes(q))
        )
      })
      return { ...cat, tools }
    }).filter(cat => cat.tools.length > 0)
  }, [search, roleFilter])

  const totalTools = CATEGORIES.reduce((sum, c) => sum + c.tools.length, 0)
  const visibleTools = filteredCategories.reduce((sum, c) => sum + c.tools.length, 0)

  const roleOptions = [
    { value: 'any' as const, label: 'Any' },
    ...ALL_ROLES.filter(r => r !== 'all').map(r => ({ value: r, label: ROLE_LABELS[r] }))
  ]

  return (
    <Dialog
      title="MCP tools reference"
      icon="book-open"
      size="lg"
      zIndex={100002}
      onClose={onClose}
      closeOnBackdrop
      headerExtra={<>{visibleTools} of {totalTools} tools</>}
      footerStart={<span>All tools are accessible to every agent. Role badges indicate <em>typical</em> usage.</span>}
      footer={<span className="cog-help__source">Source: src/mcp-server/index.ts</span>}
      className="cog-help"
    >
      {/* Filter bar: stays at the top while the tool list scrolls */}
      <div className="cog-help__filters">
        <Input
          type="text"
          placeholder="Search tools by name, description, or arg..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="cog-help__search"
        />
        <span className="cog-help__label">Role:</span>
        <Segmented
          value={roleFilter}
          options={roleOptions}
          onChange={v => setRoleFilter(v)}
          ariaLabel="Role"
        />
      </div>

      {/* Tool list */}
      {filteredCategories.length === 0 && (
        <EmptyState icon="search">No tools match the current filter.</EmptyState>
      )}
      {filteredCategories.map(cat => (
        <section key={cat.id} className="cog-help__cat">
          <div className="cog-help__cathead">
            <h3 className="cog-help__cattitle">{cat.label}</h3>
            <span className="cog-help__count">{cat.tools.length} tool(s)</span>
          </div>
          <p className="cog-help__catdesc">{cat.description}</p>
          {cat.tools.map(tool => (
            <article key={tool.name} className="cog-help__tool">
              <div className="cog-help__toolhead">
                <code className="cog-help__name">{tool.name}</code>
                {tool.roles.map(r => (
                  <span key={r} className="cog-help__role">{ROLE_LABELS[r]}</span>
                ))}
              </div>
              <p className="cog-help__desc">{tool.description}</p>
              {tool.args.length > 0 && (
                <ul className="cog-help__args">
                  {tool.args.map(arg => (
                    <li key={arg.name}>
                      <code className="cog-help__arg">{arg.name}</code>
                      <code className="cog-help__type">: {arg.type}</code>
                      {arg.required && <span className="cog-help__req" title="Required">*</span>}
                      <span className="cog-help__argdesc">{arg.description}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tool.example && (
                <pre className="cog-pre cog-help__example">{tool.example}</pre>
              )}
            </article>
          ))}
        </section>
      ))}
    </Dialog>
  )
}
