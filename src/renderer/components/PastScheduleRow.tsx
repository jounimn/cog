import React from 'react'
import type { ScheduledPrompt } from '../../shared/types'
import { Button, Icon } from '../ui'
import { scheduleIntervalLabel, scheduleStatusPresentation } from '../panel-present'

interface Props {
  schedule: ScheduledPrompt
  agentName: string
  tabName: string
  onRestart: () => void
  onEdit: () => void
  onDelete: () => void
}

export function PastScheduleRow({ schedule, agentName, tabName, onRestart, onEdit, onDelete }: Props): React.ReactElement {
  // Expired or stopped, as before: anything that is not 'expired' reads as stopped.
  const st = scheduleStatusPresentation(schedule.status === 'expired' ? 'expired' : 'stopped')
  const intervalDisplay = scheduleIntervalLabel(schedule.intervalMinutes)

  return (
    <article className="cog-sched cog-sched--past">
      <div className="cog-sched__head">
        <span className="cog-sched__icon"><Icon name="calendar-clock" size={15} /></span>
        <span className="cog-sched__name" title={schedule.name}>{schedule.name}</span>
        <div className="cog-sched__actions">
          <Button variant="icon" onClick={onRestart} title="Restart" aria-label="Restart"><Icon name="play" size={14} /></Button>
          <Button variant="icon" onClick={onEdit} title="Edit" aria-label="Edit"><Icon name="pencil" size={14} /></Button>
          <Button variant="icon" className="cog-tone-danger" onClick={onDelete} title="Delete" aria-label="Delete">
            <Icon name="trash" size={14} />
          </Button>
        </div>
      </div>

      <span className="cog-sched__line">
        <span className={`cog-sched__state cog-tone-${st.tone}`}><Icon name={st.icon} size={12} />{st.word}</span>
        {' · '}To {agentName} ({tabName})
      </span>

      <span className="cog-sched__line">
        Every <span className="cog-mono">{intervalDisplay}</span> · {schedule.durationHours === null
          ? 'was infinite'
          : <>ran <span className="cog-mono">{schedule.durationHours}h</span></>}
      </span>
    </article>
  )
}
