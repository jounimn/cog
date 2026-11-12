import React, { useEffect, useMemo, useState } from 'react'
import type { TeamProposal, ProposedAgent, AgentConfig } from '../../shared/types'
import { CLI_PRESETS, CLI_MODELS, ROLE_PRESETS } from './AgentConfigForm'
import { Button, Checkbox, Dialog, FieldError, Icon, Input, Row, Textarea } from '../ui'

interface Props {
  proposal: TeamProposal
  activeTabId: string
  onClose: () => void
  onApproved: (spawned: Array<{ agentId: string; name: string; gridIndex: number }>) => void
}

const WINDOWS_SHELLS: Array<AgentConfig['shell']> = ['powershell', 'cmd', 'wsl']
const POSIX_SHELLS: Array<AgentConfig['shell']> = ['bash', 'zsh', 'fish']
const ALL_SHELLS: Array<AgentConfig['shell']> = navigator.platform.toLowerCase().includes('win')
  ? [...WINDOWS_SHELLS, ...POSIX_SHELLS]
  : [...POSIX_SHELLS, ...WINDOWS_SHELLS]

// Known-bad model picks the orchestrator might choose. sonnet[1m] is billed
// against the paid Anthropic API (real money per token), NOT the Claude Max
// subscription — easy money sink to spawn by accident. Lowercase kimi names
// get rejected silently by kimi-cli.
const MODEL_WARNINGS: Record<string, string> = {
  'sonnet[1m]': 'WARNING: sonnet[1m] uses the paid Anthropic API ($$$ per token), NOT your Claude Max subscription. Use plain "sonnet" instead.',
  'kimi-k2': 'Not a valid kimi model. Use "Kimi-k2.6" (capital K). Kimi silently rejects unknown names.',
  'kimi-k2.5': 'Lowercase rejected by kimi-cli. Use "Kimi-k2.5" (capital K) or "Kimi-k2.6".',
}

export function TeamProposalDialog({ proposal, activeTabId, onClose, onApproved }: Props): React.ReactElement {
  // Keep a deep-cloneable local mirror of the proposed agents so user edits
  // don't mutate the prop. We index by position because the user may edit
  // names. `checked` is also indexed by position.
  const [editedAgents, setEditedAgents] = useState<ProposedAgent[]>(() => proposal.agents.map(a => ({ ...a })))
  const [checked, setChecked] = useState<boolean[]>(() => proposal.agents.map(() => true))
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state if the modal is recycled for a different proposal
  useEffect(() => {
    setEditedAgents(proposal.agents.map(a => ({ ...a })))
    setChecked(proposal.agents.map(() => true))
    setExpanded(new Set())
    setFeedback('')
    setError(null)
  }, [proposal.id, proposal.agents])

  const checkedCount = useMemo(() => checked.filter(Boolean).length, [checked])
  const isDirty = useMemo(() => {
    return editedAgents.some((a, i) => JSON.stringify(a) !== JSON.stringify(proposal.agents[i]))
  }, [editedAgents, proposal.agents])

  const updateAgent = (index: number, partial: Partial<ProposedAgent>) => {
    setEditedAgents(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...partial }
      // If cli changed and the model isn't valid for the new cli, blank it
      // so the user gets the new dropdown's default.
      if (partial.cli && partial.cli !== prev[index].cli) {
        const validModels = CLI_MODELS[partial.cli] || []
        const stillValid = validModels.some(m => m.value === next[index].model)
        if (!stillValid) next[index].model = ''
      }
      return next
    })
  }

  const toggleChecked = (index: number) => {
    setChecked(prev => prev.map((v, i) => i === index ? !v : v))
  }
  const toggleAll = () => {
    const allOn = checked.every(Boolean)
    setChecked(checked.map(() => !allOn))
  }
  const toggleAllAsleep = () => {
    const allAsleep = editedAgents.every(a => !!a.spawnAsleep)
    setEditedAgents(prev => prev.map(a => ({ ...a, spawnAsleep: !allAsleep || undefined })))
  }
  const toggleExpanded = (index: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index); else next.add(index)
      return next
    })
  }
  const resetEdits = () => {
    setEditedAgents(proposal.agents.map(a => ({ ...a })))
  }

  const handleApprove = async () => {
    if (checkedCount === 0) return
    setSubmitting(true)
    setError(null)
    const toSpawn = editedAgents.filter((_, i) => checked[i])
    const result = await window.electronAPI.proposalsApprove(proposal.id, toSpawn, activeTabId)
    setSubmitting(false)
    if (!result.success) {
      setError(result.error || 'Spawn failed')
      return
    }
    onApproved(result.spawned || [])
    onClose()
  }

  const handleReject = async () => {
    setSubmitting(true)
    await window.electronAPI.proposalsReject(proposal.id, feedback.trim() || undefined)
    setSubmitting(false)
    onClose()
  }

  // The old backdrop closed only when no spawn/reject was in flight; the header x follows the same rule.
  const closeIfIdle = () => { if (!submitting) onClose() }

  return (
    <Dialog
      title={<>Team proposal from {proposal.proposedBy}</>}
      icon="users"
      size="lg"
      className="cog-proposal"
      zIndex={10000}
      onClose={closeIfIdle}
      closeOnBackdrop
      footerStart={
        <>
          <Button variant="ghost" className="cog-tone-danger" onClick={handleReject} disabled={submitting}>Reject</Button>
          <Input
            type="text"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Optional reason if rejecting..."
            className="cog-proposal__feedback"
            disabled={submitting}
          />
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Close</Button>
          <Button onClick={handleApprove} disabled={checkedCount === 0 || submitting}>
            {submitting ? 'Spawning…' : `Approve & Spawn ${checkedCount}`}
          </Button>
        </>
      }
    >
      <div className="cog-proposal__summary">{proposal.summary}</div>

      <div className="cog-proposal__bar">
        <Checkbox checked={checked.every(Boolean)} onChange={toggleAll} title="Toggle all">All</Checkbox>
        <Checkbox
          checked={editedAgents.length > 0 && editedAgents.every(a => !!a.spawnAsleep)}
          onChange={toggleAllAsleep}
          title="Spawn every agent asleep (wake on first task)"
        >Asleep</Checkbox>
        <span className="cog-proposal__hint">
          {proposal.agents.length} agent{proposal.agents.length === 1 ? '' : 's'} · click any cell to edit
        </span>
        {isDirty && (
          <Button variant="ghost" className="cog-proposal__reset" onClick={resetEdits}>
            Reset edits
          </Button>
        )}
      </div>

      <div className="cog-dialog__list cog-proposal__list">
        {editedAgents.map((agent, i) => (
          <AgentRow
            key={i}
            agent={agent}
            checked={checked[i]}
            expanded={expanded.has(i)}
            onToggle={() => toggleChecked(i)}
            onToggleExpanded={() => toggleExpanded(i)}
            onChange={(partial) => updateAgent(i, partial)}
          />
        ))}
      </div>

      {error && <FieldError>{error}</FieldError>}
    </Dialog>
  )
}

