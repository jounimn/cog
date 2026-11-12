import React from 'react'
import { c } from '../ui/tokens'
import { crosshairPoints, visibleRange } from '../ruler'

const MINOR = 24
const MAJOR = 120
const CROSS = 17

interface CanvasGroundProps {
  zoom: number
  pan: { x: number; y: number }
  width: number
  height: number
}

const fill: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' }

/** Drafting-board ground: masked grid plus registration crosshairs at major intersections. */
export const CanvasGround = React.memo(function CanvasGround({ zoom, pan, width, height }: CanvasGroundProps) {
  const major = MAJOR * zoom
  const minor = MINOR * zoom
  const line = (dir: 'right' | 'bottom', alpha: number) =>
    `linear-gradient(to ${dir}, ${c('grid', alpha)} 1px, transparent 1px)`

  const range = visibleRange(zoom, pan, width, height)
  const marks = crosshairPoints(range).map(p => ({ x: p.x * zoom + pan.x, y: p.y * zoom + pan.y }))

  const mask = 'radial-gradient(ellipse 75% 70% at 46% 44%, black 35%, transparent 100%)'

  return (
    <div aria-hidden="true" style={fill}>
      <div
        style={{
          ...fill,
          backgroundImage: [
            line('right', 0.06), line('bottom', 0.06), line('right', 0.025), line('bottom', 0.025)
          ].join(', '),
          backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          WebkitMaskImage: mask,
          maskImage: mask
        }}
      />
      {marks.map(m => (
        <svg
          key={`${m.x},${m.y}`}
          width={CROSS}
          height={CROSS}
          viewBox="0 0 17 17"
          style={{
            position: 'absolute',
            left: m.x - 8,
            top: m.y - 8,
            opacity: 0.45,
            fill: 'none',
            stroke: c('line-strong'),
            strokeWidth: 1
          }}
        >
          <circle cx="8.5" cy="8.5" r="4" />
          <path d="M8.5 0v17M0 8.5h17" />
        </svg>
      ))}
    </div>
  )
})
