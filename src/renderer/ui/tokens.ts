export type Token =
  | 'canvas' | 'surface' | 'surface-muted' | 'surface-sunk'
  | 'line' | 'line-strong' | 'grid' | 'steel'
  | 'ink' | 'ink-muted' | 'ink-subtle'
  | 'hint' | 'hint-hover' | 'on-hint'
  | 'focus'
  | 'working' | 'warning' | 'danger' | 'success'

/** CSS colour for a token, optionally with alpha. */
export function c(token: Token, alpha?: number): string {
  return alpha === undefined ? `rgb(var(--${token}))` : `rgb(var(--${token}) / ${alpha})`
}

export const font = {
  text: 'var(--font-text)',
  mono: 'var(--font-mono)',
  instrument: 'var(--font-instrument)'
} as const
