import type { WindowState } from '../hooks/useWindowManager'
import type { AgentState } from '../../shared/types'
import type { IconName } from '../ui'
import { getPanelType } from '../panel-ids'
import type { PlateSpec } from './PlateHeader'

export function windowAgent(win: WindowState, agents: AgentState[]): AgentState | undefined {
  return !getPanelType(win.id) ? agents.find(a => a.id === win.id) : undefined
}

export interface WindowHeading {
  title: string
  spec?: PlateSpec[]
  /** Lucide icon shown before the title (the Sketchpad's book). */
  icon?: IconName
}

/** The plate header's name and spec line: an agent shows `name · role` over its cli and model; a panel just its title. */
export function windowHeading(win: WindowState, agents: AgentState[]): WindowHeading {
  const agent = windowAgent(win, agents)
  if (!agent) return getPanelType(win.id) === 'board' ? { title: win.title, icon: 'book-open' } : { title: win.title }
  return { title: `${agent.name} · ${agent.role}`, spec: [{ text: agent.cli }, { text: agent.model, mono: true }].filter(p => !!p.text) as PlateSpec[] }
}
