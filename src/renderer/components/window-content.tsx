import React from 'react'
import { TerminalWindow } from './TerminalWindow'
import { PinboardPanel } from './PinboardPanel'
import { InfoChannelPanel } from './InfoChannelPanel'
import { FilePanel } from './FilePanel'
import { RacPanel } from './RacPanel'
import { UsagePanel } from './UsagePanel'
import { GitPanel } from './GitPanel'
import { SchedulesPanel } from './SchedulesPanel'
import { TrollboxPanel } from './TrollboxPanel'
import { InboxPanel } from './InboxPanel'
import { Workboard } from './Workboard'
import { RacAgentChat } from './RacAgentChat'
import type { WindowState } from '../hooks/useWindowManager'
import type { AgentState, WorkspaceTab } from '../../shared/types'
import { getPanelType } from '../panel-ids'

export const STATUS_COLORS: Record<string, string> = {
  idle: '#888',
  active: '#4caf50',
  working: '#ffc107',
  disconnected: '#f44336',
  sleeping: '#5c6bc0',
  waking: '#29b6f6'
}

export interface WindowContentContext {
  agents: AgentState[]
  tabs: WorkspaceTab[]
  activeTabId?: string
}

export function windowAgent(win: WindowState, agents: AgentState[]): AgentState | undefined {
  return !getPanelType(win.id) ? agents.find(a => a.id === win.id) : undefined
}

export function windowTitle(win: WindowState, agents: AgentState[]): string {
  const agent = windowAgent(win, agents)
  return agent
    ? `${agent.name} (${agent.cli}) · ${agent.role}`
    : win.title
}

export function windowStatusColor(win: WindowState, agents: AgentState[]): string | undefined {
  const agent = windowAgent(win, agents)
  return agent ? STATUS_COLORS[agent.status] ?? '#888' : undefined
}

export function renderWindowContent(win: WindowState, ctx: WindowContentContext): React.ReactNode {
  const { agents, tabs, activeTabId } = ctx
  const panelType = getPanelType(win.id)
  const agent = windowAgent(win, agents)

  if (panelType === 'pinboard') {
    return <PinboardPanel tabId={activeTabId} />
  } else if (panelType === 'info') {
    return <InfoChannelPanel tabId={activeTabId} />
  } else if (panelType === 'files') {
    return <FilePanel />
  } else if (panelType === 'rac') {
    return <RacPanel />
  } else if (panelType === 'usage') {
    return <UsagePanel />
  } else if (panelType === 'git') {
    return <GitPanel />
  } else if (panelType === 'schedules') {
    return <SchedulesPanel agents={agents} tabs={tabs} />
  } else if (panelType === 'trollbox') {
    return <TrollboxPanel />
  } else if (panelType === 'inbox') {
    return <InboxPanel />
  } else if (panelType === 'board') {
    return <Workboard />
  } else if (agent && agent.name.startsWith('rac-')) {
    return <RacAgentChat agentName={agent.name} />
  }
  return <TerminalWindow agentId={win.id} theme={agent?.theme} />
}
