import React, { useState, useEffect, useMemo } from 'react'
import type { AgentConfig, AgentState } from '../../shared/types'
import { defaultWorktreeForRole } from '../../shared/agent-worktree-defaults'
import { Button, Dialog } from '../ui'
import { AgentConfigForm, buildSubmitConfig, emptyFormValue, CLI_MODELS, OPENCLAUDE_PROVIDERS, type AgentConfigFormValue } from './AgentConfigForm'

interface EditAgentDialogProps {
  agent: AgentState
  onClose: () => void
}

function configToFormValue(agent: AgentConfig): AgentConfigFormValue {
  const isPresetCli = ['claude', 'codex', 'kimi', 'gemini', 'openclaude', 'copilot', 'grok', 'terminal'].includes(agent.cli)
  const isPresetRole = ['orchestrator', 'worker', 'researcher', 'reviewer'].includes(agent.role)

  // Model: route to customModel if not a preset for this CLI
  const modelValue = agent.model ?? ''
  const presetModels = CLI_MODELS[agent.cli] ?? []
  const isPresetModel = modelValue === '' || presetModels.some(m => m.value === modelValue)
  const formModel = isPresetModel ? modelValue : ''
  const formCustomModel = isPresetModel ? '' : modelValue

  // Provider URL: route to customProviderUrl if not a preset
  const providerValue = agent.providerUrl ?? 'https://api.openai.com/v1'
  const isPresetProvider = OPENCLAUDE_PROVIDERS.some(p => p.url === providerValue)
  const formProviderUrl = isPresetProvider ? providerValue : ''
  const formCustomProviderUrl = isPresetProvider ? '' : providerValue

  return {
    ...emptyFormValue(),
    name: agent.name,
    cli: isPresetCli ? agent.cli : '',
    customCli: isPresetCli ? '' : agent.cli,
    cwd: agent.cwd,
    role: isPresetRole ? agent.role : '',
    customRole: isPresetRole ? '' : agent.role,
    ceoNotes: agent.ceoNotes,
    shell: agent.shell,
    admin: agent.admin,
    autoMode: agent.autoMode,
    promptRegex: agent.promptRegex ?? '',
    model: formModel,
    customModel: formCustomModel,
    providerUrl: formProviderUrl,
    customProviderUrl: formCustomProviderUrl,
    selectedSkills: (agent.skills ?? []).map(id => ({ id, name: id })),  // names re-resolved below
    showAdvanced: !!agent.promptRegex,
    worktree: agent.worktree ?? defaultWorktreeForRole(agent.role, agent.cli),
    worktreeTouched: agent.worktree !== undefined,
    // Spawn asleep is creation-only: never loaded into an edit.
    spawnAsleep: false,
    neverSleep: agent.neverSleep ?? false,
  }
}

export function EditAgentDialog({ agent, onClose }: EditAgentDialogProps): React.ReactElement {
  const [form, setForm] = useState<AgentConfigFormValue>(() => configToFormValue(agent))
  const [errors, setErrors] = useState<Partial<Record<keyof AgentConfigFormValue, string>>>({})
  const [busyConfirm, setBusyConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const initialForm = useMemo(() => configToFormValue(agent), [agent.id])
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  )

  // Resolve skill names from IDs
  useEffect(() => {
    if (!agent.skills || agent.skills.length === 0) return
    window.electronAPI.listSkills().then((skills: any[]) => {
      const named = agent.skills!.map(id => {
        const found = skills.find(s => s.id === id)
        return { id, name: found?.name ?? id }
      })
      setForm(prev => ({ ...prev, selectedSkills: named }))
    })
  }, [agent.id])

  const performRespawn = async () => {
    setSubmitting(true)
    setErrors({})
    try {
      const newConfig = buildSubmitConfig(form)
      const result = await window.electronAPI.respawnAgent(agent.id, newConfig)
      if (result.ok) {
        onClose()
      } else {
        const next: Partial<Record<keyof AgentConfigFormValue, string>> = {}
        if (result.error === 'NAME_TAKEN') next.name = 'An agent with this name already exists'
        else if (result.error === 'CWD_MISSING') next.cwd = 'Directory does not exist'
        else if (result.error === 'AGENT_ASLEEP') next.name = 'Wake the agent before editing it'
        else next.name = result.message ?? 'Could not respawn agent'
        setErrors(next)
      }
    } catch (err) {
      setErrors({ name: (err as Error).message })
    } finally {
      setSubmitting(false)
      setBusyConfirm(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isDirty) { onClose(); return }
    if (agent.status === 'working') {
      setBusyConfirm(true)
      return
    }
    void performRespawn()
  }

  const handleCancel = () => {
    if (!isDirty) { onClose(); return }
    if (window.confirm('Discard changes?')) onClose()
  }

  return (
    <Dialog
      title={<>Edit agent — <span className="cog-dialog__title-sub">{agent.name}</span></>}
      icon="pencil"
      size="sm"
      zIndex={99999}
      onClose={submitting ? undefined : handleCancel}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={handleCancel} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={!form.name.trim() || submitting}>
            {submitting ? 'Respawning…' : 'Save & Respawn'}
          </Button>
        </>
      }
    >
      <AgentConfigForm value={form} onChange={setForm} errors={errors} hideSpawnAsleep />

      {busyConfirm && (
        <div className="cog-dialog__overlay" role="alertdialog" aria-label="Agent is busy">
          <p>Agent is busy — kill and respawn anyway?</p>
          <div className="cog-dialog__overlay-actions">
            <Button variant="ghost" onClick={() => setBusyConfirm(false)}>Cancel</Button>
            <Button className="cog-tone-danger" onClick={() => void performRespawn()}>Kill and respawn</Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
