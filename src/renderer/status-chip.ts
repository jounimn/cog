import type { AgentStatus } from '../shared/types'
import type { IconName } from './ui/Icon'

export interface StatusPresentation {
  label: string
  icon: IconName
  tone: 'working' | 'muted' | 'danger'
  breathing: boolean
}

const WORKING: StatusPresentation = { label: 'working', icon: 'activity', tone: 'working', breathing: true }

const TABLE: Record<AgentStatus, StatusPresentation> = {
  working: WORKING,
  active: WORKING,
  idle: { label: 'idle', icon: 'circle-dot', tone: 'muted', breathing: false },
  sleeping: { label: 'sleeping', icon: 'moon', tone: 'muted', breathing: false },
  waking: { label: 'waking', icon: 'loader', tone: 'muted', breathing: false },
  disconnected: { label: 'disconnected', icon: 'unplug', tone: 'danger', breathing: false }
}

/** How an agent status is shown: always an icon plus a word, never colour alone. */
export function statusPresentation(s: AgentStatus): StatusPresentation {
  return { ...TABLE[s] }
}
