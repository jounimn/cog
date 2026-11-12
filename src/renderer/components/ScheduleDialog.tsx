import React, { useState, useEffect } from 'react'
import type { CreateScheduleInput, EditScheduleInput, ScheduledPrompt } from '../../shared/types'
import { Button, Checkbox, Dialog, Field, FieldError, Input, Select, Textarea } from '../ui'

export interface AgentOption {
  id: string
  name: string
  tabId: string
  tabName: string
}

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  agents: AgentOption[]
  initialValues?: ScheduledPrompt
  onSubmit: (input: CreateScheduleInput | { id: string; updates: EditScheduleInput }) => void
  onClose: () => void
}

export function ScheduleDialog({ open, mode, agents, initialValues, onSubmit, onClose }: Props): React.ReactElement | null {
  const [name, setName] = useState('')
  const [agentId, setAgentId] = useState('')
  const [promptText, setPromptText] = useState('')
  const [intervalMinutes, setIntervalMinutes] = useState('45')
  const [infinite, setInfinite] = useState(false)
  const [durationHours, setDurationHours] = useState('8')
  const [error, setError] = useState<string | null>(null)

  // Reset form fields ONLY when the dialog transitions from closed → open.
  // Including `agents` in deps caused the form to wipe every second because
  // SchedulesPanel re-renders on its countdown ticker.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    if (initialValues) {
      setName(initialValues.name)
      setAgentId(initialValues.agentId)
      setPromptText(initialValues.promptText)
      setIntervalMinutes(String(initialValues.intervalMinutes))
      setInfinite(initialValues.durationHours === null)
      setDurationHours(initialValues.durationHours === null ? '8' : String(initialValues.durationHours))
    } else {
      setName('')
      setAgentId(agents[0]?.id ?? '')
      setPromptText('')
      setIntervalMinutes('45')
      setInfinite(false)
      setDurationHours('8')
    }
    setError(null)
  }, [open])

  if (!open) return null

  function submit() {
    setError(null)
    if (!agentId) { setError('Pick a target agent'); return }
    if (!promptText.trim()) { setError('Prompt text is required'); return }
    const interval = parseInt(intervalMinutes, 10)
    if (!Number.isInteger(interval) || interval <= 0) { setError('Interval must be a positive integer'); return }
    let duration: number | null = null
    if (!infinite) {
      duration = parseInt(durationHours, 10)
      if (!Number.isInteger(duration) || duration <= 0) { setError('Duration must be a positive integer'); return }
    }

    if (mode === 'edit' && initialValues) {
      onSubmit({
        id: initialValues.id,
        updates: {
          name: name.trim() || undefined,
          promptText: promptText.trim(),
          intervalMinutes: interval,
          durationHours: duration
        }
      })
    } else {
      const agent = agents.find(a => a.id === agentId)!
      onSubmit({
        tabId: agent.tabId,
        agentId: agent.id,
        name: name.trim() || undefined,
        promptText: promptText.trim(),
        intervalMinutes: interval,
        durationHours: duration
      })
    }
  }

  return (
    <Dialog
      title={mode === 'create' ? 'New scheduled prompt' : 'Edit scheduled prompt'}
      icon="calendar-clock"
      size="sm"
      zIndex={1000}
      onClose={onClose}
      closeOnBackdrop
      footerStart={error ? <FieldError>{error}</FieldError> : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>{mode === 'create' ? 'Start' : 'Save'}</Button>
        </>
      }
    >
      <Field label="Name (optional)">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Keep orchestrator going"
        />
      </Field>

      <Field label="Target agent">
        <Select
          value={agentId}
          onChange={setAgentId}
          disabled={mode === 'edit'}
          options={agents.map(a => ({ value: a.id, label: `${a.name} (${a.tabName})` }))}
        />
      </Field>

      <Field label="Prompt">
        <Textarea
          value={promptText}
          onChange={e => setPromptText(e.target.value)}
          rows={4}
          className="cog-schedule__prompt"
          placeholder="You're good to keep going! Add more tasks and push progress forward."
        />
      </Field>

      <Field label="Interval (minutes)">
        <Input
          mono
          type="number"
          min={1}
          value={intervalMinutes}
          onChange={e => setIntervalMinutes(e.target.value)}
        />
      </Field>

      <Checkbox checked={infinite} onChange={setInfinite}>Run indefinitely</Checkbox>

      <Field label="Duration (hours)" className={infinite ? 'cog-field--disabled' : undefined}>
        <Input
          mono
          type="number"
          min={1}
          value={durationHours}
          disabled={infinite}
          onChange={e => setDurationHours(e.target.value)}
        />
      </Field>
    </Dialog>
  )
}
