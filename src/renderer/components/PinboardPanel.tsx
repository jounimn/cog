import React, { useState, useEffect, useRef } from 'react'
import type { PinboardTask } from '../../shared/types'
import { useContainCanvasScroll } from '../hooks/useContainCanvasScroll'
import { Button, Icon, Menu, MenuItem, MenuSeparator, EmptyState, Row, Toolbar, SectionHeader } from '../ui'
import {
  TASK_STATUS_ORDER, taskStatusPresentation, taskPriorityPresentation, shortTaskId, clip, snoozeCountdown
} from '../panel-present'

function TaskRow({ task, onClick }: { task: PinboardTask; onClick: () => void }): React.ReactElement {
  const st = taskStatusPresentation(task.status)
  const pr = taskPriorityPresentation(task.priority)
  // The list shows the audition row; the description and result previews ride in the tooltip.
  const tooltip = [
    task.title,
    task.description && clip(task.description, 120),
    task.result && `Result: ${clip(task.result, 80)}`
  ].filter(Boolean).join('\n\n')
  return (
    <Row
      onClick={onClick}
      tooltip={tooltip}
      icon={<span className={`cog-tone-${st.tone}`}><Icon name={st.icon} size={15} /></span>}
      id={shortTaskId(task.id)}
      title={task.title}
      meta={
        <span className="cog-pin__meta">
          {task.claimedBy && <span className="cog-pin__owner">{task.claimedBy}</span>}
          <span className={pr.tone ? `cog-tone-${pr.tone}` : undefined}>{pr.word} priority</span>
        </span>
      }
      state={<span className={`cog-tone-${st.tone}`}>{st.word}</span>}
    />
  )
}

function TaskDetail({ task, onBack }: { task: PinboardTask; onBack: () => void }): React.ReactElement {
  const st = taskStatusPresentation(task.status)
  const pr = taskPriorityPresentation(task.priority)
  const attachWheelGuard = useContainCanvasScroll<HTMLDivElement>()

  return (
    <div ref={attachWheelGuard} className="cog-panel cog-pin">
      <div className="cog-pin-detail__head">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="arrow-left" size={15} />Back
        </Button>
        <h2 className="cog-pin-detail__title" title={task.title}>{task.title}</h2>
        <span className={`cog-pin-detail__state cog-tone-${st.tone}`}>
          <Icon name={st.icon} size={14} />{st.word}
        </span>
      </div>

      <div className="cog-pin-detail__body">
        <dl className="cog-facts">
          <dt>Priority</dt>
          <dd className={pr.tone ? `cog-tone-${pr.tone}` : undefined}>{pr.word}</dd>
          {task.createdBy && (<><dt>Created by</dt><dd>{task.createdBy}</dd></>)}
          {task.claimedBy && (<><dt>Claimed by</dt><dd>{task.claimedBy}</dd></>)}
          <dt>Created</dt>
          <dd className="cog-mono">{new Date(task.createdAt).toLocaleString()}</dd>
          {task.targetRole && (<><dt>Target role</dt><dd>{task.targetRole}</dd></>)}
        </dl>

        <section className="cog-block">
          <h3 className="cog-block__title">Description</h3>
          <div className="cog-block__text">{task.description || '(none)'}</div>
        </section>

        {task.result && (
          <section className="cog-block">
            <h3 className="cog-block__title">Result</h3>
            <div className="cog-block__text cog-block__text--success">{task.result}</div>
          </section>
        )}

        <div className="cog-pin-detail__id">ID: {task.id}</div>
      </div>
    </div>
  )
}

declare const electronAPI: {
  getPinboardTasks: (tabId?: string) => Promise<PinboardTask[]>
  clearCompletedTasks: () => Promise<{ status: string; cleared: number }>
  onPinboardUpdate: (cb: (tasks: PinboardTask[]) => void) => () => void
  getStaleAlertSnooze: () => Promise<{ muteUntil: number | null }>
  setStaleAlertSnooze: (durationMs: number | null) => Promise<{ muteUntil: number | null }>
  onStaleAlertUpdate: (cb: (state: { muteUntil: number | null }) => void) => () => void
}

const SNOOZE_OPTIONS: { label: string; ms: number }[] = [
  { label: '15 minutes', ms: 15 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: '8 hours', ms: 8 * 60 * 60 * 1000 }
]