interface RowProps {
  agent: ProposedAgent
  checked: boolean
  expanded: boolean
  onToggle: () => void
  onToggleExpanded: () => void
  onChange: (partial: Partial<ProposedAgent>) => void
}

function AgentRow({ agent, checked, expanded, onToggle, onToggleExpanded, onChange }: RowProps) {
  const modelOptions = CLI_MODELS[agent.cli] || []
  const modelWarning = agent.model ? MODEL_WARNINGS[agent.model] : undefined

  return (
    <div className="cog-proposal__item">
      <Row
        icon={<Checkbox checked={checked} onChange={onToggle} title="Spawn this agent" />}
        title={
          <EditableText
            value={agent.name}
            onChange={(v) => onChange({ name: v })}
            placeholder="agent-name"
          />
        }
        meta={
          <span className="cog-proposal__meta">
            <EditableSelect
              value={agent.role}
              options={ROLE_PRESETS.filter(r => r.value).map(r => ({ label: r.label, value: r.value }))}
              onChange={(v) => onChange({ role: v })}
              allowFreeform
              freeformPlaceholder="custom role"
            />
            <span aria-hidden="true">·</span>
            <EditableSelect
              value={agent.cli}
              options={CLI_PRESETS.filter(p => p.value).map(p => ({ label: p.label, value: p.value }))}
              onChange={(v) => onChange({ cli: v })}
              mono
            />
          </span>
        }
        actions={
          <>
            <span className="cog-proposal__cell">
              <span className="cog-proposal__k">Model</span>
              <EditableSelect
                value={agent.model || ''}
                options={modelOptions}
                onChange={(v) => onChange({ model: v || undefined })}
                warning={modelWarning}
                allowEmpty
                emptyLabel="default"
                mono
              />
            </span>
            <span className="cog-proposal__cell">
              <span className="cog-proposal__k">Shell</span>
              <EditableSelect
                value={agent.shell || ''}
                options={ALL_SHELLS.map(s => ({ label: shellLabel(s!), value: s! }))}
                onChange={(v) => onChange({ shell: (v || undefined) as AgentConfig['shell'] | undefined })}
                allowEmpty
                emptyLabel="default"
              />
            </span>
            <Checkbox
              checked={agent.autoMode}
              onChange={(v) => onChange({ autoMode: v })}
              className="cog-proposal__check"
            >
              <span className={agent.autoMode ? 'cog-tone-warning' : 'cog-proposal__off'}>
                {agent.autoMode ? 'auto' : 'manual'}
              </span>
            </Checkbox>
            <Checkbox
              checked={!!agent.spawnAsleep}
              onChange={(v) => onChange({ spawnAsleep: v || undefined })}
              title="Spawn asleep (wake on first task)"
              className="cog-proposal__check"
            >
              <span className={agent.spawnAsleep ? undefined : 'cog-proposal__off'}>
                {agent.spawnAsleep ? 'asleep' : 'awake'}
              </span>
            </Checkbox>
            <Button
              variant="ghost"
              className={agent.ceoNotes ? 'cog-proposal__notes cog-proposal__notes--set' : 'cog-proposal__notes'}
              onClick={onToggleExpanded}
              title={agent.ceoNotes ? 'Edit CEO notes' : 'Add CEO notes'}
              aria-expanded={expanded}
            >
              {expanded ? 'hide' : (agent.ceoNotes ? 'edit' : 'add')}
            </Button>
          </>
        }
      />
      {expanded && (
        <label className="cog-field cog-proposal__notesfield">
          <span className="cog-field__label">CEO notes — what this agent should do:</span>
          <Textarea
            value={agent.ceoNotes}
            onChange={(e) => onChange({ ceoNotes: e.target.value })}
            placeholder="e.g. Focus on the API layer. Coordinate with the orchestrator before merging."
            className="cog-proposal__textarea"
            rows={4}
          />
        </label>
      )}
    </div>
  )
}

