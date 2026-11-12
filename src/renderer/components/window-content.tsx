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
import { windowAgent } from './window-heading'
import { Loading } from '../ui'

export { windowAgent, windowHeading, type WindowHeading } from './window-heading'

// Monaco is ~10 MB: keep it out of the main chunk until a Files panel opens.
const FilePanel = lazy(() => import('./FilePanel').then(m => ({ default: m.FilePanel })))

export interface WindowContentContext {
  agents: AgentState[]
  tabs: WorkspaceTab[]
  activeTabId?: string
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
