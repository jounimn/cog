import React, { useRef, useState, useSyncExternalStore } from 'react'
import { appearanceStore, motionStore, useAppearance } from '../appearance-store'
import { FONTS, PALETTES } from '../terminal-appearance'
import type { Appearance, FontId } from '../terminal-appearance'
import { Button, Icon, Segmented, Select, Stepper } from '../ui'

export interface AppearanceDrawerProps {
  open: boolean
  onClose: () => void
  focusedAgent?: { name: string }
}

type Scope = 'all' | 'one'

const COLUMNS = 3

export function AppearanceDrawer({ open, onClose, focusedAgent }: AppearanceDrawerProps): React.ReactElement | null {
  const settings = useAppearance()
  const paused = useSyncExternalStore(motionStore.subscribe, motionStore.get)
  const [scope, setScope] = useState<Scope>('all')
  const radios = useRef<(HTMLButtonElement | null)[]>([])

  if (!open) return null

  const name = focusedAgent?.name
  // The "this terminal" scope only exists while an agent is focused.
  const target = scope === 'one' ? name : undefined
  const own = target !== undefined ? settings.perAgent[target] ?? {} : {}
  const eff: Appearance = { ...settings.global, ...own }

  const update = (p: Partial<Appearance>): void => {
    if (target !== undefined) appearanceStore.setAgent(target, p)
    else appearanceStore.setGlobal(p)
  }

  const onPaletteKey = (e: React.KeyboardEvent, index: number): void => {
    const last = PALETTES.length - 1
    let next = -1
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (e.key === 'ArrowDown') next = Math.min(last, index + COLUMNS)
    else if (e.key === 'ArrowUp') next = Math.max(0, index - COLUMNS)
    if (next < 0) return
    e.preventDefault()
    update({ palette: PALETTES[next].id })
    radios.current[next]?.focus()
  }

  return (
    <aside
      id="appearance-drawer"
      className="cog-drawer"
      aria-labelledby="appearance-drawer-title"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}
    >
      <div className="cog-drawer__head">
        <Icon name="palette" size={16} />
        <h2 id="appearance-drawer-title">Terminal appearance</h2>
        <Button variant="icon" aria-label="Close Terminal appearance" title="Close" onClick={onClose}>
          <Icon name="x" size={16} />
        </Button>
      </div>

      <div className="cog-drawer__field">
        <span className="cog-drawer__label">Apply to</span>
        <Segmented<Scope>
          ariaLabel="Apply to"
          value={target !== undefined ? 'one' : 'all'}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All terminals' },
            { value: 'one', label: name ? `This terminal: ${name}` : 'This terminal', disabled: !name }
          ]}
        />
      </div>

      <div className="cog-drawer__field">
        <label className="cog-drawer__label" htmlFor="appearance-font">Font</label>
        <Select<FontId>
          id="appearance-font"
          value={eff.font}
          options={FONTS.map(f => ({ value: f.id, label: f.label }))}
          onChange={(font) => update({ font })}
        />
      </div>

      <div className="cog-drawer__field cog-drawer__row">
        <span className="cog-drawer__label">Size</span>
        <Stepper ariaLabel="Size" min={10} max={20} value={eff.size} onChange={(size) => update({ size })} />
      </div>

      <div className="cog-drawer__field">
        <span className="cog-drawer__label" id="appearance-palette-label">Palette</span>
        <div className="cog-palettes" role="radiogroup" aria-labelledby="appearance-palette-label">
          {PALETTES.map((p, i) => {
            const selected = p.id === eff.palette
            return (
              <button
                key={p.id}
                ref={(el) => { radios.current[i] = el }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                className="cog-pcard"
                onClick={() => update({ palette: p.id })}
                onKeyDown={(e) => onPaletteKey(e, i)}
              >
                <span className="cog-pcard__pv" aria-hidden="true" style={{ background: p.bg }}>
                  <i style={{ width: '72%', background: p.fg }} />
                  <i style={{ width: '54%', background: p.ansi[4] }} />
                  <i style={{ width: '64%', background: p.ansi[2] }} />
                  <i style={{ width: '40%', background: p.ansi[1] }} />
                </span>
                <span className="cog-pcard__name">
                  {p.label}
                  {selected && <Icon name="check" size={14} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {target !== undefined && (
        <div className="cog-drawer__field">
          <Button variant="ghost" onClick={() => appearanceStore.setAgent(target, null)}>Use global</Button>
        </div>
      )}

      <p className="cog-drawer__note">Applies in Canvas and Mosaic.</p>

      <div className="cog-drawer__foot">
        <Button onClick={() => motionStore.set(!paused)}>
          <Icon name={paused ? 'play' : 'pause'} size={14} />
          {paused ? 'Resume motion' : 'Pause motion'}
        </Button>
      </div>
    </aside>
  )
}
