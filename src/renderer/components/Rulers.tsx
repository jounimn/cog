import React from 'react'
import { c, font } from '../ui/tokens'
import { rulerStep, rulerTicks } from '../ruler'

const RULER_X_HEIGHT = 20
const RULER_Y_WIDTH = 28
const MINOR_DIVISIONS = 5

interface RulersProps {
  zoom: number
  pan: { x: number; y: number }
  width: number
  height: number
}

const label = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n))

const numStyle: React.CSSProperties = {
  position: 'absolute',
  font: `500 11px/1 ${font.mono}`,
  fontVariantNumeric: 'tabular-nums',
  color: c('ink-subtle', 0.62),
  whiteSpace: 'nowrap'
}

/** Transparent top and left rulers showing true canvas coordinates; never intercept the pointer. */
export const Rulers = React.memo(function Rulers({ zoom, pan, width, height }: RulersProps) {
  const major = rulerStep(zoom) * zoom
  const minor = major / MINOR_DIVISIONS
  const xTicks = rulerTicks(zoom, pan.x, width).filter(t => t.px >= RULER_Y_WIDTH + 4)
  const yTicks = rulerTicks(zoom, pan.y, height).filter(t => t.px >= RULER_X_HEIGHT + 4)
  const tick = (dir: 'right' | 'bottom', color: string) =>
    `linear-gradient(to ${dir}, ${color} 1px, transparent 1px)`
  const edge = `1px solid ${c('line')}`

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      <div
        style={{
          position: 'absolute', left: RULER_Y_WIDTH, right: 0, top: 0, height: RULER_X_HEIGHT,
          borderBottom: edge,
          backgroundImage: `${tick('right', c('ink-subtle', 0.28))}, ${tick('right', c('line'))}`,
          backgroundSize: `${major}px 9px, ${minor}px 4px`,
          backgroundPosition: `${pan.x - RULER_Y_WIDTH}px 100%, ${pan.x - RULER_Y_WIDTH}px 100%`,
          backgroundRepeat: 'repeat-x',
          overflow: 'hidden'
        }}
      >
        {xTicks.map(t => (
          <span key={t.coord} style={{ ...numStyle, left: t.px - RULER_Y_WIDTH, top: 3, paddingLeft: 3 }}>
            {label(t.coord)}
          </span>
        ))}
      </div>
      <div
        style={{
          position: 'absolute', top: RULER_X_HEIGHT, bottom: 0, left: 0, width: RULER_Y_WIDTH,
          borderRight: edge,
          backgroundImage: `${tick('bottom', c('ink-subtle', 0.28))}, ${tick('bottom', c('line'))}`,
          backgroundSize: `9px ${major}px, 4px ${minor}px`,
          backgroundPosition: `100% ${pan.y - RULER_X_HEIGHT}px, 100% ${pan.y - RULER_X_HEIGHT}px`,
          backgroundRepeat: 'repeat-y',
          overflow: 'hidden'
        }}
      >
        {yTicks.map(t => (
          <span
            key={t.coord}
            style={{
              ...numStyle, left: 2, top: t.px - RULER_X_HEIGHT, paddingLeft: 3,
              transform: 'rotate(-90deg) translateX(-100%)', transformOrigin: '0 0'
            }}
          >
            {label(t.coord)}
          </span>
        ))}
      </div>
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: RULER_Y_WIDTH, height: RULER_X_HEIGHT,
          boxSizing: 'border-box', borderRight: edge, borderBottom: edge, opacity: 0.7,
          display: 'grid', placeItems: 'center', font: `500 9px/1 ${font.mono}`, color: c('ink-subtle')
        }}
      >
        px
      </div>
    </div>
  )
})
