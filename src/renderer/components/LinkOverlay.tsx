import React, { useEffect, useRef, useState } from 'react'
import type { WindowState } from '../hooks/useWindowManager'
import { Icon } from '../ui/Icon'
import { c, font } from '../ui/tokens'
import { motionStore } from '../appearance-store'
import { linkKey, linkKeyForMessage } from '../link-message'
import { PORT, arrowPoints, chipLinkIndexes, routeD, routeLength, routePoints } from '../link-route'

interface LinkOverlayProps {
  links: Array<{ from: string; to: string }>
  groups: Array<{ id: string; name?: string; color: string; members: string[] }>
  windows: WindowState[]
  agents: Array<{ id: string; name: string; tabId?: string }>
  activeTabId?: string
  zoom: number
  pan: { x: number; y: number }
  drawing: boolean
  drawFrom: { x: number; y: number } | null
  drawTo: { x: number; y: number } | null
  onRemoveLink?: (from: string, to: string) => void
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const FLIGHT_MS = 900
const CHIP_H = 22
const SWATCH = 6

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** The in-flight message: a short hint-coloured dash travelling along the trace. */
function MessageDash({ d, reversed }: { d: string; reversed: boolean }): React.ReactElement {
  return (
    <path
      data-anim
      d={d}
      pathLength={1000}
      fill="none"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        stroke: c('hint'),
        strokeDasharray: '18 100000',
        pointerEvents: 'none',
        animation: `link-dash ${FLIGHT_MS}ms var(--ease-out) forwards`,
        animationDirection: reversed ? 'reverse' : 'normal'
      }}
    />
  )
}

