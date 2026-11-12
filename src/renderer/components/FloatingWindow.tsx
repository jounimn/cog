import React, { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rnd, type DraggableData, type RndDragEvent } from 'react-rnd'
import { getSnapZone, getWindowSnap, type SnapBounds, type SnapZoneInfo, type WindowBounds } from '../hooks/useSnapZones'
import type { AgentTheme, AgentStatus } from '../../shared/types'
import { cardPresentation } from '../sleep-ui'
import { THEME_PRESETS, resolveTheme } from '../themes'
import { PlateHeader, PlateTicks, plateAccent, type PlateSpec } from './PlateHeader'
import { Button, Icon, c, font } from '../ui'

interface FloatingWindowProps {
  id: string
  title: string
  /** Agent cli and model, shown under the name. */
  spec?: PlateSpec[]
  /** This is the focused window (the top one). */
  focused?: boolean
  x: number
  y: number
  width: number
  height: number
  zoom: number
  pan: { x: number; y: number }
  zIndex: number
  minimized: boolean
  maximized: boolean
  workspaceWidth: number
  workspaceHeight: number
  otherWindows: WindowBounds[]
  restoreBounds?: SnapBounds | null
  viewportRef?: React.RefObject<HTMLDivElement | null>
  onFocus: () => void
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
  onDragStop: (x: number, y: number) => void
  onResizeStop: (x: number, y: number, width: number, height: number) => void
  onSnapPreviewChange: (info: SnapZoneInfo | null) => void
  onSnap: (bounds: SnapBounds, restoreBounds: SnapBounds) => void
  isAgent?: boolean
  /** Resolved terminal background: plate frame and body share it so they read as one surface. */
  bodyBg?: string
  onLinkDragStart?: (e: React.MouseEvent) => void
  theme?: AgentTheme
  agentId?: string
  /**
   * Optional custom context menu for the window's title bar. When provided,
   * right-clicking the title bar opens THIS menu instead of the default agent
   * ThemeMenu. Panel windows (like Trollbox) use this hook to render their
   * own panel-specific theme menus. Agent windows should NOT pass this prop.
   *
   * Returns null to suppress any menu for a particular event.
   */
  onTitleBarContextMenu?: (
    event: React.MouseEvent,
    closeMenu: () => void
  ) => React.ReactNode | null
  onEditAgent?: (agentId: string) => void
  status?: AgentStatus
  /** What decides whether "Sleep now" is offered (see cardPresentation). */
  sleepInfo?: { cli?: string; sessionStarted?: boolean; neverSleep?: boolean }
  onSleepAgent?: (agentId: string) => void
  onWakeAgent?: (agentId: string) => void
  children: React.ReactNode
}

