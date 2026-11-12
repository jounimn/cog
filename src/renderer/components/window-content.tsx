import React, { Suspense, lazy } from 'react'
import { TerminalWindow } from './TerminalWindow'
import { PinboardPanel } from './PinboardPanel'
import { InfoChannelPanel } from './InfoChannelPanel'
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
import type { PlateSpec } from './PlateHeader'
import { Loading } from '../ui'

// Monaco is ~10 MB: keep it out of the main chunk until a Files panel opens.
const FilePanel = lazy(() => import('./FilePanel').then(m => ({ default: m.FilePanel })))

export interface WindowContentContext {
  agents: AgentState[]
  tabs: WorkspaceTab[]
  activeTabId?: string
}

export function windowAgent(win: WindowState, agents: AgentState[]): AgentState | undefined {
  return !getPanelType(win.id) ? agents.find(a => a.id === win.id) : undefined
}

/** The plate header's name and spec line: an agent shows `name · role` over its cli and model; a panel just its title. */
export function windowHeading(win: WindowState, agents: AgentState[]): { title: string; spec?: PlateSpec[] } {
  const agent = windowAgent(win, agents)
  if (!agent) return { title: win.title }
  return { title: `${agent.name} · ${agent.role}`, spec: [{ text: agent.cli }, { text: agent.model, mono: true }].filter(p => !!p.text) as PlateSpec[] }
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
    return <Suspense fallback={<Loading />}><FilePanel /></Suspense>
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
  return <TerminalWindow agentId={win.id} agentName={agent?.name ?? ''} theme={agent?.theme} />
}