export function LinkOverlay({
  links, groups, windows, agents, activeTabId = '', zoom, pan,
  drawing, drawFrom, drawTo, onRemoveLink
}: LinkOverlayProps): React.ReactElement {
  const [hoveredLink, setHoveredLink] = useState<number | null>(null)
  // Links with a message in flight: key -> run counter (a new message restarts the dash)
  const [flights, setFlights] = useState<Record<string, { runs: number; reversed: boolean }>>({})
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const latest = useRef({ links, agents, activeTabId })
  latest.current = { links, agents, activeTabId }

  useEffect(() => {
    const pending = timers.current
    const off = window.electronAPI.onHubMessageDelivered(evt => {
      const cur = latest.current
      const hit = linkKeyForMessage(evt, cur.links, cur.agents, cur.activeTabId)
      if (!hit) return
      const { key, reversed } = hit
      setFlights(f => ({ ...f, [key]: { runs: (f[key]?.runs ?? 0) + 1, reversed } }))
      const prev = pending.get(key)
      if (prev) clearTimeout(prev)
      pending.set(key, setTimeout(() => {
        pending.delete(key)
        setFlights(f => {
          const rest = { ...f }
          delete rest[key]
          return rest
        })
      }, FLIGHT_MS))
    })
    return () => {
      off()
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  const getWindowRect = (agentName: string): Rect | null => {
    const agent = agents.find(a => a.name === agentName)
    if (!agent) return null
    const win = windows.find(w => w.id === agent.id)
    if (!win) return null
    return { x: win.x, y: win.y, w: win.width, h: win.height }
  }

  const getRightPort = (agentName: string): { x: number; y: number } | null => {
    const rect = getWindowRect(agentName)
    if (!rect) return null
    return { x: rect.x + rect.w, y: rect.y + rect.h / 2 }
  }

  const getLeftPort = (agentName: string): { x: number; y: number } | null => {
    const rect = getWindowRect(agentName)
    if (!rect) return null
    return { x: rect.x, y: rect.y + rect.h / 2 }
  }


  const getGroup = (from: string, to: string) =>
    groups.find(g => g.members.includes(from) && g.members.includes(to))

  const reduced = prefersReducedMotion() || motionStore.get()

  // Route every drawable link once; both layers and the one-chip-per-group rule read from this.
  const routed = links.map((link, i) => {
    const fromPos = getRightPort(link.from)
    const toPos = getLeftPort(link.to)
    if (!fromPos || !toPos) return null
    const points = routePoints(fromPos, toPos, i)
    const key = linkKey(link, agents)
    return {
      link, i, fromPos, toPos, points,
      d: routeD(points),
      group: getGroup(link.from, link.to),
      flight: key ? flights[key] : undefined
    }
  })
  const drawn = routed.filter((r): r is NonNullable<typeof r> => r !== null)
  const chipLinks = chipLinkIndexes(
    drawn.map(r => (r.group?.name?.trim() ? r.group.id : undefined)),
    drawn.map(r => routeLength(r.points))
  )

  const layer = (zIndex: number): React.CSSProperties => ({
    position: 'absolute', top: 0, left: 0, width: '10000px', height: '10000px',
    pointerEvents: 'none', zIndex, overflow: 'visible'
  })

  return (
    <>
      {/* Lower layer, under the plates: hitboxes, traces and the message dash. */}
      <svg style={layer(0)}>
        {drawn.map(({ link, i, d, flight }) => {
          const isHovered = hoveredLink === i
          const inFlight = flight !== undefined
          return (
            <g key={`${link.from}-${link.to}-${i}`}>
              {/* Invisible fat hitbox (reachable where the trace is visible, between plates) */}
              <path
                d={d}
                stroke="transparent"
                strokeWidth={14}
                fill="none"
                strokeLinejoin="round"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredLink(i)}
                onMouseLeave={() => setHoveredLink(null)}
              />
              {/* Visible orthogonal trace: always steel */}
              <path
                d={d}
                stroke={c('steel')}
                strokeWidth={isHovered ? 2.5 : 1.5}
                fill="none"
                opacity={isHovered ? 1 : 0.85}
                className={inFlight && prefersReducedMotion() && !motionStore.get() ? 'link-flash' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ pointerEvents: 'none', transition: 'stroke-width var(--dur) var(--ease-out), opacity var(--dur) var(--ease-out)' }}
              />
              {inFlight && !reduced && <MessageDash key={flight.runs} d={d} reversed={flight.reversed} />}
            </g>
          )
        })}
      </svg>

      {/* Upper layer, over the plates: ports, arrowheads, chips, delete badge, drag preview. */}
      <svg style={layer(9999)}>
        {drawn.map(({ link, i, fromPos, toPos, points, group, flight }) => {
          const isHovered = hoveredLink === i
          const inFlight = flight !== undefined
          const chipName = chipLinks.has(i) ? group?.name?.trim() : undefined

          // Midpoint for the chip and delete badge (approximate — average of from/to)
          const midX = (fromPos.x + toPos.x) / 2
          const midY = (fromPos.y + toPos.y) / 2
          const chipW = chipName ? Math.round(chipName.length * 6.4) + 7 + SWATCH + 5 + 12 + 5 + 7 : 0

          return (
            <g key={`${link.from}-${link.to}-${i}`}>
              {/* Arrowhead: tip on the target port's outer edge */}
              <polygon points={arrowPoints(points)} fill={c('steel')} style={{ pointerEvents: 'none' }} />
              {/* Ports where the trace meets each plate edge */}
              {[fromPos, toPos].map((p, n) => (
                <rect
                  key={n}
                  x={p.x - PORT / 2} y={p.y - PORT / 2} width={PORT} height={PORT}
                  fill={c('surface')} stroke={c('steel')} strokeWidth={1.5}
                  style={{ pointerEvents: 'none' }}
                />
              ))}
              {/* Group chip: one per group, on its longest link; the swatch keeps groups apart */}
              {chipName && group && !(isHovered && onRemoveLink) && (
                <g transform={`translate(${midX - chipW / 2} ${midY - CHIP_H / 2})`} style={{ pointerEvents: 'none' }}>
                  <rect
                    width={chipW} height={CHIP_H} rx={2}
                    fill={c('canvas')}
                    stroke={inFlight && reduced ? c('hint') : c('steel', 0.7)}
                    strokeWidth={1} strokeDasharray="3 2"
                  />
                  <rect x={7} y={(CHIP_H - SWATCH) / 2} width={SWATCH} height={SWATCH} fill={group.color} />
                  <svg x={7 + SWATCH + 5} y={(CHIP_H - 12) / 2} width={12} height={12} style={{ color: c('ink-muted') }}>
                    <Icon name="link" size={12} />
                  </svg>
                  <text
                    x={7 + SWATCH + 5 + 12 + 5} y={CHIP_H / 2 + 0.5} dominantBaseline="middle"
                    fontSize={11} fill={c('ink-muted')} style={{ fontFamily: font.text }}
                  >
                    {chipName}
                  </text>
                </g>
              )}
              {/* Delete badge at midpoint */}
              {isHovered && onRemoveLink && (
                <>
                  <circle
                    cx={midX} cy={midY} r={9}
                    fill={c('danger', 0.15)} stroke={c('danger')} strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={() => onRemoveLink(link.from, link.to)}
                    onMouseEnter={() => setHoveredLink(i)}
                  />
                  <text
                    x={midX} y={midY + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fill={c('danger')} fontWeight="bold"
                    style={{ pointerEvents: 'none', fontFamily: font.text }}
                  >
                    x
                  </text>
                </>
              )}
            </g>
          )
        })}
        {/* Drawing preview — orthogonal too */}
        {drawing && drawFrom && drawTo && (
          <path
            d={`M ${drawFrom.x} ${drawFrom.y} H ${(drawFrom.x + drawTo.x) / 2} V ${drawTo.y} H ${drawTo.x}`}
            stroke={c('focus')} strokeWidth={2} strokeDasharray="5,5"
            fill="none" strokeLinejoin="round"
          />
        )}
      </svg>
    </>
  )
}