export function FloatingWindow({
  id,
  title,
  spec,
  focused,
  x,
  y,
  width,
  height,
  zoom,
  pan,
  zIndex,
  minimized,
  maximized,
  workspaceWidth,
  workspaceHeight,
  otherWindows,
  restoreBounds,
  viewportRef,
  onFocus,
  onMinimize,
  onMaximize,
  onClose,
  onDragStop,
  onResizeStop,
  onSnapPreviewChange,
  onSnap,
  isAgent,
  bodyBg,
  onLinkDragStart,
  theme,
  agentId,
  onTitleBarContextMenu,
  onEditAgent,
  status,
  sleepInfo,
  onSleepAgent,
  onWakeAgent,
  children
}: FloatingWindowProps): React.ReactElement | null {
  const [dragSizeOverride, setDragSizeOverride] = useState<{ width: number; height: number } | null>(null)
  const [themeMenu, setThemeMenu] = useState<{ x: number; y: number } | null>(null)
  const [customMenu, setCustomMenu] = useState<React.ReactNode | null>(null)
  const resolvedTheme = resolveTheme(theme)

  const openThemeMenu = useCallback((e: React.MouseEvent) => {
    if (!isAgent || !agentId) return
    e.preventDefault()
    e.stopPropagation()
    setThemeMenu({ x: e.clientX, y: e.clientY })
  }, [isAgent, agentId])

  const openContextMenu = useCallback((e: React.MouseEvent) => {
    if (onTitleBarContextMenu) {
      e.preventDefault()
      e.stopPropagation()
      const closeMenu = () => setCustomMenu(null)
      const rendered = onTitleBarContextMenu(e, closeMenu)
      if (rendered !== null) {
        setCustomMenu(rendered)
      }
      return
    }
    openThemeMenu(e)
  }, [onTitleBarContextMenu, openThemeMenu])

  const applyPreset = useCallback(async (presetTheme: AgentTheme | null) => {
    if (!agentId) return
    setThemeMenu(null)
    await window.electronAPI.setAgentTheme(agentId, presetTheme)
  }, [agentId])

  const updateThemeField = useCallback(async (field: keyof AgentTheme, value: string) => {
    if (!agentId) return
    const next: AgentTheme = { ...(theme ?? {}), [field]: value }
    await window.electronAPI.setAgentTheme(agentId, next)
  }, [agentId, theme])

  // Rnd lives inside the CSS-transformed canvas. Positions are in canvas space.
  // CSS scale(zoom) handles visual scaling. No manual * zoom needed.
  const displayWidth = dragSizeOverride?.width ?? width
  const displayHeight = dragSizeOverride?.height ?? height

  const getSnapInfo = useCallback((event: RndDragEvent): SnapZoneInfo | null => {
    if (!viewportRef?.current) return null

    const point = 'touches' in event
      ? event.touches[0] ?? event.changedTouches[0]
      : event
    if (!point) return null

    const rect = viewportRef.current.getBoundingClientRect()
    const mouseX = point.clientX - rect.left
    const mouseY = point.clientY - rect.top
    return getSnapZone(mouseX, mouseY, workspaceWidth, workspaceHeight)
  }, [viewportRef, workspaceWidth, workspaceHeight])

  const activeRestoreBounds = useMemo(() => {
    if (restoreBounds) return restoreBounds
    return { x, y, width: displayWidth, height: displayHeight }
  }, [restoreBounds, x, y, displayWidth, displayHeight])

  const handleDragStart = useCallback(() => {
    if (restoreBounds) {
      setDragSizeOverride({ width: restoreBounds.width, height: restoreBounds.height })
    }
  }, [restoreBounds])

  const handleDrag = useCallback((e: RndDragEvent, data: DraggableData) => {
    // Edge snap takes priority
    const edgeSnap = getSnapInfo(e)
    if (edgeSnap) {
      onSnapPreviewChange(edgeSnap)
      return
    }

    // Window-to-window snap (canvas space)
    const dragW = dragSizeOverride?.width ?? width
    const dragH = dragSizeOverride?.height ?? height
    const winSnap = getWindowSnap(data.x, data.y, dragW, dragH, otherWindows, 20 / zoom)
    if (winSnap) {
      onSnapPreviewChange({
        zone: winSnap.zone,
        bounds: {
          x: winSnap.canvasBounds.x * zoom + pan.x,
          y: winSnap.canvasBounds.y * zoom + pan.y,
          width: winSnap.canvasBounds.width * zoom,
          height: winSnap.canvasBounds.height * zoom
        }
      })
      return
    }

    onSnapPreviewChange(null)
  }, [dragSizeOverride, getSnapInfo, onSnapPreviewChange, otherWindows, pan.x, pan.y, width, height, zoom])

  const handleDragStop = useCallback((e: RndDragEvent, data: DraggableData) => {
    onSnapPreviewChange(null)

    // Edge snap takes priority
    const edgeSnap = getSnapInfo(e)
    if (edgeSnap) {
      setDragSizeOverride(null)
      onSnap({
        x: (edgeSnap.bounds.x - pan.x) / zoom,
        y: (edgeSnap.bounds.y - pan.y) / zoom,
        width: edgeSnap.bounds.width / zoom,
        height: edgeSnap.bounds.height / zoom
      }, activeRestoreBounds)
      return
    }

    // Window-to-window snap (already in canvas space)
    const dragW = dragSizeOverride?.width ?? width
    const dragH = dragSizeOverride?.height ?? height
    const winSnap = getWindowSnap(data.x, data.y, dragW, dragH, otherWindows, 20 / zoom)
    if (winSnap) {
      setDragSizeOverride(null)
      onSnap(winSnap.canvasBounds, activeRestoreBounds)
      return
    }

    if (dragSizeOverride) {
      onResizeStop(data.x, data.y, dragSizeOverride.width, dragSizeOverride.height)
      setDragSizeOverride(null)
      return
    }

    onDragStop(data.x, data.y)
  }, [activeRestoreBounds, dragSizeOverride, getSnapInfo, onDragStop, onResizeStop, onSnap, onSnapPreviewChange, otherWindows, pan.x, pan.y, width, height, zoom])

  const handleResizeStop = useCallback((_e: any, _dir: any, ref: HTMLElement, _delta: any, position: { x: number; y: number }) => {
    setDragSizeOverride(null)
    onSnapPreviewChange(null)
    onResizeStop(
      position.x,
      position.y,
      parseInt(ref.style.width),
      parseInt(ref.style.height)
    )
  }, [onResizeStop, onSnapPreviewChange])

  // Minimized: hide but keep hooks alive (React requires consistent hook count)
  if (minimized) return null

  const presentation = cardPresentation({ status: status ?? 'idle', ...sleepInfo })
  const accent = plateAccent(theme)
  const frameStyle: React.CSSProperties = {
    ...windowStyle,
    opacity: presentation.opacity,
    border: `1px solid ${accent?.border ?? (focused ? c('steel') : c('line-strong'))}`,
    backgroundColor: bodyBg ?? (accent ? resolvedTheme.bg : c('surface'))
  }
  const titleText = `${presentation.titlePrefix}${title}`
  const onTitleDoubleClick = status === 'sleeping' && onWakeAgent && agentId ? () => onWakeAgent(agentId) : onMaximize
  const header = (isMaximized: boolean): React.ReactElement => (
    <PlateHeader
      className="window-titlebar"
      title={titleText}
      spec={spec}
      status={isAgent ? status : undefined}
      focused={focused}
      accent={accent}
      maximized={isMaximized}
      onMaximize={onMaximize}
      onClose={onClose}
      onDoubleClick={onTitleDoubleClick}
      onContextMenu={openContextMenu}
      extra={
        <Button variant="icon" className="cog-btn--ghost" onClick={onMinimize} title="Minimize" aria-label="Minimize">
          <Icon name="minus" size={14} />
        </Button>
      }
    />
  )

  // Maximized: render via portal into viewport (outside canvas transform)
  if (maximized && viewportRef?.current) {
    return createPortal(
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        zIndex: 99998, display: 'flex', flexDirection: 'column',
        ...frameStyle, overflow: 'hidden'
      }}>
        {header(true)}
        <div style={{ flex: 1, overflow: 'hidden', backgroundColor: bodyBg }}>{children}</div>
        {themeMenu && <ThemeMenu x={themeMenu.x} y={themeMenu.y} theme={theme} onClose={() => setThemeMenu(null)} onApplyPreset={applyPreset} onChangeField={updateThemeField} onEdit={onEditAgent && agentId ? () => onEditAgent(agentId) : undefined} menu={presentation.menu} onSleep={onSleepAgent && agentId ? () => onSleepAgent(agentId) : undefined} onWake={onWakeAgent && agentId ? () => onWakeAgent(agentId) : undefined} />}
        {customMenu}
      </div>,
      viewportRef.current
    )
  }

  return (
    <Rnd
      position={{ x, y }}
      size={{ width: displayWidth, height: displayHeight }}
      style={{ ...frameStyle, zIndex }}
      dragHandleClassName="window-titlebar"
      minWidth={300}
      minHeight={200}
      scale={zoom}
      onMouseDown={onFocus}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
    >
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', borderRadius: 'var(--r)' }}>
        {header(false)}
        {isAgent && onLinkDragStart && (
          <div
            onMouseDown={(e) => { e.stopPropagation(); onLinkDragStart(e) }}
            title="Drag to link with another agent"
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              width: 8,
              height: 8,
              boxSizing: 'border-box',
              borderRadius: 1,
              backgroundColor: c('surface'),
              border: `1.5px solid ${c('steel')}`,
              cursor: 'crosshair',
              zIndex: 10,
              transition: 'border-color var(--dur) var(--ease-out)',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = c('focus'))}
            onMouseLeave={e => (e.currentTarget.style.borderColor = c('steel'))}
          />
        )}
        <div style={{ flex: 1, overflow: 'hidden', backgroundColor: bodyBg }}>{children}</div>
      </div>
      {focused && <PlateTicks />}
      {themeMenu && <ThemeMenu x={themeMenu.x} y={themeMenu.y} theme={theme} onClose={() => setThemeMenu(null)} onApplyPreset={applyPreset} onChangeField={updateThemeField} onEdit={onEditAgent && agentId ? () => onEditAgent(agentId) : undefined} menu={presentation.menu} onSleep={onSleepAgent && agentId ? () => onSleepAgent(agentId) : undefined} onWake={onWakeAgent && agentId ? () => onWakeAgent(agentId) : undefined} />}
      {customMenu}
    </Rnd>
  )
}

