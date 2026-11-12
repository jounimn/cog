import React, { useState, useEffect } from 'react'
import type { AgentConfig } from '../../shared/types'
import { Button, Dialog } from '../ui'
import { AgentConfigForm, emptyFormValue, buildSubmitConfig, type AgentConfigFormValue } from './AgentConfigForm'

interface SpawnDialogProps {
  onSpawn: (config: Omit<AgentConfig, 'id'>) => void
  onCancel: () => void
}

export function SpawnDialog({ onSpawn, onCancel }: SpawnDialogProps): React.ReactElement {
  const [form, setForm] = useState<AgentConfigFormValue>(() => emptyFormValue())

  useEffect(() => {
    window.electronAPI.getCwd().then(cwd => setForm(prev => ({ ...prev, cwd })))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSpawn(buildSubmitConfig(form))
  }

  return (
    <Dialog
      title="New agent"
      icon="bot"
      size="sm"
      zIndex={99999}
      onClose={onCancel}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={!form.name.trim()}>Spawn</Button>
        </>
      }
    >
      <AgentConfigForm value={form} onChange={setForm} />
    </Dialog>
  )
}

// Re-export CLI_MODELS for backward compat with PresetDialog.tsx (which imports it from here)
export { CLI_MODELS } from './AgentConfigForm'

