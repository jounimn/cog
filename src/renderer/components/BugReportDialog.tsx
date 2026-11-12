import React, { useState, useEffect } from 'react'
import { Button, Dialog, Field, Icon, Select, Textarea } from '../ui'

declare const electronAPI: {
  getAgents: () => Promise<any[]>
  getProject: () => Promise<{ path: string; name: string } | null>
  getHubInfo: () => Promise<{ port: number }>
  submitBugReport: (title: string, body: string) => Promise<{ success: boolean; method: string; issueUrl?: string; error?: string }>
}

export function BugReportDialog({ onClose }: { onClose: () => void }): React.ReactElement {
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [systemInfo, setSystemInfo] = useState('')

  useEffect(() => {
    // Auto-collect system info
    const collectInfo = async () => {
      const project = await electronAPI.getProject()
      const agents = await electronAPI.getAgents()
      const hubInfo = await electronAPI.getHubInfo().catch(() => null)

      const info = [
        `**Platform:** ${navigator.platform}`,
        `**User Agent:** ${navigator.userAgent}`,
        `**Project:** ${project?.name || 'None'}`,
        `**Active Agents:** ${agents.length} (${agents.map((a: any) => `${a.name} [${a.cli}/${a.status}]`).join(', ') || 'none'})`,
        `**Hub Port:** ${hubInfo?.port || 'N/A'}`,
        `**Window Size:** ${window.innerWidth}x${window.innerHeight}`,
        `**Timestamp:** ${new Date().toISOString()}`,
      ].join('\n')
      setSystemInfo(info)
    }
    collectInfo()
  }, [])

  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<string | null>(null)

  const handleSubmit = async () => {
    const title = description.slice(0, 80)
    const body = [
      `## Bug Description`,
      description,
      ``,
      `## Steps to Reproduce`,
      steps || '_Not provided_',
      ``,
      `## Severity`,
      severity,
      ``,
      `## System Info`,
      systemInfo,
    ].join('\n')

    setSubmitting(true)

    // Try API first (no login needed), fall back to browser
    const result = await electronAPI.submitBugReport(title, body)
    if (result.success) {
      setSubmitResult('Bug report submitted! We\'ll look into it.')
      setTimeout(onClose, 2000)
    } else if (result.method === 'browser') {
      // No token — fall back to browser (user needs GitHub login)
      const encodedTitle = encodeURIComponent(title)
      const encodedBody = encodeURIComponent(body)
      window.open(`https://github.com/the-cog-dev/cog/issues/new?title=${encodedTitle}&body=${encodedBody}&labels=bug`, '_blank')
      onClose()
    } else {
      setSubmitResult(`Failed: ${result.error}`)
    }
    setSubmitting(false)
  }

  const ok = submitResult?.startsWith('Bug') ?? false

  return (
    <Dialog
      title="Report a bug"
      icon="bug"
      size="sm"
      zIndex={100002}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!description.trim() || submitting}>
            <Icon name="send" size={14} />{submitting ? 'Submitting...' : 'Submit bug report'}
          </Button>
        </>
      }
    >
      <Field label="What happened?">
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the bug..."
          rows={3}
          className="cog-bug__text"
        />
      </Field>

      <Field label="Steps to reproduce (optional)">
        <Textarea
          value={steps}
          onChange={e => setSteps(e.target.value)}
          placeholder="1. Open the app&#10;2. Click on...&#10;3. See error"
          rows={3}
          className="cog-bug__text"
        />
      </Field>

      <Field label="Severity">
        <Select value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
      </Field>

      <div className="cog-bug__info">
        <span>Auto-collected info (included in report):</span>
        {/* Display only: the submitted body keeps the markdown bold. */}
        <pre className="cog-pre">{systemInfo.replace(/\*\*/g, '')}</pre>
      </div>

      {submitResult && (
        <div className={`cog-bug__result ${ok ? 'cog-tone-success' : 'cog-tone-danger'}`} role="status">
          <Icon name={ok ? 'circle-check' : 'circle-alert'} size={14} />
          {submitResult}
        </div>
      )}

      <p className="cog-bug__thanks">Your report helps us improve The Cog. Thank you!</p>
    </Dialog>
  )
}

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low — cosmetic / minor annoyance' },
  { value: 'medium', label: 'Medium — feature broken but workaround exists' },
  { value: 'high', label: 'High — can\'t use a feature at all' },
  { value: 'critical', label: 'Critical — app crashes or data loss' }
]