// ── Reusable editable cell components ─────────────────────────────────────────

function EditableText({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onChange(draft.trim() || value)
  }
  const cancel = () => {
    setEditing(false)
    setDraft(value)
  }

  if (editing) {
    return (
      <Input
        type="text"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') cancel()
        }}
        placeholder={placeholder}
        className="cog-proposal__edit"
      />
    )
  }
  return (
    <span
      className="cog-proposal__cellval cog-proposal__name"
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || <span className="cog-proposal__empty">{placeholder}</span>}
    </span>
  )
}

interface SelectOpt { label: string; value: string }

function EditableSelect({ value, options, onChange, allowEmpty, emptyLabel, allowFreeform, freeformPlaceholder, warning, mono }: {
  value: string
  options: SelectOpt[]
  onChange: (v: string) => void
  allowEmpty?: boolean
  emptyLabel?: string
  allowFreeform?: boolean
  freeformPlaceholder?: string
  warning?: string
  /** Plex Mono for data values (CLI, model names). */
  mono?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const matched = options.find(o => o.value === value)
  const isFreeform = allowFreeform && value && !matched

  const commit = (v: string) => {
    setEditing(false)
    if (v !== value) onChange(v)
  }

  if (editing) {
    // A native <select> in the kit's .cog-select frame: it needs autoFocus and
    // onBlur, and options with duplicate empty values, which ui/Select does not take.
    return (
      <span className="cog-select cog-proposal__select">
        <select
          value={value}
          autoFocus
          onChange={(e) => {
            const v = e.target.value
            if (v === '__custom__') {
              // Switch to freeform: blank out so the FreeformInput shows below.
              // Setting to a sentinel triggers the inline text input render path.
              onChange('')
              setEditing(false)
              // Defer so the user can immediately re-click to type.
              setTimeout(() => setEditing(true), 0)
            } else {
              commit(v)
            }
          }}
          onBlur={() => setEditing(false)}
        >
          {allowEmpty && <option value="">{emptyLabel || '(default)'}</option>}
          {options.map(o => <option key={o.value || '__empty__'} value={o.value}>{o.label}</option>)}
          {isFreeform && <option value={value}>{value} (custom)</option>}
          {allowFreeform && <option value="__custom__">— Custom… —</option>}
        </select>
        <span className="cog-select__chev"><Icon name="chevron-down" size={14} /></span>
      </span>
    )
  }

  if (allowFreeform && (value === '' || isFreeform)) {
    // Hybrid: when freeform is allowed and user is typing a custom value,
    // show a text input. They can still click "Custom" in the dropdown to
    // re-enter this mode after picking a preset.
    return (
      <span className="cog-proposal__freeform">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={freeformPlaceholder || 'value'}
          className="cog-proposal__edit cog-proposal__edit--freeform"
        />
        <Button
          variant="icon"
          onClick={() => setEditing(true)}
          title="Pick from presets"
          aria-label="Pick from presets"
        ><Icon name="chevron-down" size={14} /></Button>
      </span>
    )
  }

  const display = value || (emptyLabel ? <span className="cog-proposal__empty">{emptyLabel}</span> : '')
  const cls = [
    'cog-proposal__cellval',
    mono && value && 'cog-mono',
    warning && 'cog-proposal__cellval--warn cog-tone-warning'
  ].filter(Boolean).join(' ')
  return (
    <span className={cls} onClick={() => setEditing(true)} title={warning || 'Click to edit'}>
      {display}{warning ? <Icon name="triangle-alert" size={12} /> : ''}
    </span>
  )
}

function shellLabel(s: string): string {
  if (s === 'powershell') return 'PowerShell'
  if (s === 'cmd') return 'cmd'
  if (s === 'wsl') return 'WSL'
  if (s === 'bash') return 'Bash'
  if (s === 'zsh') return 'Zsh'
  if (s === 'fish') return 'Fish'
  return s
}
