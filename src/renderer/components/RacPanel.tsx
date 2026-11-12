import React, { useState, useEffect, useCallback, useRef } from 'react'
import { hashCrewPassword as hashPassword, CREW_ACCESS_HASH } from '../../shared/crew-auth'
import { Button, Icon, Input, Textarea, EmptyState, Row, Toolbar, SectionHeader } from '../ui'

interface RacSlot {
  slot_id: string
  parker_name: string
  tier: string
  note: string
  expires_at: number | null
  time_left_ms: number | null
}

interface RacSession {
  session_id: string
  slot_id: string
  parker: string
  renter: string
  agentorch_agent: string
  status: string
}

declare const electronAPI: {
  racGetServer: () => Promise<string>
  racSetServer: (url: string) => Promise<{ status: string }>
  racGetAvailable: () => Promise<{ available: RacSlot[]; count: number; error?: string }>
  racRent: (slotId: string, renterName: string) => Promise<RacSession & { error?: string }>
  racRelease: (sessionId: string) => Promise<{ status?: string; error?: string }>
  racGetSessions: () => Promise<RacSession[]>
  getHubInfo: () => Promise<{ port: number; secret: string }>
}

function formatTimeLeft(ms: number | null): string {
  if (!ms || ms <= 0) return 'No limit'
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

// R.A.C. is in-house only — password gate for the crew
const RAC_ACCESS_HASH = CREW_ACCESS_HASH

type PanelView = 'list' | 'rent-dialog' | 'session-detail'

export function RacPanel(): React.ReactElement {
  const [unlocked, setUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState(false)

  const [serverUrl, setServerUrl] = useState('')
  const [editingUrl, setEditingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [available, setAvailable] = useState<RacSlot[]>([])
  const [sessions, setSessions] = useState<RacSession[]>([])
  const [error, setError] = useState<string | null>(null)
  const [renting, setRenting] = useState(false)

  // View state
  const [view, setView] = useState<PanelView>('list')
  const [selectedSlot, setSelectedSlot] = useState<RacSlot | null>(null)
  const [selectedSession, setSelectedSession] = useState<RacSession | null>(null)

  // Rent dialog form
  const [rentCeoNotes, setRentCeoNotes] = useState('You are a remote worker rented via R.A.C. You communicate through hub messages only. When given a task, work on it and send results back via send_message().')
  const [rentGitRepo, setRentGitRepo] = useState('')
  const [rentName, setRentName] = useState('')

  // Live timer
  const [now, setNow] = useState(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ALL hooks above early return
  const refresh = useCallback(async () => {
    try {
      const [avail, sess] = await Promise.all([
        electronAPI.racGetAvailable(),
        electronAPI.racGetSessions()
      ])
      if (avail.error) {
        setError(avail.error)
        setAvailable([])
      } else {
        setError(null)
        setAvailable(avail.available)
      }
      setSessions(sess)
    } catch (err: any) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('rac-unlocked') === 'true') {
      setUnlocked(true)
    }
  }, [])

  useEffect(() => {
    if (!unlocked) return
    electronAPI.racGetServer().then(url => {
      setServerUrl(url)
      setUrlInput(url)
    })
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [unlocked, refresh])

  // Live countdown timer (updates every second when sessions exist)
  useEffect(() => {
    if (sessions.length > 0 || available.length > 0) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000)
      return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }
  }, [sessions.length, available.length])

  const handleUnlock = async () => {
    const hash = await hashPassword(passwordInput)
    if (hash === RAC_ACCESS_HASH) {
      setUnlocked(true)
      sessionStorage.setItem('rac-unlocked', 'true')
      setPasswordError(false)
    } else {
      setPasswordError(true)
    }
  }

  // --- Lock screen ---
  if (!unlocked) {
    return (
      <div className="cog-panel cog-rac-lock">
        <span className="cog-rac-lock__icon"><Icon name="lock" size={20} /></span>
        <h2 className="cog-rac-lock__title">R.A.C. — crew access only</h2>
        <p className="cog-rac-lock__text">
          This feature is in private testing. Enter the crew password to access.
        </p>
        <Input
          type="password"
          value={passwordInput}
          onChange={e => { setPasswordInput(e.target.value); setPasswordError(false) }}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          placeholder="Password"
          aria-label="Crew password"
          aria-invalid={passwordError || undefined}
        />
        <Button onClick={handleUnlock}>Unlock</Button>
        {passwordError && (
          <div className="cog-rac-lock__error cog-tone-danger" role="alert">
            <Icon name="circle-alert" size={14} />Wrong password
          </div>
        )}
      </div>
    )
  }

  // --- Rent dialog ---
  const handleOpenRentDialog = (slot: RacSlot) => {
    setSelectedSlot(slot)
    setRentName(slot.parker_name)
    setView('rent-dialog')
  }

  const handleConfirmRent = async () => {
    if (!selectedSlot) return
    setRenting(true)

    // Build CEO notes with git repo if provided
    let fullNotes = rentCeoNotes
    if (rentGitRepo.trim()) {
      fullNotes += `\n\nGit repository: ${rentGitRepo.trim()}\nClone the repo to get the codebase. Work on a feature branch and push when done.`
    }

    const result = await electronAPI.racRent(selectedSlot.slot_id, rentName || 'The Cog')
    if (result.error) {
      setError(result.error)
    } else {
      // TODO: Send CEO notes to the rented agent via hub message
      setView('list')
    }
    setRenting(false)
    refresh()
  }

  const handleRelease = async (sessionId: string) => {
    const result = await electronAPI.racRelease(sessionId)
    if (result.error) {
      setError(result.error)
    }
    setView('list')
    refresh()
  }

  const handleSaveUrl = async () => {
    await electronAPI.racSetServer(urlInput)
    setServerUrl(urlInput)
    setEditingUrl(false)
    refresh()
  }

  const liveTimeLeft = (slot: RacSlot): string => {
    if (!slot.expires_at) return 'No limit'
    const remaining = slot.expires_at - now
    if (remaining <= 0) return 'Expired'
    return formatTimeLeft(remaining)
  }

  // --- Rent dialog view ---
  if (view === 'rent-dialog' && selectedSlot) {
    return (
      <div className="cog-panel cog-rac">
        <Toolbar
          label="Rent"
          actions={
            <Button variant="icon" onClick={() => setView('list')} aria-label="Close" title="Close">
              <Icon name="x" size={15} />
            </Button>
          }
        >
          <span className="cog-toolbar__title">
            <Icon name="bot" size={14} /><span>Rent {selectedSlot.parker_name}'s Claude</span>
          </span>
        </Toolbar>

        <div className="cog-panel__body cog-rac__form">
          {/* Slot info */}
          <dl className="cog-facts">
            <dt>Parker</dt>
            <dd>{selectedSlot.parker_name}</dd>
            <dt>Tier</dt>
            <dd>{selectedSlot.tier}</dd>
            <dt>Time remaining</dt>
            <dd className="cog-mono">{liveTimeLeft(selectedSlot)}</dd>
            {selectedSlot.note && (<><dt>Note</dt><dd>"{selectedSlot.note}"</dd></>)}
          </dl>

          {/* Renter name */}
          <label className="cog-field">
            Your name
            <Input value={rentName} onChange={e => setRentName(e.target.value)} />
          </label>

          {/* Git repo */}
          <label className="cog-field">
            Git repository (optional)
            <Input mono value={rentGitRepo} onChange={e => setRentGitRepo(e.target.value)} placeholder="https://github.com/you/repo.git" />
            <span className="cog-field__hint">The rented agent will clone this repo to access your codebase</span>
          </label>

          {/* CEO Notes */}
          <label className="cog-field">
            Instructions for the rented agent
            <Textarea value={rentCeoNotes} onChange={e => setRentCeoNotes(e.target.value)} rows={5} />
          </label>

          {/* Info box */}
          <div className="cog-note">
            <Icon name="info" size={14} />
            <span>This agent runs remotely in a Docker container. It communicates through hub messages — your orchestrator can send_message() to it and receive results back. It cannot access your local files directly.</span>
          </div>
        </div>

        <div className="cog-rac__foot">
          <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
          <Button onClick={handleConfirmRent} disabled={renting}>{renting ? 'Renting…' : 'Rent'}</Button>
        </div>
      </div>
    )
  }

  // --- Main list view ---
  return (
    <div className="cog-panel cog-rac">
      {/* Header */}
      <Toolbar
        label="R.A.C."
        actions={
          <Button
            variant="icon"
            onClick={() => setEditingUrl(!editingUrl)}
            aria-label={editingUrl ? 'Close server settings' : 'Server settings'}
            title={editingUrl ? 'Close server settings' : 'Server settings'}
            aria-expanded={editingUrl}
          >
            <Icon name={editingUrl ? 'x' : 'settings'} size={15} />
          </Button>
        }
      >
        <span className="cog-toolbar__title"><Icon name="bot" size={14} /><span>R.A.C. — Rent-A-Claude</span></span>
      </Toolbar>

      {/* Server URL config */}
      {editingUrl && (
        <div className="cog-rac__url">
          <Input mono value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="http://localhost:7700" aria-label="Server URL" />
          <Button onClick={handleSaveUrl}>Save</Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="cog-banner cog-banner--danger" role="alert">
          <Icon name="circle-alert" size={14} />
          <span className="cog-banner__text" title={error}>{error}</span>
        </div>
      )}

      <div className="cog-panel__body">
        {/* Available slots */}
        <div className="cog-rac__group">
          <SectionHeader count={available.length}>Available</SectionHeader>

          {available.length === 0 && !error && (
            <EmptyState icon="bot" compact>No slots available right now.</EmptyState>
          )}

          {available.map(slot => {
            const left = liveTimeLeft(slot)
            return (
              <Row
                key={slot.slot_id}
                icon={<Icon name="bot" size={15} />}
                title={slot.parker_name}
                tooltip={slot.note ? `${slot.parker_name}\n\n"${slot.note}"` : slot.parker_name}
                meta={
                  <span className="cog-rac__meta">
                    <span>{slot.tier}</span>
                    {slot.note && <span>"{slot.note}"</span>}
                  </span>
                }
                state={<span className={`cog-rac__time${left === 'Expired' ? ' cog-tone-danger' : ''}`}>{left}</span>}
                actions={<Button onClick={() => handleOpenRentDialog(slot)}>Rent</Button>}
              />
            )
          })}
        </div>

        {/* Rented sessions */}
        {sessions.length > 0 && (
          <div className="cog-rac__group">
            <SectionHeader count={sessions.length}>Rented</SectionHeader>

            {sessions.map(session => (
              <Row
                key={session.session_id}
                icon={<span className="cog-tone-working"><Icon name="circle-dot" size={15} /></span>}
                title={session.parker}
                tooltip={`Session ${session.session_id}`}
                meta={
                  <span className="cog-rac__meta">
                    <span>Agent <span className="cog-mono">{session.agentorch_agent}</span></span>
                    <span className="cog-mono">{session.session_id}</span>
                  </span>
                }
                state={<span className="cog-rac__state cog-tone-working">{session.status}</span>}
                actions={
                  <Button variant="ghost" className="cog-tone-danger" onClick={() => handleRelease(session.session_id)}>
                    Release
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="cog-panel__foot" title={serverUrl}>
        Server <span className="cog-mono">{serverUrl}</span>
      </div>
    </div>
  )
}
