import { useState, useEffect, useCallback } from 'react'
import type { AgentConfig, AgentState, KilledAgentSummary } from '../../shared/types'
import { v4 as uuid } from 'uuid'

const STATUS_COLORS: Record<string, string> = {
  idle: '#888',
  active: '#4caf50',
  working: '#ffc107',
  disconnected: '#f44336',
  sleeping: '#5c6bc0',
  waking: '#29b6f6'
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentState[]>([])
  // Killed agents of the active workspace; refreshed when the Agents menu
  // opens and after every kill / restore / forget.
  const [killedAgents, setKilledAgents] = useState<KilledAgentSummary[]>([])

  useEffect(() => {
    const cleanup = window.electronAPI.onAgentStateUpdate((updated) => {
      setAgents(updated)
    })
    window.electronAPI.getAgents().then(setAgents)
    return cleanup
  }, [])

  const spawnAgent = useCallback(async (config: Omit<AgentConfig, 'id'>) => {
    const fullConfig: AgentConfig = { ...config, id: uuid() }
    await window.electronAPI.spawnAgent(fullConfig)
    return fullConfig.id
  }, [])

  const refreshKilled = useCallback(async () => {
    setKilledAgents(await window.electronAPI.listKilledAgents())
  }, [])

  const killAgent = useCallback(async (agentId: string) => {
    await window.electronAPI.killAgent(agentId)
    await refreshKilled()
  }, [refreshKilled])

  const restoreAgent = useCallback(async (agentId: string) => {
    const result = await window.electronAPI.restoreAgent(agentId)
    await refreshKilled()
    return result
  }, [refreshKilled])

  const forgetKilledAgent = useCallback(async (agentId: string) => {
    await window.electronAPI.forgetKilledAgent(agentId)
    await refreshKilled()
  }, [refreshKilled])

  const getStatusColor = useCallback((status: string) => {
    return STATUS_COLORS[status] ?? '#888'
  }, [])

  return { agents, spawnAgent, killAgent, getStatusColor, killedAgents, refreshKilled, restoreAgent, forgetKilledAgent }
}
