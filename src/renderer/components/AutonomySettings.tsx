import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Icon, Select } from '../ui'

interface Props { projectName: string | null }

const DURATIONS = [
  { label: '2h', hours: 2 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
]

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMin = Math.ceil(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function AutonomySettings({ projectName }: Props) {
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [durationHours, setDurationHours] = useState(6)
  const [now, setNow] = useState(() => Date.now())
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!projectName) return
    setLoaded(false)
    window.electronAPI.getAutonomy().then(a => { setExpiresAt(a.sessionExpiresAt); setLoaded(true) })
    const off = window.electronAPI.onAutonomyChanged(a => setExpiresAt(a.sessionExpiresAt))
    return () => off()
  }, [projectName])

  const active = expiresAt !== null && now < expiresAt

  useEffect(() => {
    if (!active) {
      if (tick.current) { clearInterval(tick.current); tick.current = null }
      return
    }
    tick.current = setInterval(() => setNow(Date.now()), 1000)
    return () => { if (tick.current) clearInterval(tick.current) }
  }, [active])

  const start = async () => {
    const a = await window.electronAPI.startAutonomySession(durationHours)
    setExpiresAt(a.sessionExpiresAt); setNow(Date.now())
  }
  const end = async () => {
    const a = await window.electronAPI.endAutonomySession()
    setExpiresAt(a.sessionExpiresAt)
  }

  return (
    <div className="cog-autonomy">
      <h3 className="cog-autonomy__title">
        Agent autonomy{projectName ? <span className="cog-autonomy__project">{' — '}{projectName}</span> : ''}
      </h3>
      {!projectName ? (
        <p className="cog-autonomy__empty">Open a project to configure autonomy.</p>
      ) : (
        <div className={active ? 'cog-autonomy__card cog-autonomy__card--active' : 'cog-autonomy__card'}>
          <div className="cog-autonomy__head">
            <span className={active ? 'cog-autonomy__warn cog-tone-warning' : 'cog-autonomy__warn'}>
              <Icon name="triangle-alert" size={14} />
            </span>
            <Checkbox
              checked={active}
              disabled={!loaded}
              onChange={() => { if (loaded) (active ? end : start)() }}
            >Autonomous session</Checkbox>
          </div>

          {active ? (
            <div className="cog-autonomy__row">
              <span className="cog-autonomy__left cog-tone-warning">{formatRemaining(expiresAt! - now)} left</span>
              <Button variant="ghost" className="cog-tone-danger" onClick={end}>End now</Button>
            </div>
          ) : (
            <div className="cog-autonomy__row cog-autonomy__row--start">
              <span className="cog-autonomy__label">Duration</span>
              <Select
                value={String(durationHours)}
                options={DURATIONS.map(d => ({ value: String(d.hours), label: d.label }))}
                onChange={v => setDurationHours(Number(v))}
                ariaLabel="Duration"
              />
            </div>
          )}

          <p className="cog-autonomy__note">
            While active, agents self-schedule prompts, spawn agents/teams, and close idle agents <strong>without approval</strong>. Every spawn/close posts to your inbox as urgent.
          </p>
        </div>
      )}
    </div>
  )
}
