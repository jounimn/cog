import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AutonomySettings } from './AutonomySettings'
import QRCode from 'qrcode-svg'
import type { SleepSettings, AgentState, WorkspaceTheme, CommunityThemeListItem, CommunityTheme, AgentTheme, TelegramStatus, TelegramTopicsStatus, NotificationThreshold } from '../../shared/types'
import { parseSleepNumber } from '../sleep-ui'
import { ROLE_THEME_DEFAULTS, getPresetById, THEME_PRESETS, WORKSPACE_THEMES, getWorkspaceThemeById, DEFAULT_THEME } from '../themes'
import { Button, Checkbox, CogMark, Dialog, Icon, Input, Row, SectionHeader, Segmented, Select, c } from '../ui'
import { SETTINGS_SECTIONS, SETTINGS_SECTION_ORDER, isScrolledToEnd, pickActiveSection, type SettingsSectionId } from './settings-sections'

declare const electronAPI: {
  getSettings: () => Promise<Record<string, any>>
  setSetting: (key: string, value: unknown) => Promise<{ status: string }>
  enableRemoteView: () => Promise<{ ok: boolean }>
  disableRemoteView: () => Promise<{ ok: boolean }>
  getRemoteViewState: () => Promise<{ enabled: boolean; publicUrl: string | null; connectionCount: number; lastActivity: number | null }>
  killRemoteSessions: () => Promise<{ ok: boolean; newUrl?: string | null }>
  regenerateRemoteToken: () => Promise<{ ok: boolean; newUrl?: string | null }>
  setWorkshopPasscode: (pin: string) => Promise<{ success: boolean; error?: string }>
  getWorkshopPasscodeSet: () => Promise<{ isSet: boolean }>
  clearWorkshopPasscode: () => Promise<{ success: boolean }>
  onRemoteStatusUpdate: (cb: (s: { enabled: boolean; publicUrl: string | null; connectionCount: number; lastActivity: number | null }) => void) => () => void
  onRemoteSetupProgress: (cb: (p: { stage: 'downloading' | 'starting' | 'ready' | 'error'; message?: string }) => void) => () => void
}

interface SettingsDialogProps {
  onClose: () => void
  agents?: AgentState[]
}

/** A setting with its label and help on the left and its control on the right. */
function SettingItem({ label, help, children, stack, className }: {
  label: React.ReactNode
  help?: React.ReactNode
  children?: React.ReactNode
  stack?: boolean
  className?: string
}): React.ReactElement {
  const cls = ['cog-settings__item', stack && 'cog-settings__item--stack', className].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      <div className="cog-settings__text">
        <span className="cog-settings__label">{label}</span>
        {help != null && <span className="cog-settings__help">{help}</span>}
      </div>
      {children != null && <div className="cog-settings__control">{children}</div>}
    </div>
  )
}

/** A toggle: the kit Checkbox with its label, help below. */
function SettingCheck({ checked, onChange, label, help, disabled }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  help?: React.ReactNode
  disabled?: boolean
}): React.ReactElement {
  return (
    <div className="cog-settings__check">
      <Checkbox checked={checked} onChange={onChange} disabled={disabled}>{label}</Checkbox>
      {help != null && <span className="cog-dialog__checkhint">{help}</span>}
    </div>
  )
}

const TIMEOUT_OPTIONS = [
  ...['1', '2', '4', '8', '12', '24'].map(v => ({ value: v, label: `${v}h` })),
  { value: 'custom', label: 'Custom' }
]

const RESPAWN_OPTIONS = [
  { value: 'active', label: 'Active workspace only' },
  { value: 'all', label: 'All workspaces' },
  { value: 'none', label: "Don't respawn" }
]

