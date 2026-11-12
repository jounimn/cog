import React, { useState, useEffect } from 'react'
import { Button, Icon, EmptyState, Toolbar } from '../ui'
import { usagePresentation, uptimeLabel } from '../panel-present'

interface AgentMetricsData {
  agentName: string
  cli: string
  model: string
  messagesSent: number
  messagesReceived: number
  tasksPosted: number
  tasksClaimed: number
  tasksCompleted: number
  infoPosted: number
  spawnedAt: string
  providerUsage?: {
    used: number
    total: number
    unit: string
    raw?: string
  }
}

declare const electronAPI: {
  getUsageMetrics: () => Promise<AgentMetricsData[]>
  refreshUsageLimits: () => Promise<Array<{ agentName: string; providerUsage?: any }>>
}

function UsageBar({ used, total, unit }: { used: number; total: number; unit: string }): React.ReactElement {
  const u = usagePresentation(used, total, unit)

  return (
    <div className="cog-usage__bar">
      <div className="cog-usage__barline">
        <span>
          {u.left}
          {u.word && (
            <span className={`cog-usage__level cog-tone-${u.tone}`}>
              {' '}<Icon name="circle-alert" size={12} />{u.word}
            </span>
          )}
        </span>
        <span><span className="cog-mono">{Math.round(u.pct)}%</span> used</span>
      </div>
      <div
        className="cog-meter"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(u.pct)}
        aria-label="Provider usage"
      >
        <div
          className={u.tone ? `cog-meter__fill cog-meter__fill--${u.tone}` : 'cog-meter__fill'}
          style={{ width: `${u.pct}%` }}
        />
      </div>
    </div>
  )
}

export function UsagePanel(): React.ReactElement {
  const [metrics, setMetrics] = useState<AgentMetricsData[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)

  useEffect(() => {
    electronAPI.getUsageMetrics().then(setMetrics)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    const freshMetrics = await electronAPI.getUsageMetrics()
    const limits = await electronAPI.refreshUsageLimits()
    const merged = freshMetrics.map(m => {
      const limit = limits.find(l => l.agentName === m.agentName)
      return { ...m, providerUsage: limit?.providerUsage }
    })
    setMetrics(merged)
    setLastRefreshed(new Date().toLocaleTimeString())
    setRefreshing(false)
  }

  return (
    <div className="cog-panel cog-usage">
      <Toolbar
        label="Usage"
        actions={
          <Button variant="ghost" onClick={handleRefresh} disabled={refreshing}>
            <Icon name="refresh-cw" size={14} />{refreshing ? 'Checking…' : 'Refresh limits'}
          </Button>
        }
      >
        <span className="cog-toolbar__title"><Icon name="gauge" size={14} /><span>Usage</span></span>
      </Toolbar>

      <div className="cog-panel__body">
        {metrics.length === 0 ? (
          <EmptyState icon="gauge">No agents running. Spawn agents to see usage.</EmptyState>
        ) : metrics.map(m => (
          <section key={m.agentName} className="cog-usage__agent">
            <div className="cog-usage__head">
              <span className="cog-usage__name">{m.agentName}</span>
              <span className="cog-usage__spec" title={`${m.cli} ${m.model}`}>{m.cli} {m.model}</span>
            </div>

            {m.providerUsage && m.providerUsage.total > 0 && m.providerUsage.unit !== 'unknown' && (
              <UsageBar used={m.providerUsage.used} total={m.providerUsage.total} unit={m.providerUsage.unit} />
            )}

            {m.providerUsage?.raw && (
              <pre className="cog-pre">{m.providerUsage.raw}</pre>
            )}

            {!m.providerUsage && (
              <div className="cog-usage__hint">
                Provider limits: click Refresh limits to check
              </div>
            )}

            <div className="cog-usage__counts">
              <span><b>{m.messagesSent}</b> sent</span>
              <span><b>{m.messagesReceived}</b> received</span>
              <span><b>{m.tasksCompleted}</b> tasks</span>
              <span><b>{m.infoPosted}</b> info</span>
              <span><b>{uptimeLabel(m.spawnedAt)}</b> active</span>
            </div>
          </section>
        ))}
      </div>

      {lastRefreshed && (
        <div className="cog-panel__foot">
          Last refreshed <span className="cog-mono">{lastRefreshed}</span>
        </div>
      )}
    </div>
  )
}
