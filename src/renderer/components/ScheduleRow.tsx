import React, { useState } from 'react'
import type { ScheduledPrompt } from '../../shared/types'
import { Button, Icon } from '../ui'
import {
  scheduleIntervalLabel, hoursMinutes, clockTime, scheduleStatusPresentation, fireOutcomePresentation
} from '../panel-present'

interface Props {
  schedule: ScheduledPrompt
  agentName: string
  tabName: string
  now: number
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function ScheduleRow({ schedule, agentName, tabName, now, onPause, onResume, onStop }: Props): React.ReactElement {
  const [showHistory, setShowHistory] = useState(false)

  const isPaused = schedule.status === 'paused'
  const timeLeft = schedule.expiresAt === null
    ? null
    : Math.max(0, schedule.expiresAt - now)
  const timeToNext = Math.max(0, schedule.nextFireAt - now)

  const intervalDisplay = scheduleIntervalLabel(schedule.intervalMinutes)
  const st = scheduleStatusPresentation(schedule.status)
  const byAgent = schedule.createdBy && schedule.createdBy !== 'user'

  return (
    <article className="cog-sched">
      <div className="cog-sched__head">
        <span className="cog-sched__icon"><Icon name="calendar-clock" size={15} /></span>
        <span className="cog-sched__name" title={schedule.name}>{schedule.name}</span>
        {byAgent
          ? <span className="cog-sched__by" title={`Created by ${schedule.createdBy}`}>
              <Icon name="bot" size={12} /><span>{schedule.createdBy}</span>
            </span>
          : <span className="cog-sched__by" title="Created by you"><Icon name="user" size={12} /><span>you</span></span>}
        <div className="cog-sched__actions">
          {isPaused ? (
            <Button variant="icon" onClick={onResume} title="Resume" aria-label="Resume"><Icon name="play" size={14} /></Button>
          ) : (
            <Button variant="icon" onClick={onPause} title="Pause" aria-label="Pause"><Icon name="pause" size={14} /></Button>
          )}
          <Button variant="icon" onClick={onStop} title="Stop" aria-label="Stop"><Icon name="square" size={13} /></Button>
        </div>
      </div>

      <span className="cog-sched__line">
        <span className={`cog-sched__state cog-tone-${st.tone}`}><Icon name={st.icon} size={12} />{st.word}</span>
        {' · '}To {agentName} ({tabName})
      </span>

      <span className="cog-sched__line">
        Every <span className="cog-mono">{intervalDisplay}</span> · {timeLeft === null
          ? 'runs until stopped'
          : <><span className="cog-mono">{hoursMinutes(timeLeft)}</span> left</>}
      </span>

      {!isPaused && (
        <span className="cog-sched__line">
          Next <span className="cog-mono">{clockTime(schedule.nextFireAt)}</span> (in <span className="cog-mono">{hoursMinutes(timeToNext)}</span>)
        </span>
      )}

      <button
        type="button"
        className="cog-disclosure cog-disclosure--inline"
        onClick={() => setShowHistory(v => !v)}
        aria-expanded={showHistory}
      >
        <Icon name={showHistory ? 'chevron-down' : 'chevron-right'} size={12} />
        History <span className="cog-disclosure__count">{schedule.fireHistory.length}</span>
      </button>

      {showHistory && schedule.fireHistory.length > 0 && (
        <ul className="cog-sched__history">
          {[...schedule.fireHistory].reverse().map((entry, i) => {
            const o = fireOutcomePresentation(entry.outcome)
            return (
              <li key={i}>
                <span className="cog-mono">{clockTime(entry.timestamp)}</span>
                <span className={`cog-tone-${o.tone}`}><Icon name={o.icon} size={12} />{o.word}</span>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