interface ThemeMenuProps {
  x: number
  y: number
  theme: AgentTheme | undefined
  onClose: () => void
  onApplyPreset: (theme: AgentTheme | null) => void
  onChangeField: (field: keyof AgentTheme, value: string) => void
  onEdit?: () => void
  menu: Array<'sleep' | 'wake'>
  onSleep?: () => void
  onWake?: () => void
}

function ThemeMenu({ x, y, theme, onClose, onApplyPreset, onChangeField, onEdit, menu, onSleep, onWake }: ThemeMenuProps) {
  const resolved = resolveTheme(theme)
  const fields: { key: keyof AgentTheme; label: string }[] = [
    { key: 'chrome', label: 'Title Bar' },
    { key: 'border', label: 'Border' },
    { key: 'bg', label: 'Background' },
    { key: 'text', label: 'Text' }
  ]

  return createPortal(
    <>
      <div onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 100000 }} />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 100001,
        backgroundColor: c('surface'), border: `1px solid ${c('line-strong')}`, borderRadius: 'var(--r)',
        padding: '8px', minWidth: '220px', boxShadow: `0 8px 24px ${c('surface-sunk', 0.6)}`,
        fontFamily: font.text, color: c('ink-muted')
      }}>
        <div style={{ fontSize: '10px', color: c('ink-subtle'), textTransform: 'uppercase', marginBottom: '6px', padding: '0 4px' }}>
          Quick Themes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
          {THEME_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => onApplyPreset(preset.id === 'default' ? null : preset.theme)}
              title={preset.label}
              style={{
                background: preset.theme.chrome,
                border: `1px solid ${preset.theme.border}`,
                borderRadius: '4px',
                color: preset.theme.text,
                cursor: 'pointer',
                fontSize: '14px',
                padding: '8px 0',
                lineHeight: 1
              }}
            >{preset.emoji}</button>
          ))}
        </div>

        <div style={{ fontSize: '10px', color: c('ink-subtle'), textTransform: 'uppercase', marginBottom: '6px', padding: '0 4px' }}>
          Custom Colors
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
          {fields.map(f => (
            <label key={f.key} style={{
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px',
              padding: '4px 6px', backgroundColor: c('surface-muted'), borderRadius: 'var(--r)'
            }}>
              <input
                type="color"
                value={resolved[f.key]}
                onChange={e => onChangeField(f.key, e.target.value)}
                style={{ width: '24px', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
              />
              <span style={{ flex: 1 }}>{f.label}</span>
              <span style={{ color: c('ink-subtle'), fontSize: '10px', fontFamily: font.mono }}>{resolved[f.key]}</span>
            </label>
          ))}
        </div>

        <button
          onClick={() => onApplyPreset(null)}
          style={{
            width: '100%', padding: '6px', fontSize: '11px',
            background: 'transparent', border: `1px solid ${c('line-strong')}`, borderRadius: 'var(--r)',
            color: c('ink-subtle'), cursor: 'pointer', fontFamily: font.text
          }}
        >Reset to Default</button>
        {onEdit && (
          <>
            <div style={{ borderTop: `1px solid ${c('line')}`, margin: '8px 0' }} />
            <button
              onClick={() => { onEdit(); onClose() }}
              style={{
                width: '100%', padding: '6px', fontSize: '11px',
                background: 'transparent', border: `1px solid ${c('line-strong')}`, borderRadius: 'var(--r)',
                color: c('ink-muted'), cursor: 'pointer', fontFamily: font.text
              }}
            >Edit agent…</button>
          </>
        )}
        {onSleep && menu.includes('sleep') && (
          <button
            onClick={() => { onSleep(); onClose() }}
            style={{
              width: '100%', padding: '6px', fontSize: '11px', marginTop: '8px',
              background: 'transparent', border: `1px solid ${c('line-strong')}`, borderRadius: 'var(--r)',
              color: c('ink-muted'), cursor: 'pointer', fontFamily: font.text
            }}
          >Sleep now</button>
        )}
        {onWake && menu.includes('wake') && (
          <button
            onClick={() => { onWake(); onClose() }}
            style={{
              width: '100%', padding: '6px', fontSize: '11px', marginTop: '8px',
              background: 'transparent', border: `1px solid ${c('line-strong')}`, borderRadius: 'var(--r)',
              color: c('ink-muted'), cursor: 'pointer', fontFamily: font.text
            }}
          >Wake</button>
        )}
      </div>
    </>,
    document.body
  )
}

const windowStyle: React.CSSProperties = {
  borderRadius: 'var(--r)',
  boxShadow: `0 4px 20px ${c('surface-sunk', 0.5)}`
}
