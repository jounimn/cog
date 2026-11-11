import React, { useEffect, useRef, useState } from 'react'
import type { WindowState } from '../hooks/useWindowManager'
import { Icon } from '../ui/Icon'
import { c, font } from '../ui/tokens'
import { motionStore } from '../appearance-store'
import { linkKey, linkKeyForMessage } from '../link-message'

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

const MARGIN = 30 // spacing between lines and windows

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Build an orthogonal (90-degree only) path from A to B that routes around windows
function buildOrthogonalPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  windows: Rect[],
  linkIndex: number
): string {
  // Exit right from source, enter left on target
  const exitX = from.x + MARGIN
  const enterX = to.x - MARGIN

  // Offset parallel lines so they don't overlap when multiple links exist
  const offset = (linkIndex % 5) * 8 - 16

  if (exitX < enterX) {
    // Simple case: target is to the right
    // Route: right → down/up → right → arrive
    const midX = (exitX + enterX) / 2 + offset
    return [
      `M ${from.x} ${from.y}`,
      `H ${midX}`,           // go right to midpoint
      `V ${to.y}`,           // go up/down to target height
      `H ${to.x}`,           // go right to target
    ].join(' ')
  } else {
    // Target is to the left or overlapping — route around
    // Go right, then up/down to clear both windows, then left, then down to target
    const clearY = Math.min(from.y, to.y) - 60 - Math.abs(offset)

    // If both are at similar height, route below instead
    const routeBelow = Math.abs(from.y - to.y) < 80
    const bypassY = routeBelow
      ? Math.max(from.y, to.y) + 80 + Math.abs(offset)
      : clearY

    return [
      `M ${from.x} ${from.y}`,
      `H ${exitX}`,           // exit right
      `V ${bypassY}`,         // go up/down to clear
      `H ${enterX}`,          // go left to target column
      `V ${to.y}`,            // go down/up to target height
      `H ${to.x}`,            // enter target
    ].join(' ')
  }
}

const FLIGHT_MS = 900
const PORT = 6
const CHIP_H = 18

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** The in-flight message: a short hint-coloured dash travelling along the trace. */
function MessageDash({ d }: { d: string }): React.ReactElement {
  const ref = useRef<SVGPathElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.style.setProperty('--len', String(el.getTotalLength()))
  }, [d])
  return (
    <path
      ref={ref}
      data-anim
      d={d}
      fill="none"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        stroke: c('hint'),
        strokeDasharray: '18 2000',
        pointerEvents: 'none',
        animation: `link-dash ${FLIGHT_MS}ms var(--ease-out) forwards`
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
  const [flights, setFlights] = useState<Record<string, number>>({})
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const latest = useRef({ links, agents, activeTabId })
  latest.current = { links, agents, activeTabId }

  useEffect(() => {
    const pending = timers.current
    const off = window.electronAPI.onHubMessageDelivered(evt => {
      const cur = latest.current
      const key = linkKeyForMessage(evt, cur.links, cur.agents, cur.activeTabId)
      if (!key) return
      setFlights(f => ({ ...f, [key]: (f[key] ?? 0) + 1 }))
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

  // Collect all window rects for obstacle avoidance
  const allRects: Rect[] = windows.map(w => ({ x: w.x, y: w.y, w: w.width, h: w.height }))
  const reduced = prefersReducedMotion() || motionStore.get()

  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: '10000px', height: '10000px',
      pointerEvents: 'none', zIndex: 9999, overflow: 'visible'
    }}>
      {links.map((link, i) => {
        const fromPos = getRightPort(link.from)
        const toPos = getLeftPort(link.to)
        if (!fromPos || !toPos) return null

        const group = getGroup(link.from, link.to)
        const color = group?.color ?? c('steel')
        const pathD = buildOrthogonalPath(fromPos, toPos, allRects, i)
        const isHovered = hoveredLink === i
        const key = linkKey(link, agents)
        const runs = key ? flights[key] : undefined
        const inFlight = runs !== undefined
        const chipName = group?.name?.trim()

        // Midpoint for delete button (approximate — use average of from/to)
        const midX = (fromPos.x + toPos.x) / 2
        const midY = (fromPos.y + toPos.y) / 2
        const chipW = chipName ? Math.round(chipName.length * 6.4) + 34 : 0
        const markerId = `link-arrow-${i}`

        return (
          <g key={`${link.from}-${link.to}-${i}`}>
            <defs>
              <marker
                id={markerId} viewBox="0 0 10 10" refX={9} refY={5}
                markerWidth={8} markerHeight={8} orient="auto" markerUnits="userSpaceOnUse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill={color} />
              </marker>
            </defs>
            {/* Invisible fat hitbox */}
            <path
              d={pathD}
              stroke="transparent"
              strokeWidth={14}
              fill="none"
              strokeLinejoin="round"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredLink(i)}
              onMouseLeave={() => setHoveredLink(null)}
            />
            {/* Visible orthogonal trace */}
            <path
              d={pathD}
              stroke={color}
              strokeWidth={isHovered ? 2.5 : 1.5}
              fill="none"
              opacity={isHovered ? 1 : 0.85}
              strokeLinejoin="round"
              strokeLinecap="round"
              markerEnd={`url(#${markerId})`}
              style={{ pointerEvents: 'none', transition: 'stroke-width var(--dur), opacity var(--dur)' }}
            />
            {/* Ports where the trace meets each plate edge */}
            {[fromPos, toPos].map((p, n) => (
              <rect
                key={n}
                x={p.x - PORT / 2} y={p.y - PORT / 2} width={PORT} height={PORT}
                fill={c('surface')} stroke={color} strokeWidth={1.5}
                style={{ pointerEvents: 'none' }}
              />
            ))}
            {/* Message in flight */}
            {inFlight && !reduced && <MessageDash key={runs} d={pathD} />}
            {/* Group chip at the midpoint, only for named groups */}
            {chipName && !(isHovered && onRemoveLink) && (
              <g transform={`translate(${midX - chipW / 2} ${midY - CHIP_H / 2})`} style={{ pointerEvents: 'none' }}>
                <rect
                  width={chipW} height={CHIP_H} rx={3}
                  fill={c('surface')}
                  stroke={inFlight && reduced ? c('hint') : c('line-strong')}
                  strokeWidth={1} strokeDasharray="3 2"
                />
                <svg x={6} y={(CHIP_H - 10) / 2} width={10} height={10} style={{ color: c('ink-muted') }}>
                  <Icon name="link" size={10} />
                </svg>
                <text
                  x={22} y={CHIP_H / 2 + 0.5} dominantBaseline="middle"
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
  )
}
