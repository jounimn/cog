import type { AgentStatus } from '../shared/types'

export interface CardPresentation {
  opacity: number
  titlePrefix: string
  menu: Array<'sleep' | 'wake'>
}

export function cardPresentation(status: AgentStatus): CardPresentation {
  if (status === 'sleeping') return { opacity: 0.5, titlePrefix: '🌙 ', menu: ['wake'] }
  if (status === 'waking') return { opacity: 0.5, titlePrefix: '⏳ ', menu: [] }
  return { opacity: 1, titlePrefix: '', menu: ['sleep'] }
}
