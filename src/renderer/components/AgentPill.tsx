import React from 'react'
import type { AgentState } from '../../shared/types'
import { c, font } from '../ui'

const STATUS_COLORS: Record<string, string> = {
  idle: c('ink-subtle'),
  active: c('success'),
  working: c('working'),
  disconnected: c('danger')
}

interface AgentPillProps {
  agent: AgentState
  onClick: () => void
  groupColor?: string
  onLinkDragStart?: (e: React.MouseEvent) => void
  isLinkTarget?: boolean  // highlight when another pill is being dragged over
}

export function AgentPill({ agent, onClick, groupColor, onLinkDragStart, isLinkTarget }: AgentPillProps): React.ReactElement {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
      data-agent-name={agent.name}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          backgroundColor: isLinkTarget ? c('surface-muted') : c('surface'),
          border: isLinkTarget ? `1px solid ${c('steel')}` : groupColor ? `1px solid ${groupColor}` : `1px solid ${c('line-strong')}`,
          borderRadius: '16px',
          color: c('ink-muted'),
          cursor: 'pointer',
          fontSize: '12px',
          fontFamily: font.text,
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
      >
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: STATUS_COLORS[agent.status] ?? c('ink-subtle')
        }} />
        {agent.name}
        <span style={{ color: c('ink-subtle'), fontSize: '11px' }}>{agent.role}</span>
      </button>
      {onLinkDragStart && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onLinkDragStart(e) }}
          title="Drag to another agent to create a link"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: groupColor || c('ink-subtle'),
            border: `2px solid ${c('line-strong')}`,
            cursor: 'crosshair',
            flexShrink: 0,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.4)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        />
      )}
    </div>
  )
}
