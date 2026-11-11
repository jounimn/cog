import React from 'react'
import type { SnapBounds } from '../hooks/useSnapZones'
import { c } from '../ui'

interface SnapPreviewProps {
  bounds: SnapBounds | null
}

export function SnapPreview({ bounds }: SnapPreviewProps): React.ReactElement | null {
  if (!bounds) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        background: c('steel', 0.18),
        border: `1px solid ${c('steel', 0.75)}`,
        boxShadow: `inset 0 0 0 1px ${c('focus', 0.35)}`,
        pointerEvents: 'none',
        zIndex: 99997
      }}
    />
  )
}
