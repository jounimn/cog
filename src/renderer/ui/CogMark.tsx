import React from 'react'

// Cogsworth, redrawn once from build/icon.png: an eight-tooth gear with a round face
// cut through the body (so the bar shows behind it), two eyes and a smile.
// Proportions follow the PNG: outer 11, body 8.6, face 5 (24 grid); teeth taper outward.
const TEETH = [0, 45, 90, 135, 180, 225, 270, 315]
const TOOTH = 'M9.7 4.2 10.1 1h3.8l.4 3.2Z'
const BODY_WITH_FACE =
  'M12 3.4a8.6 8.6 0 1 0 0 17.2a8.6 8.6 0 1 0 0-17.2Z' +
  'M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z'

export function CogMark({ size = 20, title }: { size?: number; title?: string }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {TEETH.map((deg) => (
        <path key={deg} d={TOOTH} transform={deg ? `rotate(${deg} 12 12)` : undefined} />
      ))}
      <path d={BODY_WITH_FACE} fillRule="evenodd" />
      <circle cx="10.4" cy="10.9" r="0.8" />
      <circle cx="13.6" cy="10.9" r="0.8" />
      <path d="M10.3 13.5q1.7 1.5 3.4 0" fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  )
}
