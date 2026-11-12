import React, { useEffect, useMemo, useState } from 'react'
import type { ScheduledPrompt, CreateScheduleInput, EditScheduleInput, AgentState, WorkspaceTab } from '../../shared/types'
import { ScheduleDialog, type AgentOption } from './ScheduleDialog'
import { ScheduleRow } from './ScheduleRow'
import { PastScheduleRow } from './PastScheduleRow'
import { Button, Icon, EmptyState, Toolbar } from '../ui'

interface Props {
  agents: AgentState[]
  tabs: WorkspaceTab[]
}

export function SchedulesPanel({ agents, tabs }: Props): React.ReactElement {
  const [schedules, setSchedules] = useState<ScheduledPrompt[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<ScheduledPrompt | null>(null)
  const [showPast, setShowPast] = useState(true)
  const [now, setNow] = useState(Date.now())

  // Client-side countdown refresh — pure local, no IPC
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Initial fetch + listen for updates from main
  useEffect(() => {
    void refresh()
    const unsub = window.electronAPI.onSchedulesUpdated((list) => {
      setSchedules(list as ScheduledPrompt[])
    })
    return () => { unsub() }
  }, [])

  async function refresh() {
    const list = await window.electronAPI.listSchedules() as ScheduledPrompt[]
    setSchedules(list)
  }

  const agentOptions: AgentOption[] = useMemo(() => {
    return agents.map(a => {
      const tab = tabs.find(t => t.id === a.tabId) ?? tabs[0]
      return { id: a.id, name: a.name, tabId: a.tabId ?? tab?.id ?? 'tab-default', tabName: tab?.name ?? 'Workspace' }
    })
  }, [agents, tabs])

  const agentNameById = (id: string) => agents.find(a => a.id === id)?.name ?? '(deleted)'
  const tabNameById = (id: string) => tabs.find(t => t.id === id)?.name ?? '(deleted tab)'

  const active = schedules.filter(s => s.status === 'active' || s.status === 'paused')
  const past = schedules.filter(s => s.status === 'stopped' || s.status === 'expired')

  async function handleCreate(input: CreateScheduleInput) {
    try {
      await window.electronAPI.createSchedule(input)
      setDialogOpen(false)
      await refresh()
    } catch (err) {
      console.error('Failed to create schedule', err)
      alert(`Failed to create schedule: ${(err as Error).message}`)
    }
  }

  async function handleEdit(id: string, updates: EditScheduleInput) {
    try {
      await window.electronAPI.editSchedule(id, updates)
      setDialogOpen(false)
      setEditTarget(null)
      await refresh()
    } catch (err) {
      console.error('Failed to edit schedule', err)
      alert(`Failed to edit schedule: ${(err as Error).message}`)
    }
  }

  return (
    <div className="cog-panel cog-sched-panel">
      <Toolbar
        label="Schedules"
        actions={
          <Button
            onClick={() => { setDialogMode('create'); setEditTarget(null); setDialogOpen(true) }}
            disabled={agents.length === 0}
          >
            <Icon name="plus" size={14} />New
          </Button>
        }
      />

      <div className="cog-panel__body">
        {active.length === 0 && past.length === 0 && (
          <EmptyState icon="calendar-clock">
            Prompts you schedule for an agent will appear here. Click New to create one.
          </EmptyState>
        )}

        {active.map(s => (
          <ScheduleRow
            key={s.id}
            schedule={s}
            agentName={agentNameById(s.agentId)}
            tabName={tabNameById(s.tabId)}
            now={now}
            onPause={async () => { await window.electronAPI.pauseSchedule(s.id); await refresh() }}
            onResume={async () => { await window.electronAPI.resumeSchedule(s.id); await refresh() }}
            onStop={async () => { await window.electronAPI.stopSchedule(s.id); await refresh() }}
          />
        ))}

        {past.length > 0 && (
          <>
            <button
              type="button"
              className="cog-disclosure"
              onClick={() => setShowPast(v => !v)}
              aria-expanded={showPast}
            >
              <Icon name={showPast ? 'chevron-down' : 'chevron-right'} size={14} />
              Past schedules <span className="cog-disclosure__count">{past.length}</span>
            </button>
            {showPast && past.map(s => (
              <PastScheduleRow
                key={s.id}
                schedule={s}
                agentName={agentNameById(s.agentId)}
                tabName={tabNameById(s.tabId)}
                onRestart={async () => { await window.electronAPI.restartSchedule(s.id); await refresh() }}
                onEdit={() => { setDialogMode('edit'); setEditTarget(s); setDialogOpen(true) }}
                onDelete={async () => {
                  if (confirm(`Delete "${s.name}"?`)) {
                    await window.electronAPI.deleteSchedule(s.id)
                    await refresh()
                  }
                }}
              />
            ))}
          </>
        )}
      </div>

      <ScheduleDialog
        open={dialogOpen}
        mode={dialogMode}
        agents={agentOptions}
        initialValues={editTarget ?? undefined}
        onSubmit={(result) => {
          if ('id' in result) {
            void handleEdit(result.id, result.updates)
          } else {
            void handleCreate(result)
          }
        }}
        onClose={() => { setDialogOpen(false); setEditTarget(null) }}
      />
    </div>
  )
}
