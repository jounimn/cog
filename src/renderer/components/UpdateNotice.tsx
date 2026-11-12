import React, { useState, useEffect, useRef } from 'react'
import { Button, Icon } from '../ui'

interface UpdateInfo {
  available: boolean
  currentSha: string
  remoteSha: string
  message: string
  date: string
}

declare const electronAPI: {
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void
  checkForUpdate: () => Promise<UpdateInfo | null>
  performUpdate: () => Promise<{ success: boolean; error?: string }>
  restartApp: () => void
}

type Phase = 'notify' | 'confirm' | 'updating' | 'done' | 'failed'

export function UpdateNotice(): React.ReactElement | null {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('notify')
  const [errorMsg, setErrorMsg] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const dismissedShaRef = useRef<string | null>(null)
  const dismissedAtRef = useRef<number>(0)
  const DISMISS_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

  useEffect(() => {
    const unsub = electronAPI.onUpdateAvailable((info: UpdateInfo) => {
      if (!info.available) return
      const sameSha = info.remoteSha === dismissedShaRef.current
      const withinCooldown = Date.now() - dismissedAtRef.current < DISMISS_COOLDOWN_MS
      if (sameSha && withinCooldown) return
      setUpdate(info)
      setPhase('notify')
      setDismissed(false)
    })
    electronAPI.checkForUpdate().then(info => {
      if (info?.available) {
        setUpdate(info)
      }
    })
    return unsub
  }, [])

  const handleConfirmUpdate = async () => {
    setPhase('updating')
    const res = await electronAPI.performUpdate()
    if (res.success) {
      setPhase('done')
    } else {
      setErrorMsg(res.error || 'Unknown error')
      setPhase('failed')
    }
  }

  if (!update || !update.available || dismissed) return null

  // Same body the close button and "Later" always ran: hide, and remember this sha for the cooldown.
  const dismiss = () => {
    setDismissed(true)
    if (update) { dismissedShaRef.current = update.remoteSha; dismissedAtRef.current = Date.now() }
  }

  return (
    <div className="cog-toast" role="status" aria-live="polite">
      <div className="cog-toast__head">
        <Icon name="download" size={15} />
        <h2 className="cog-toast__title">Update available</h2>
        <Button variant="icon" onClick={dismiss} aria-label="Dismiss" title="Dismiss"><Icon name="x" size={14} /></Button>
      </div>
      <div className="cog-toast__sha">
        {update.currentSha} {'→'} {update.remoteSha}
      </div>
      <div className="cog-toast__msg">
        {update.message}
      </div>

      {/* Phase: Initial notification */}
      {phase === 'notify' && (
        <div className="cog-toast__actions">
          <Button onClick={() => setPhase('confirm')}>Update now</Button>
          <Button variant="ghost" onClick={dismiss}>Later</Button>
        </div>
      )}

      {/* Phase: Confirmation warning */}
      {phase === 'confirm' && (
        <div>
          <div className="cog-note cog-note--warning" role="alert">
            <Icon name="circle-alert" size={14} />
            <span>The Cog will restart after updating. All running agents will be stopped. Save any work before proceeding.</span>
          </div>
          <div className="cog-toast__actions">
            <Button variant="ghost" className="cog-tone-danger" onClick={handleConfirmUpdate}>Update and restart</Button>
            <Button variant="ghost" onClick={() => setPhase('notify')}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Phase: Updating */}
      {phase === 'updating' && (
        <div className="cog-toast__status cog-tone-muted">
          Updating… pulling latest code and installing dependencies.
        </div>
      )}

      {/* Phase: Done — restart button */}
      {phase === 'done' && (
        <div>
          <div className="cog-toast__status">
            <Icon name="circle-check" size={14} />
            <span>Update complete. Restart to apply.</span>
          </div>
          <Button onClick={() => electronAPI.restartApp()}>Restart now</Button>
        </div>
      )}

      {/* Phase: Failed */}
      {phase === 'failed' && (
        <div>
          <div className="cog-toast__status cog-tone-danger">
            <Icon name="circle-alert" size={14} />
            <span>Update failed: {errorMsg}</span>
          </div>
          <Button variant="ghost" onClick={() => setPhase('notify')}>OK</Button>
        </div>
      )}
    </div>
  )
}