function SnoozeControl(): React.ReactElement {
  const [muteUntil, setMuteUntil] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const anchorRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    window.electronAPI.getStaleAlertSnooze().then(s => setMuteUntil(s.muteUntil))
    const cleanup = window.electronAPI.onStaleAlertUpdate(s => setMuteUntil(s.muteUntil))
    return cleanup
  }, [])

  // Local tick so the countdown display updates and we flip back to "Snooze" on expiry
  useEffect(() => {
    if (muteUntil === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [muteUntil])

  const isDisabled = muteUntil === -1
  const isMuted = !isDisabled && muteUntil !== null && now < muteUntil

  // Auto-clear local state when the snooze expires client-side
  useEffect(() => {
    if (muteUntil !== null && muteUntil !== -1 && now >= muteUntil) setMuteUntil(null)
  }, [now, muteUntil])

  const handleSet = async (ms: number) => {
    setOpen(false)
    const s = await window.electronAPI.setStaleAlertSnooze(ms)
    setMuteUntil(s.muteUntil)
  }

  const handleDisable = async () => {
    setOpen(false)
    const s = await window.electronAPI.setStaleAlertSnooze(-1)
    setMuteUntil(s.muteUntil)
  }

  const handleEnable = async () => {
    const s = await window.electronAPI.setStaleAlertSnooze(null)
    setMuteUntil(s.muteUntil)
  }

  const handleUnmute = async () => {
    const s = await window.electronAPI.setStaleAlertSnooze(null)
    setMuteUntil(s.muteUntil)
  }

  const countdown = isMuted && muteUntil !== null ? snoozeCountdown(muteUntil - now) : ''

  if (isDisabled) {
    return (
      <Button
        variant="ghost"
        className="cog-tone-danger"
        onClick={handleEnable}
        title="Stale task alerts are disabled — click to re-enable"
      ><Icon name="bell-off" size={15} />Disabled</Button>
    )
  }

  if (isMuted) {
    return (
      <Button
        variant="ghost"
        className="cog-tone-warning"
        onClick={handleUnmute}
        title="Click to unmute stale task alerts"
      ><Icon name="pause" size={15} />Muted <span className="cog-mono">{countdown}</span></Button>
    )
  }

  return (
    <div className="cog-menu-wrap">
      <Button
        ref={anchorRef}
        variant="ghost"
        onClick={() => setOpen(v => !v)}
        title="Snooze stale task alerts"
        aria-haspopup="menu"
        aria-expanded={open}
      ><Icon name="bell" size={15} />Snooze</Button>
      {open && (
        // Click-away layer, as before: a click outside only closes the menu.
        <div className="cog-menu-backdrop" onClick={() => setOpen(false)} />
      )}
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        label="Snooze stale task alerts"
        align="right"
        closeOnOutside={false}
        className="cog-pin__snooze"
      >
        {SNOOZE_OPTIONS.map(opt => (
          <MenuItem key={opt.ms} onClick={() => handleSet(opt.ms)}>{opt.label}</MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem tone="danger" icon="bell-off" onClick={handleDisable}>Disable</MenuItem>
      </Menu>
    </div>
  )
}

export function PinboardPanel({ tabId }: { tabId?: string }): React.ReactElement {
  const [tasks, setTasks] = useState<PinboardTask[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const attachWheelGuard = useContainCanvasScroll<HTMLDivElement>()

  useEffect(() => {
    window.electronAPI.getPinboardTasks(tabId).then(setTasks)
    const cleanup = window.electronAPI.onPinboardUpdate((allTasks) => {
      // Filter push updates by tab
      if (tabId) {
        setTasks(allTasks.filter(t => !t.tabId || t.tabId === tabId))
      } else {
        setTasks(allTasks)
      }
    })
    return cleanup
  }, [tabId])

  const completedCount = tasks.filter(t => t.status === 'completed').length

  const handleClearCompleted = async () => {
    try {
      await window.electronAPI.clearCompletedTasks()
      const updated = await window.electronAPI.getPinboardTasks(tabId)
      setTasks(updated)
    } catch { /* failed */ }
  }

  if (tasks.length === 0) {
    return (
      <div ref={attachWheelGuard} className="cog-panel cog-pin">
        <EmptyState icon="pin">Tasks that agents post to the pinboard will appear here.</EmptyState>
      </div>
    )
  }

  // Show detail view if a task is selected
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null
  if (selectedTask) {
    return <TaskDetail task={selectedTask} onBack={() => setSelectedTaskId(null)} />
  }

  const grouped = Object.fromEntries(
    TASK_STATUS_ORDER.map(key => [key, tasks.filter(t => t.status === key)])
  ) as Record<PinboardTask['status'], PinboardTask[]>

  return (
    <div ref={attachWheelGuard} className="cog-panel cog-pin">
      <Toolbar label="Pinboard" actions={<SnoozeControl />}>
        <span className="cog-pin__count">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
      </Toolbar>
      <div className="cog-pin__body">
        {TASK_STATUS_ORDER.map(key => {
          const st = taskStatusPresentation(key)
          return (
            <section key={key} className="cog-pin__group">
              <SectionHeader
                count={grouped[key].length}
                actions={key === 'completed' && completedCount > 0 ? (
                  <Button
                    variant="ghost"
                    className="cog-tone-danger"
                    onClick={handleClearCompleted}
                    title="Clear all completed tasks"
                  ><Icon name="trash" size={14} />Clear</Button>
                ) : null}
              >
                {st.word}
              </SectionHeader>
              {grouped[key].length === 0 ? (
                <EmptyState icon={st.icon} compact>No {st.word.toLowerCase()} tasks.</EmptyState>
              ) : grouped[key].map(task => (
                <TaskRow key={task.id} task={task} onClick={() => setSelectedTaskId(task.id)} />
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