export function SettingsDialog({ onClose, agents = [] }: SettingsDialogProps): React.ReactElement {
  const [themeApplyMsg, setThemeApplyMsg] = useState<string | null>(null)
  const [activeWsThemeId, setActiveWsThemeId] = useState<string | null>(null)
  const [customThemes, setCustomThemes] = useState<WorkspaceTheme[]>([])
  const [customThemeName, setCustomThemeName] = useState('')
  const [showSaveCustom, setShowSaveCustom] = useState(false)
  const [sleepSettings, setSleepSettings] = useState<SleepSettings | null>(null)
  // Typed text per number field, saved on blur / Enter (clearing must not write 0).
  const [sleepDrafts, setSleepDrafts] = useState<Partial<Record<'sleepAfterMinutes' | 'memoryFloorMb', string>>>({})
  const commitSleepDraft = async (key: 'sleepAfterMinutes' | 'memoryFloorMb'): Promise<void> => {
    const draft = sleepDrafts[key]
    if (draft === undefined) return
    setSleepDrafts(prev => { const next = { ...prev }; delete next[key]; return next })
    const n = parseSleepNumber(draft)
    if (n === null || n === sleepSettings?.[key]) return // invalid or unchanged: show the saved value again
    setSleepSettings(await window.electronAPI.sleepSettingsSet({ [key]: n }))
  }

  useEffect(() => {
    window.electronAPI.getActiveWorkspaceTheme().then(setActiveWsThemeId)
    window.electronAPI.listCustomWorkspaceThemes().then(setCustomThemes)
    window.electronAPI.sleepSettingsGet().then(setSleepSettings)
  }, [])

  const allThemes = useMemo(() => [...WORKSPACE_THEMES, ...customThemes], [customThemes])

  const applyWorkspaceTheme = useCallback(async (theme: WorkspaceTheme) => {
    let applied = 0
    for (const agent of agents) {
      const colors = theme.roleColors[agent.role] ?? theme.fallback
      await window.electronAPI.setAgentTheme(agent.id, colors)
      applied++
    }
    await window.electronAPI.setActiveWorkspaceTheme(theme.id)
    setActiveWsThemeId(theme.id)
    setThemeApplyMsg(`Applied "${theme.label}" to ${applied} agent${applied !== 1 ? 's' : ''}`)
    setTimeout(() => setThemeApplyMsg(null), 2500)
  }, [agents])

  const clearAllThemes = async () => {
    let cleared = 0
    for (const agent of agents) {
      if (agent.theme) {
        await window.electronAPI.setAgentTheme(agent.id, null)
        cleared++
      }
    }
    await window.electronAPI.setActiveWorkspaceTheme(null)
    setActiveWsThemeId(null)
    setThemeApplyMsg(`Cleared themes from ${cleared} agent${cleared !== 1 ? 's' : ''}`)
    setTimeout(() => setThemeApplyMsg(null), 2500)
  }

  const saveCurrentAsTheme = async () => {
    const name = customThemeName.trim()
    if (!name || agents.length === 0) return
    const roleColors: Record<string, Required<import('../../shared/types').AgentTheme>> = {}
    // Agent theme data: the same defaults as DEFAULT_THEME.
    let fallbackTheme = { chrome: DEFAULT_THEME.chrome, border: DEFAULT_THEME.border, bg: DEFAULT_THEME.bg, text: DEFAULT_THEME.text }
    for (const agent of agents) {
      if (agent.theme) {
        const full = {
          chrome: agent.theme.chrome ?? DEFAULT_THEME.chrome,
          border: agent.theme.border ?? DEFAULT_THEME.border,
          bg: agent.theme.bg ?? DEFAULT_THEME.bg,
          text: agent.theme.text ?? DEFAULT_THEME.text
        }
        if (agent.role) roleColors[agent.role] = full
        fallbackTheme = full
      }
    }
    const id = `custom-${Date.now()}`
    const theme: WorkspaceTheme = {
      id,
      label: name,
      description: 'Custom theme',
      roleColors,
      fallback: fallbackTheme,
      meta: { version: 1 }
    }
    await window.electronAPI.saveCustomWorkspaceTheme(theme)
    setCustomThemes(prev => [...prev, theme])
    setCustomThemeName('')
    setShowSaveCustom(false)
    setThemeApplyMsg(`Saved "${name}"`)
    setTimeout(() => setThemeApplyMsg(null), 2500)
  }

  const deleteCustomTheme = async (id: string) => {
    await window.electronAPI.deleteCustomWorkspaceTheme(id)
    setCustomThemes(prev => prev.filter(t => t.id !== id))
    if (activeWsThemeId === id) {
      setActiveWsThemeId(null)
      await window.electronAPI.setActiveWorkspaceTheme(null)
    }
  }

  // Community themes
  const [showCommunityThemes, setShowCommunityThemes] = useState(false)
  const [communityThemes, setCommunityThemes] = useState<CommunityThemeListItem[]>([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityError, setCommunityError] = useState<string | null>(null)
  const [showShareForm, setShowShareForm] = useState(false)
  const [shareAuthor, setShareAuthor] = useState('')
  const [shareDescription, setShareDescription] = useState('')

  const browseCommunityThemes = async (force = false) => {
    setCommunityLoading(true)
    setCommunityError(null)
    const res = await window.electronAPI.communityThemeList({ force })
    if (res.success) {
      setCommunityThemes(res.items)
    } else {
      setCommunityError(res.error)
    }
    setCommunityLoading(false)
  }

  const downloadCommunityTheme = async (item: CommunityThemeListItem) => {
    const res = await window.electronAPI.communityThemeGet(item.issueNumber)
    if (!res.success) {
      setThemeApplyMsg(`Error: ${res.error}`)
      setTimeout(() => setThemeApplyMsg(null), 3000)
      return
    }
    const ct = res.theme
    const wsTheme: WorkspaceTheme = {
      id: `community-${ct.issueNumber}`,
      label: ct.name,
      description: ct.description,
      roleColors: ct.roleColors,
      fallback: ct.fallback,
      meta: { author: ct.author, version: 1 }
    }
    await window.electronAPI.saveCustomWorkspaceTheme(wsTheme)
    setCustomThemes(prev => {
      if (prev.find(t => t.id === wsTheme.id)) return prev
      return [...prev, wsTheme]
    })
    setThemeApplyMsg(`Downloaded "${ct.name}"`)
    setTimeout(() => setThemeApplyMsg(null), 2500)
  }

  const shareCommunityTheme = async (theme: WorkspaceTheme) => {
    if (!shareAuthor.trim()) return
    const res = await window.electronAPI.communityThemeShare({
      name: theme.label,
      description: shareDescription.trim() || theme.description,
      author: shareAuthor.trim(),
      roleColors: theme.roleColors,
      fallback: theme.fallback
    })
    if (res.success) {
      setThemeApplyMsg(`Shared "${theme.label}" to community!`)
      setShowShareForm(false)
      setShareAuthor('')
      setShareDescription('')
      browseCommunityThemes(true)
    } else {
      setThemeApplyMsg(`Error: ${res.error}`)
    }
    setTimeout(() => setThemeApplyMsg(null), 3000)
  }

  const toggleThemeStar = async (issueNumber: number) => {
    const res = await window.electronAPI.communityThemeToggleStar(issueNumber)
    if (res.success) {
      setCommunityThemes(prev => prev.map(t =>
        t.issueNumber === issueNumber ? { ...t, stars: res.stars, isStarredByMe: res.isStarredByMe } : t
      ))
    }
  }

  const [projectName, setProjectName] = useState<string | null>(null)
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [remoteState, setRemoteState] = useState({ enabled: false, publicUrl: null as string | null, lanUrl: null as string | null, lanEnabled: false, connectionCount: 0, lastActivity: null as number | null })
  const [whichQr, setWhichQr] = useState<'tunnel' | 'lan'>('tunnel')
  const [setupProgress, setSetupProgress] = useState<{ stage: string; message?: string } | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [plainQr, setPlainQr] = useState(false)
  const [shortQrUrl, setShortQrUrl] = useState<string | null>(null)
  const [show3dsPanel, setShow3dsPanel] = useState(false)
  const [dsIp, setDsIp] = useState('')
  const [dsPort, setDsPort] = useState('8336')
  const [dsSendResult, setDsSendResult] = useState('')
  const [showCustomTimeout, setShowCustomTimeout] = useState(false)
  const [customTimeoutHours, setCustomTimeoutHours] = useState(8)
  const [passcodeSet, setPasscodeSet] = useState(false)
  const [passcodeInput, setPasscodeInput] = useState('')
  const [showPasscodeInput, setShowPasscodeInput] = useState(false)

  const qrSourceUrl = whichQr === 'lan' ? remoteState.lanUrl : remoteState.publicUrl
  const qrSvg = useMemo(() => {
    if (!qrSourceUrl) return null
    try {
      // Plain mode: lower error correction + no logo overlay for ancient QR
      // readers (Nintendo 3DS, older feature phones). Default: ECL 'H' so the
      // centered cog logo doesn't break scannability on modern scanners.
      const content = (plainQr && shortQrUrl) ? shortQrUrl : qrSourceUrl
      return new QRCode({
        content,
        padding: 2,
        width: 220,
        height: 220,
        // qrcode-svg writes these into inline style="fill:…", so tokens resolve
        color: c('ink'),
        background: c('surface'),
        ecl: plainQr ? 'L' : 'H'
      }).svg()
    } catch {
      return null
    }
  }, [qrSourceUrl, plainQr, shortQrUrl])

  useEffect(() => {
    const hasAnyUrl = remoteState.lanUrl || remoteState.publicUrl
    if (!plainQr || !hasAnyUrl) { setShortQrUrl(null); return }
    let cancelled = false
    window.electronAPI.registerShortLink(
      remoteState.lanUrl || null,
      remoteState.publicUrl || null
    ).then(url => { if (!cancelled) setShortQrUrl(url) })
    return () => { cancelled = true }
  }, [plainQr, remoteState.lanUrl, remoteState.publicUrl])

  useEffect(() => {
    window.electronAPI.getProject().then(p => setProjectName(p?.name ?? null))
    electronAPI.getSettings().then(s => {
      setSettings(s)
      const saved = s.remoteSessionTimeout as number | undefined
      const presetValues = [1, 2, 4, 8, 12, 24]
      if (saved && !presetValues.includes(saved)) {
        setShowCustomTimeout(true)
        setCustomTimeoutHours(saved)
      } else if (saved) {
        setCustomTimeoutHours(saved)
      }
    })
    electronAPI.getRemoteViewState().then(setRemoteState)
    electronAPI.getWorkshopPasscodeSet().then(r => setPasscodeSet(r.isSet))

    const unsubStatus = electronAPI.onRemoteStatusUpdate((s) => setRemoteState(s))
    const unsubProgress = electronAPI.onRemoteSetupProgress((p) => {
      setSetupProgress(p)
      if (p.stage === 'ready' || p.stage === 'error') {
        setTimeout(() => setSetupProgress(null), 2500)
      }
    })

    return () => {
      unsubStatus()
      unsubProgress()
    }
  }, [])

  const toggle = async (key: string, defaultVal: boolean) => {
    const current = settings[key] ?? defaultVal
    const newVal = !current
    await electronAPI.setSetting(key, newVal)
    setSettings(prev => ({ ...prev, [key]: newVal }))
  }

  const toggleRemote = async () => {
    if (remoteState.enabled) {
      await electronAPI.disableRemoteView()
    } else {
      await electronAPI.enableRemoteView()
    }
  }

  const handleTimeoutChange = async (value: string) => {
    if (value === 'custom') {
      setShowCustomTimeout(true)
      return
    }
    setShowCustomTimeout(false)
    const hours = parseInt(value, 10)
    if (isNaN(hours)) return
    setCustomTimeoutHours(hours)
    await electronAPI.setSetting('remoteSessionTimeout', hours)
    setSettings(prev => ({ ...prev, remoteSessionTimeout: hours }))
  }

  const handleCustomTimeoutChange = async (hours: number) => {
    const clamped = Math.min(168, Math.max(1, hours))
    setCustomTimeoutHours(clamped)
    await electronAPI.setSetting('remoteSessionTimeout', clamped)
    setSettings(prev => ({ ...prev, remoteSessionTimeout: clamped }))
  }

  const copyUrl = () => {
    if (remoteState.publicUrl) {
      navigator.clipboard.writeText(remoteState.publicUrl)
    }
  }

  const killSessions = async () => {
    if (confirm('Kill all active remote sessions and rotate the token?')) {
      await electronAPI.killRemoteSessions()
    }
  }

  const regenerate = async () => {
    if (confirm('Generate a new token? Anyone using the old URL will be disconnected.')) {
      await electronAPI.regenerateRemoteToken()
    }
  }

  // ---- Left list of sections: jumps within the one scrolling body ----
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionEls = useRef<Partial<Record<SettingsSectionId, HTMLElement | null>>>({})
  const visibleSections = useRef(new Set<string>())
  // Set by a click in the list until the user scrolls by hand, so a short section
  // the jump cannot bring to the top stays highlighted.
  const navLock = useRef(false)
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(SETTINGS_SECTION_ORDER[0])

  const recomputeActive = useCallback(() => {
    const root = scrollRef.current
    if (!root || navLock.current) return
    const atEnd = isScrolledToEnd(root.scrollTop, root.clientHeight, root.scrollHeight)
    setActiveSection(cur => pickActiveSection(SETTINGS_SECTION_ORDER, visibleSections.current, cur, atEnd))
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    // In view = overlapping the top 40% of the scrolling body.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.settingsSection
        if (!id) continue
        if (e.isIntersecting) visibleSections.current.add(id)
        else visibleSections.current.delete(id)
      }
      recomputeActive()
    }, { root, rootMargin: '0px 0px -60% 0px', threshold: 0 })
    for (const id of SETTINGS_SECTION_ORDER) {
      const el = sectionEls.current[id]
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [recomputeActive])

  const jumpTo = (id: SettingsSectionId) => {
    navLock.current = true
    setActiveSection(id)
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    sectionEls.current[id]?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }
  const releaseNavLock = () => { navLock.current = false }
  const sectionRef = (id: SettingsSectionId) => (el: HTMLElement | null) => { sectionEls.current[id] = el }

  return (
    <Dialog
      title="Settings"
      icon="settings"
      size="lg"
      onClose={onClose}
      zIndex={100002}
      className="cog-settings"
      bodyClassName="cog-settings__body"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <nav className="cog-settings__nav" aria-label="Settings sections">
        {SETTINGS_SECTIONS.map(s => (
          <Row
            key={s.id}
            title={s.label}
            selected={activeSection === s.id}
            onClick={() => jumpTo(s.id)}
          />
        ))}
      </nav>

      <div
        ref={scrollRef}
        className="cog-settings__scroll"
        onScroll={recomputeActive}
        onWheel={releaseNavLock}
        onPointerDown={releaseNavLock}
        onTouchStart={releaseNavLock}
        onKeyDown={releaseNavLock}
      >
        {/* Notifications section */}
        <section ref={sectionRef('notifications')} data-settings-section="notifications" className="cog-settings__section">
          <SectionHeader>Notifications</SectionHeader>
          <SettingCheck
            checked={settings.notifications ?? true}
            onChange={() => toggle('notifications', true)}
            label="Task completion alerts"
            help="Show a system notification when tasks are completed"
          />
          <SettingCheck
            checked={settings.notifyAllDone ?? true}
            onChange={() => toggle('notifyAllDone', true)}
            label="All tasks done alert"
            help="Extra notification when entire pinboard is cleared"
          />
        </section>

        {/* Agents section */}
        <section ref={sectionRef('agents')} data-settings-section="agents" className="cog-settings__section">
          <SectionHeader>Agents</SectionHeader>
          <SettingItem
            label="Respawn agents on restart"
            help={<>
              Bring your teams back when you relaunch. Agents restart fresh (re-oriented with a
              reconnect prompt) — CLIs don&apos;t keep memory across a restart.
            </>}
          >
            <Select
              value={(settings.agentRespawnMode as string) ?? 'active'}
              options={RESPAWN_OPTIONS}
              ariaLabel="Respawn agents on restart"
              onChange={async (val) => {
                await electronAPI.setSetting('agentRespawnMode', val)
                setSettings(prev => ({ ...prev, agentRespawnMode: val }))
              }}
            />
          </SettingItem>

          <h4 className="cog-settings__sub">Agent sleep (this workspace)</h4>
          {sleepSettings && (
            <SettingCheck
              checked={sleepSettings.enabled}
              onChange={async (checked) => setSleepSettings(await window.electronAPI.sleepSettingsSet({ enabled: checked }))}
              label="Put idle agents to sleep"
            />
          )}
          {sleepSettings && ([
            { key: 'sleepAfterMinutes', label: 'Sleep after (minutes idle)' },
            { key: 'memoryFloorMb', label: 'Memory floor (MB)' }
          ] as const).map(({ key, label }) => (
            <SettingItem key={key} label={label}>
              <Input
                type="number"
                mono
                className="cog-settings__num"
                aria-label={label}
                min={0}
                step={1}
                value={sleepDrafts[key] ?? String(sleepSettings[key])}
                onChange={(e) => {
                  const text = e.target.value
                  setSleepDrafts(prev => ({ ...prev, [key]: text }))
                }}
                onBlur={() => { void commitSleepDraft(key) }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              />
            </SettingItem>
          ))}
        </section>

        {/* Workspace Themes section */}
        <section ref={sectionRef('themes')} data-settings-section="themes" className="cog-settings__section">
          <SectionHeader>Themes</SectionHeader>
          <p className="cog-settings__intro">
            Click a theme to color all agents by role. Right-click any terminal title bar to override individual agents.
          </p>

          {/* Theme gallery */}
          <div className="cog-settings__themes">
            {allThemes.map(theme => {
              const isActive = activeWsThemeId === theme.id
              const isCustom = !WORKSPACE_THEMES.find(t => t.id === theme.id)
              const swatchColors = ['orchestrator', 'worker', 'researcher', 'reviewer'].map(
                role => (theme.roleColors[role] ?? theme.fallback).border
              )
              const cls = [
                'cog-settings__theme',
                isActive && 'cog-settings__theme--active',
                agents.length === 0 && 'cog-settings__theme--disabled'
              ].filter(Boolean).join(' ')
              return (
                <div
                  key={theme.id}
                  className={cls}
                  onClick={() => agents.length > 0 && applyWorkspaceTheme(theme)}
                >
                  <div className="cog-settings__themename">{theme.label}</div>
                  <div className="cog-settings__swatches">
                    {/* Theme data colours */}
                    {swatchColors.map((color, i) => (
                      <span key={i} className="cog-settings__swatch" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className="cog-settings__themedesc">{theme.description}</div>
                  {isCustom && (
                    <Button
                      variant="icon"
                      className="cog-settings__themedel"
                      onClick={e => { e.stopPropagation(); deleteCustomTheme(theme.id) }}
                      title="Delete custom theme"
                      aria-label="Delete custom theme"
                    ><Icon name="x" size={12} /></Button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Save current + clear */}
          <div className="cog-settings__actions">
            <Button
              className="cog-settings__grow"
              onClick={() => setShowSaveCustom(!showSaveCustom)}
              disabled={agents.length === 0}
            >Save current as theme</Button>
            <Button
              variant="ghost"
              onClick={clearAllThemes}
              disabled={agents.length === 0}
            >Clear all</Button>
          </div>

          {showSaveCustom && (
            <div className="cog-settings__actions">
              <Input
                className="cog-settings__grow"
                placeholder="Theme name..."
                aria-label="Theme name"
                value={customThemeName}
                onChange={e => setCustomThemeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCurrentAsTheme()}
                autoFocus
              />
              <Button
                onClick={saveCurrentAsTheme}
                disabled={!customThemeName.trim()}
              >Save</Button>
            </div>
          )}

          {themeApplyMsg && (
            <div className="cog-settings__msg cog-settings__msg--success" role="status">
              <Icon name="circle-check" size={14} />{themeApplyMsg}
            </div>
          )}

          {/* Community themes */}
          <div className="cog-settings__community">
            <button
              type="button"
              className="cog-disclosure cog-disclosure--inline cog-settings__disclosure"
              aria-expanded={showCommunityThemes}
              onClick={() => { setShowCommunityThemes(!showCommunityThemes); if (!showCommunityThemes && communityThemes.length === 0) browseCommunityThemes() }}
            >
              <Icon name={showCommunityThemes ? 'chevron-down' : 'chevron-right'} size={14} />
              <span>Community themes</span>
            </button>

            {showCommunityThemes && (
              <div className="cog-settings__group">
                <div className="cog-settings__actions">
                  <Button
                    className="cog-settings__grow"
                    onClick={() => browseCommunityThemes(true)}
                    disabled={communityLoading}
                  ><Icon name="refresh-cw" size={14} />{communityLoading ? 'Loading...' : 'Refresh'}</Button>
                  {customThemes.length > 0 && (
                    <Button
                      className="cog-settings__grow"
                      pressed={showShareForm}
                      onClick={() => setShowShareForm(!showShareForm)}
                    ><Icon name="send" size={14} />Share a theme</Button>
                  )}
                </div>

                {showShareForm && customThemes.length > 0 && (
                  <div className="cog-settings__form">
                    <span className="cog-settings__help">Share a custom theme to the community:</span>
                    <Input
                      placeholder="Your name" value={shareAuthor} aria-label="Your name"
                      onChange={e => setShareAuthor(e.target.value)}
                    />
                    <Input
                      placeholder="Description (optional)" value={shareDescription} aria-label="Description"
                      onChange={e => setShareDescription(e.target.value)}
                    />
                    <div className="cog-settings__actions">
                      {customThemes.map(t => (
                        <Button
                          key={t.id}
                          onClick={() => shareCommunityTheme(t)}
                          disabled={!shareAuthor.trim()}
                        >Share "{t.label}"</Button>
                      ))}
                    </div>
                  </div>
                )}

                {communityError && (
                  <div className="cog-settings__msg cog-settings__msg--danger" role="alert">
                    <Icon name="circle-alert" size={14} />{communityError}
                  </div>
                )}

                {communityThemes.length > 0 && (
                  <div className="cog-dialog__list cog-settings__communitylist">
                    {communityThemes.map(item => (
                      <Row
                        key={item.issueNumber}
                        icon={
                          <span className="cog-settings__swatches">
                            {/* Theme data colours */}
                            {item.previewColors.map((color, i) => (
                              <span key={i} className="cog-settings__swatch cog-settings__swatch--sm" style={{ backgroundColor: color }} />
                            ))}
                          </span>
                        }
                        title={item.name}
                        meta={`by ${item.author}`}
                        actions={<>
                          <Button
                            variant="ghost"
                            className={item.isStarredByMe ? 'cog-settings__star cog-settings__star--on' : 'cog-settings__star'}
                            onClick={() => toggleThemeStar(item.issueNumber)}
                            title={item.isStarredByMe ? 'Unstar' : 'Star'}
                            aria-label={item.isStarredByMe ? 'Unstar' : 'Star'}
                            pressed={item.isStarredByMe}
                          ><Icon name="star" size={12} />{item.stars}</Button>
                          <Button onClick={() => downloadCommunityTheme(item)}>
                            <Icon name="download" size={14} />Get
                          </Button>
                        </>}
                      />
                    ))}
                  </div>
                )}

                {!communityLoading && communityThemes.length === 0 && !communityError && (
                  <p className="cog-settings__empty">
                    No community themes shared yet. Be the first!
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Remote View section */}
        <section ref={sectionRef('remote')} data-settings-section="remote" className="cog-settings__section">
          <SectionHeader>
            Remote view <span className="cog-settings__exp cog-tone-warning">(experimental)</span>
          </SectionHeader>

          <SettingCheck
            checked={remoteState.enabled}
            onChange={() => { void toggleRemote() }}
            label="Enable remote view"
            help="Tunnel your workshop to a public URL via Cloudflare"
          />

          <SettingItem label="Session timeout" help="How long before the remote session expires">
            <Select
              value={showCustomTimeout ? 'custom' : String(settings.remoteSessionTimeout ?? 8)}
              options={TIMEOUT_OPTIONS}
              ariaLabel="Session timeout"
              onChange={v => handleTimeoutChange(v)}
            />
            {showCustomTimeout && (
              <Input
                type="number"
                mono
                className="cog-settings__hours"
                aria-label="Custom timeout (hours)"
                min={1}
                max={168}
                value={customTimeoutHours}
                onChange={e => handleCustomTimeoutChange(parseInt(e.target.value, 10) || 1)}
              />
            )}
          </SettingItem>

          <SettingItem label="Workshop passcode" help="4-digit PIN to gate Workshop mode on mobile">
            {showPasscodeInput ? (
              <Input
                type="tel"
                mono
                className="cog-settings__pin"
                aria-label="Workshop passcode"
                maxLength={4}
                autoFocus
                placeholder="0000"
                value={passcodeInput}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setPasscodeInput(val)
                  if (val.length === 4) {
                    electronAPI.setWorkshopPasscode(val).then(r => {
                      if (r.success) {
                        setPasscodeSet(true)
                        setShowPasscodeInput(false)
                        setPasscodeInput('')
                      }
                    })
                  }
                }}
                onBlur={() => {
                  if (passcodeInput.length < 4) {
                    setShowPasscodeInput(false)
                    setPasscodeInput('')
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setShowPasscodeInput(false)
                    setPasscodeInput('')
                  }
                }}
              />
            ) : passcodeSet ? (
              <>
                <Button onClick={() => setShowPasscodeInput(true)}>Change</Button>
                <Button
                  variant="ghost"
                  className="cog-tone-danger"
                  onClick={() => {
                    electronAPI.clearWorkshopPasscode().then(r => {
                      if (r.success) setPasscodeSet(false)
                    })
                  }}
                >Clear</Button>
              </>
            ) : (
              <Button onClick={() => setShowPasscodeInput(true)}>Set passcode</Button>
            )}
          </SettingItem>

          {setupProgress && (
            <div className={setupProgress.stage === 'error' ? 'cog-settings__status cog-tone-danger' : setupProgress.stage === 'ready' ? 'cog-settings__status cog-tone-success' : 'cog-settings__status'}>
              {setupProgress.stage === 'downloading' && <><Icon name="loader" size={14} />{`Downloading cloudflared... ${setupProgress.message ?? ''}`}</>}
              {setupProgress.stage === 'starting' && <><Icon name="loader" size={14} />{setupProgress.message ?? 'Starting tunnel...'}</>}
              {setupProgress.stage === 'ready' && <><Icon name="circle-check" size={14} />Tunnel ready</>}
              {setupProgress.stage === 'error' && <><Icon name="circle-x" size={14} />{setupProgress.message}</>}
            </div>
          )}

          {remoteState.enabled && remoteState.publicUrl && (
            <>
              <div className="cog-settings__urlfield">
                <span className="cog-settings__fieldlabel">Tunnel URL (internet)</span>
                <div className="cog-settings__url">{remoteState.publicUrl}</div>
              </div>
              <div className="cog-settings__actions">
                <Button className="cog-settings__grow" onClick={copyUrl}><Icon name="copy" size={14} />Copy tunnel URL</Button>
                <Button className="cog-settings__grow" pressed={showQr} onClick={() => setShowQr(v => !v)}>
                  <Icon name={showQr ? 'x' : 'qr-code'} size={14} />{showQr ? 'Hide QR' : 'Show QR'}
                </Button>
              </div>

              {/* LAN access toggle + URL */}
              <SettingCheck
                checked={remoteState.lanEnabled}
                onChange={async () => {
                  if (remoteState.lanEnabled) await electronAPI.disableRemoteLan()
                  else await electronAPI.enableRemoteLan()
                }}
                label="Enable LAN access"
                help="Same-WiFi devices can connect over plain HTTP — no internet needed"
              />

              {remoteState.lanEnabled && remoteState.lanUrl && (
                <>
                  <div className="cog-settings__urlfield">
                    <span className="cog-settings__fieldlabel">LAN URL (same WiFi only)</span>
                    <div className="cog-settings__url cog-settings__url--lan">{remoteState.lanUrl}</div>
                  </div>
                  <div className="cog-settings__actions">
                    <Button
                      className="cog-settings__grow"
                      onClick={() => { if (remoteState.lanUrl) navigator.clipboard.writeText(remoteState.lanUrl) }}
                    ><Icon name="copy" size={14} />Copy LAN URL</Button>
                  </div>
                </>
              )}

              {/* QR source selector — only show if both URLs are available */}
              {showQr && remoteState.lanEnabled && remoteState.lanUrl && (
                <div className="cog-settings__seg">
                  <Segmented
                    value={whichQr}
                    ariaLabel="QR code source"
                    options={[
                      { value: 'tunnel', label: 'Tunnel QR' },
                      { value: 'lan', label: 'LAN QR' }
                    ]}
                    onChange={setWhichQr}
                  />
                </div>
              )}

              {showQr && qrSvg && (
                <div className="cog-settings__qr">
                  <div className="cog-settings__qrimg">
                    <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
                    {!plainQr && (
                      <span className="cog-settings__qrlogo"><CogMark size={32} /></span>
                    )}
                  </div>
                  <Checkbox checked={plainQr} onChange={setPlainQr}>
                    Plain QR (for old scanners — 3DS, feature phones)
                  </Checkbox>
                  <button
                    type="button"
                    className="cog-disclosure cog-disclosure--inline"
                    aria-expanded={show3dsPanel}
                    onClick={() => setShow3dsPanel(!show3dsPanel)}
                  >
                    <Icon name={show3dsPanel ? 'chevron-down' : 'chevron-right'} size={14} />
                    <span>Send to 3DS</span>
                  </button>
                  {show3dsPanel && (
                    <div className="cog-settings__form cog-settings__ds">
                      <div className="cog-settings__actions">
                        <Input
                          mono
                          className="cog-settings__grow"
                          placeholder="3DS IP (e.g. 192.168.2.227)"
                          aria-label="3DS IP"
                          value={dsIp} onChange={e => setDsIp(e.target.value)}
                        />
                        <Input
                          mono
                          className="cog-settings__port"
                          placeholder="Port"
                          aria-label="Port"
                          value={dsPort} onChange={e => setDsPort(e.target.value)}
                        />
                      </div>
                      <div className="cog-settings__actions">
                        {remoteState.lanUrl && (
                          <Button
                            onClick={async () => {
                              setDsSendResult('Sending...')
                              const r = await window.electronAPI.sendTo3DS(dsIp, parseInt(dsPort) || 8336, remoteState.lanUrl!)
                              setDsSendResult(r)
                            }}
                          >
                            <Icon name="send" size={14} />Send LAN URL
                          </Button>
                        )}
                        {remoteState.publicUrl && (
                          <Button
                            onClick={async () => {
                              setDsSendResult('Sending...')
                              const r = await window.electronAPI.sendTo3DS(dsIp, parseInt(dsPort) || 8336, remoteState.publicUrl!)
                              setDsSendResult(r)
                            }}
                          >
                            <Icon name="send" size={14} />Send tunnel URL
                          </Button>
                        )}
                      </div>
                      {dsSendResult && (
                        <div className={dsSendResult.includes('Error') || dsSendResult.includes('Timeout') ? 'cog-settings__status cog-tone-danger' : 'cog-settings__status cog-tone-success'}>
                          {dsSendResult}
                        </div>
                      )}
                      <span className="cog-settings__help">
                        On 3DS: press L on setup screen to start listening
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="cog-settings__conn">
                {remoteState.connectionCount === 0 && (
                  <span className="cog-settings__status"><Icon name="circle" size={12} />No connections</span>
                )}
                {remoteState.connectionCount === 1 && (
                  <span className="cog-settings__status cog-tone-success"><Icon name="circle-dot" size={12} />1 connection active</span>
                )}
                {remoteState.connectionCount > 1 && (
                  <span className="cog-settings__status cog-tone-danger"><Icon name="circle-alert" size={12} />{remoteState.connectionCount} connections active</span>
                )}
                {remoteState.lastActivity && (
                  <span className="cog-settings__help">
                    Last activity: {new Date(remoteState.lastActivity).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="cog-settings__actions">
                <Button variant="ghost" className="cog-settings__grow cog-tone-danger" onClick={killSessions}>
                  <Icon name="circle-x" size={14} />Kill all sessions
                </Button>
                <Button className="cog-settings__grow" onClick={regenerate}>
                  <Icon name="refresh-cw" size={14} />Regenerate token
                </Button>
              </div>
            </>
          )}
        </section>

        {/* Telegram Bot section */}
        <section ref={sectionRef('telegram')} data-settings-section="telegram" className="cog-settings__section">
          <TelegramSection />
        </section>

        {/* Agent Autonomy section */}
        <section ref={sectionRef('autonomy')} data-settings-section="autonomy" className="cog-settings__section">
          <AutonomySettings projectName={projectName} />
        </section>

        {/* Stream Deck section */}
        <section ref={sectionRef('streamdeck')} data-settings-section="streamdeck" className="cog-settings__section">
          <StreamDeckSection />
        </section>
      </div>
    </Dialog>
  )
}

const THRESHOLD_OPTIONS: { value: NotificationThreshold; label: string }[] = [
  { value: 'low', label: 'Everything' },
  { value: 'normal', label: 'Normal & up' },
  { value: 'high', label: 'High & up' },
  { value: 'urgent', label: 'Urgent only' },
  { value: 'none', label: 'Nothing (off)' }
]

function TelegramSection(): React.ReactElement {
  const [status, setStatus] = React.useState<TelegramStatus | null>(null)
  const [showTokenInput, setShowTokenInput] = React.useState(false)
  const [tokenInput, setTokenInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [threshold, setThreshold] = React.useState<NotificationThreshold>('low')
  const [topicsStatus, setTopicsStatus] = React.useState<TelegramTopicsStatus | null>(null)

  React.useEffect(() => {
    void window.electronAPI.getTelegramStatus().then(setStatus)
    void window.electronAPI.getSettings().then(s => {
      const t = s.telegramNotifyThreshold
      if (typeof t === 'string') setThreshold(t as NotificationThreshold)
    })
    void window.electronAPI.getTelegramTopicsStatus?.().then(setTopicsStatus)
    const off = window.electronAPI.onTelegramStatusUpdate(setStatus)
    return () => off()
  }, [])

  const changeThreshold = async (t: NotificationThreshold) => {
    setThreshold(t)
    await window.electronAPI.setSetting('telegramNotifyThreshold', t)
  }

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 2500)
  }

  // IPC rejections arrive as "Error invoking remote method 'x': Error: <real message>"
  const ipcError = (err: unknown): string =>
    (err instanceof Error ? err.message : String(err)).replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')

  const saveToken = async () => {
    const token = tokenInput.trim()
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      // Validated against Telegram before it's persisted — a typo can't
      // clobber a working token.
      await window.electronAPI.setTelegramToken(token)
      setTokenInput('')
      setShowTokenInput(false)
      flash('Token verified and saved')
    } catch (err) {
      setError(`Token rejected: ${ipcError(err)}`)
    }
    setBusy(false)
  }

  const toggleBot = async () => {
    if (!status?.hasToken || busy) return
    setBusy(true)
    setError(null)
    try {
      if (status.enabled) await window.electronAPI.disableTelegram()
      else await window.electronAPI.enableTelegram()
    } catch (err) {
      setError(ipcError(err))
    }
    setBusy(false)
  }

  const generateCode = async () => {
    setError(null)
    await window.electronAPI.getTelegramPairingCode()
    // The status-update event delivers the new code; no local state needed.
  }

  const unpair = async (id: number) => {
    if (!confirm(`Unpair Telegram account ${id}? It will lose access to your agents.`)) return
    await window.electronAPI.unpairTelegram(id)
  }

  return (
    <>
      <SectionHeader>
        Telegram bot <span className="cog-settings__exp cog-tone-warning">(experimental)</span>
      </SectionHeader>
      <p className="cog-settings__intro">
        Drive your agents from your phone: <span className="cog-mono">/status</span>, <span className="cog-mono">/use</span>, <span className="cog-mono">/msg</span>, <span className="cog-mono">/output</span>, <span className="cog-mono">/task</span> — and agent replies
        land in your chat. Create a bot with @BotFather in Telegram, paste its token, then pair.
        Works in direct messages only.
      </p>

      {/* Bot token */}
      <SettingItem
        label="Bot token"
        help={status?.hasToken ? 'Saved (stored encrypted)' : 'Paste the token from @BotFather'}
      >
        {showTokenInput ? (
          <>
            <Input
              type="password"
              mono
              className="cog-settings__token"
              aria-label="Bot token"
              autoFocus
              placeholder="123456:ABC-DEF…"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveToken()
                if (e.key === 'Escape') { setShowTokenInput(false); setTokenInput('') }
              }}
            />
            <Button
              onClick={saveToken}
              disabled={!tokenInput.trim() || busy}
            >{busy ? '…' : 'Save'}</Button>
          </>
        ) : (
          <Button onClick={() => setShowTokenInput(true)}>{status?.hasToken ? 'Change' : 'Set token'}</Button>
        )}
      </SettingItem>

      {/* Enable toggle */}
      <SettingCheck
        checked={!!status?.enabled}
        disabled={!status?.hasToken}
        onChange={() => { void toggleBot() }}
        label="Enable Telegram bot"
        help={status?.enabled ? 'Running — long-polling Telegram (no tunnel needed)' : 'Bot is off'}
      />

      {/* Which inbox priorities get pushed to Telegram */}
      <SettingItem label="Send to Telegram when" help="Mirror inbox messages at or above this urgency to your phone.">
        <Select
          value={threshold}
          options={THRESHOLD_OPTIONS}
          ariaLabel="Send to Telegram when"
          onChange={t => changeThreshold(t)}
        />
      </SettingItem>

      {/* Pairing — only meaningful while the bot is running */}
      {status?.enabled && (
        <>
          <SettingItem label="Pair a phone" help="Code is single-use and expires in 10 minutes">
            {status.activePairingCode ? (
              <span className="cog-settings__code">{status.activePairingCode}</span>
            ) : (
              <Button onClick={generateCode}>Generate code</Button>
            )}
          </SettingItem>
          {status.activePairingCode && (
            <span className="cog-settings__help">
              Message your bot in Telegram: <span className="cog-mono cog-settings__ink">/pair {status.activePairingCode}</span>
            </span>
          )}
        </>
      )}

      {/* Paired accounts — shown even while the bot is off so unpair always works */}
      {status && status.pairedIds.length > 0 && (
        <div className="cog-settings__urlfield">
          <span className="cog-settings__fieldlabel">Linked Telegram accounts</span>
          <div className="cog-dialog__list">
            {status.pairedIds.map(id => (
              <Row
                key={id}
                title={<span className="cog-mono">{id}</span>}
                actions={
                  <Button variant="ghost" className="cog-tone-danger" onClick={() => unpair(id)}>Unpair</Button>
                }
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="cog-settings__msg cog-settings__msg--danger" role="alert">
          <Icon name="circle-alert" size={14} />{error}
        </div>
      )}
      {notice && (
        <div className="cog-settings__msg cog-settings__msg--success" role="status">
          <Icon name="circle-check" size={14} />{notice}
        </div>
      )}

      {/* Multi-instance guidance + optional supergroup setup */}
      <details className="cog-settings__details">
        <summary>
          Running multiple Cogs on one bot? (read this)
        </summary>
        <div className="cog-settings__detailsbody">
          <div>
            You can run several Cog windows (different projects) on the same bot. They coordinate
            automatically: exactly one polls Telegram so <b>no messages get missed</b>, every relayed
            message is tagged <span className="cog-mono cog-settings__ink">[Project]</span>,
            and you pick which one you're talking to:
          </div>
          <div className="cog-settings__cmds">
            <div><span className="cog-mono cog-settings__ink">/status</span> — every Cog + its agents</div>
            <div><span className="cog-mono cog-settings__ink">/cog &lt;project&gt;</span> — switch which Cog your messages go to</div>
          </div>
          <div>
            <b>Want threaded separation instead of one DM?</b> Telegram supergroups
            with Topics give each project its own thread. To set it up: create a group → open its settings →
            turn on <b>Topics</b> → add your bot and make it an <b>admin</b> with <i>Manage Topics</i>.
            (DM mode above needs no setup and is the default.)
          </div>

          {/* Telegram — per-workspace threads */}
          <div className="cog-settings__threads">
            <h4 className="cog-settings__sub">Telegram — per-workspace threads</h4>
            <div>
              Topics mode:{' '}
              {topicsStatus == null
                ? 'checking…'
                : topicsStatus.mode === 'topics'
                  ? <span className="cog-tone-success">bound to supergroup <span className="cog-mono">{topicsStatus.supergroupChatId}</span> <Icon name="check" size={12} /></span>
                  : <span className="cog-settings__ink">DM mode</span>}
            </div>
            <div>
              Give each workspace its own thread in one Telegram group instead of one shared DM:
              <ol>
                <li>Create a Telegram <b>supergroup</b> and turn on <b>Topics</b> (Group Settings → Topics).</li>
                <li>Add your Cog bot as an <b>admin</b> with the <b>Manage Topics</b> permission.</li>
                <li>In the group, send <code>/bind</code>. Each workspace then gets its own topic; closing a workspace archives its thread.</li>
                <li>Send <code>/unbind</code> anytime to go back to direct messages.</li>
              </ol>
            </div>
          </div>
        </div>
      </details>
    </>
  )
}

const WHISPER_OPTIONS = [
  { value: 'cloud' as const, label: 'Cloud (OpenAI Whisper)' },
  { value: 'local' as const, label: 'Local (Whisper.cpp)' },
  { value: 'disabled' as const, label: 'Disabled' }
]

function StreamDeckSection(): React.ReactElement {
  const [sdSettings, setSdSettings] = React.useState<{ enabled: boolean; whisperBackend: 'cloud' | 'local' | 'disabled'; openaiApiKey?: string }>({ enabled: true, whisperBackend: 'cloud' })
  const [showKey, setShowKey] = React.useState(false)
  const [connection, setConnection] = React.useState<'connected' | 'disconnected' | 'unknown'>('unknown')
  const [localProgress, setLocalProgress] = React.useState<{ stage: string; percent: number; detail?: string } | null>(null)

  React.useEffect(() => {
    void electronAPI.getSettings().then((all: Record<string, unknown>) => {
      const s = all.streamdeck as typeof sdSettings | undefined
      if (s) setSdSettings(prev => ({ ...prev, ...s }))
    })
    void window.electronAPI.getStreamDeckStatus?.().then((s: 'connected' | 'disconnected') => setConnection(s))

    // Subscribe to local Whisper setup progress events.
    const off = window.electronAPI.onLocalWhisperProgress?.((evt) => setLocalProgress(evt))
    return () => off?.()
  }, [])

  const update = async (patch: Partial<typeof sdSettings>) => {
    const next = { ...sdSettings, ...patch }
    setSdSettings(next)
    await electronAPI.setSetting('streamdeck', next)
    // When user switches TO local, kick off setup. The handler is idempotent —
    // if everything is already in place, fires a single ready event and returns.
    if (patch.whisperBackend === 'local') {
      setLocalProgress({ stage: 'model', percent: 0, detail: 'Checking local Whisper setup…' })
      void window.electronAPI.prepareLocalWhisper?.()
    } else if (patch.whisperBackend !== undefined) {
      // Switched away from local — clear the bar
      setLocalProgress(null)
    }
  }

  const fillCls = localProgress?.stage === 'error'
    ? 'cog-meter__fill cog-meter__fill--danger'
    : localProgress?.stage === 'ready' ? 'cog-meter__fill cog-meter__fill--success' : 'cog-meter__fill'

  return (
    <>
      <SectionHeader>Stream Deck</SectionHeader>

      <SettingCheck
        checked={sdSettings.enabled}
        onChange={() => void update({ enabled: !sdSettings.enabled })}
        label="Enable Stream Deck integration"
        help="Connect a Stream Deck MK.2 for hardware controls"
      />

      <SettingItem label="Voice transcription" stack>
        <Segmented
          value={sdSettings.whisperBackend}
          options={WHISPER_OPTIONS}
          ariaLabel="Voice transcription"
          // A radio fired only on a change: re-picking the current backend does nothing.
          onChange={opt => { if (opt !== sdSettings.whisperBackend) void update({ whisperBackend: opt }) }}
        />
      </SettingItem>

      {sdSettings.whisperBackend === 'local' && localProgress && (
        <div className="cog-settings__form cog-settings__progress">
          <div className="cog-usage__barline">
            <span className={localProgress.stage === 'error' ? 'cog-tone-danger' : localProgress.stage === 'ready' ? 'cog-tone-success' : undefined}>
              {localProgress.stage === 'ready'
                ? 'Local Whisper ready'
                : localProgress.stage === 'error'
                  ? 'Setup failed'
                  : localProgress.stage === 'model'
                    ? 'Downloading model'
                    : localProgress.stage === 'configure'
                      ? 'Configuring CMake'
                      : 'Building whisper.cpp'}
            </span>
            <span className="cog-mono">{localProgress.percent}%</span>
          </div>
          <div className="cog-meter">
            <div className={fillCls} style={{ width: `${localProgress.percent}%` }} />
          </div>
          {localProgress.detail && (
            <div className="cog-settings__detail">
              {localProgress.detail}
            </div>
          )}
          {localProgress.stage === 'error' && (
            <Button
              className="cog-settings__start"
              onClick={() => {
                setLocalProgress({ stage: 'model', percent: 0, detail: 'Retrying…' })
                void window.electronAPI.prepareLocalWhisper?.()
              }}
            ><Icon name="refresh-cw" size={14} />Retry</Button>
          )}
        </div>
      )}

      {sdSettings.whisperBackend === 'cloud' && (
        <SettingItem label="OpenAI API key" className="cog-settings__item--wide">
          <Input
            type={showKey ? 'text' : 'password'}
            mono
            className="cog-settings__grow"
            aria-label="OpenAI API key"
            value={sdSettings.openaiApiKey ?? ''}
            onChange={e => void update({ openaiApiKey: e.target.value })}
            placeholder="sk-…"
          />
          <Button variant="ghost" onClick={() => setShowKey(v => !v)}>{showKey ? 'Hide' : 'Show'}</Button>
        </SettingItem>
      )}

      <SettingItem
        label="Connection"
        help={
          <span className={connection === 'connected' ? 'cog-settings__status cog-tone-success' : connection === 'disconnected' ? 'cog-settings__status cog-tone-danger' : 'cog-settings__status'}>
            <Icon name={connection === 'connected' ? 'circle-check' : connection === 'disconnected' ? 'circle-x' : 'circle'} size={12} />
            {connection}
          </span>
        }
      >
        <Button onClick={() => window.electronAPI.reconnectStreamDeck?.()}>
          <Icon name="refresh-cw" size={14} />Reconnect
        </Button>
      </SettingItem>
    </>
  )
}
