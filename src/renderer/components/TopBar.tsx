import React, { useState, useRef, useEffect } from 'react'
import { TabBar } from './TabBar'
import type { AgentState, KilledAgentSummary } from '../../shared/types'
import { formatKilledAt } from '../killed-agents'
import type { ViewMode } from '../mosaic-store'
import { Button, CogMark, Icon, Menu, MenuItem, MenuSeparator, Segmented, StatusChip, type IconName } from '../ui'
import { topbarLabels } from '../topbar-layout'

interface TopBarProps {
  projectName: string | null
  onSwitchProject: () => void
  agents: AgentState[]
  onSpawnClick: () => void
  onAgentClick: (agentId: string) => void
  onClearContext: (agentId: string) => void
  onDisconnectAgent: (agentName: string) => void
  onKillAgent: (agentId: string) => void
  /** Agents killed in this workspace (newest first) and what to do with them. */
  killedAgents: KilledAgentSummary[]
  onAgentMenuOpen: () => void
  onRestoreAgent: (agentId: string) => void
  onForgetKilled: (agentId: string) => void
  pinboardOpen: boolean
  onTogglePinboard: () => void
  infoOpen: boolean
  onToggleInfo: () => void
  filesOpen: boolean
  onToggleFiles: () => void
  racOpen: boolean
  onToggleRac: () => void
  usageOpen: boolean
  onToggleUsage: () => void
  gitOpen: boolean
  onToggleGit: () => void
  schedulesOpen: boolean
  onToggleSchedules: () => void
  trollboxOpen: boolean
  onToggleTrollbox: () => void
  inboxOpen: boolean
  onToggleInbox: () => void
  inboxUnreadCount: number
  onPresetsClick: () => void
  onBugReport: () => void
  onSettingsClick: () => void
  onHelpMcpToolsClick: () => void
  groups: Array<{ id: string; color: string; members: string[] }>
  onLinkDragStart: (agentName: string, e: React.MouseEvent) => void
  linkDraggingFrom: string | null
  tabs: Array<{ id: string; name: string }>
  activeTabId: string
  onSwitchTab: (tabId: string) => void
  onCreateTab: () => void
  onCloseTab: (tabId: string) => void
  onRenameTab: (tabId: string, name: string) => void
  boardOpen?: boolean
  onToggleBoard?: () => void
  viewMode: ViewMode
  onToggleViewMode: () => void
  appearanceOpen: boolean
  onToggleAppearance: () => void
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

const BAR_ICON = 15

export function TopBar({
  projectName, onSwitchProject, agents, onSpawnClick, onAgentClick,
  onClearContext, onDisconnectAgent, onKillAgent,
  killedAgents, onAgentMenuOpen, onRestoreAgent, onForgetKilled,
  pinboardOpen, onTogglePinboard, infoOpen, onToggleInfo,
  filesOpen, onToggleFiles,
  racOpen, onToggleRac, usageOpen, onToggleUsage,
  gitOpen, onToggleGit, schedulesOpen, onToggleSchedules,
  trollboxOpen, onToggleTrollbox,
  inboxOpen, onToggleInbox, inboxUnreadCount,
  onPresetsClick, onBugReport, onSettingsClick, onHelpMcpToolsClick,
  groups,
  tabs, activeTabId, onSwitchTab, onCreateTab, onCloseTab, onRenameTab,
  boardOpen, onToggleBoard,
  viewMode, onToggleViewMode,
  appearanceOpen, onToggleAppearance
}: TopBarProps): React.ReactElement {
  const [agentMenuOpen, setAgentMenuOpen] = useState(false)
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [panelMenu, setPanelMenu] = useState(false)
  const [helpMenu, setHelpMenu] = useState(false)
  const agentsBtn = useRef<HTMLButtonElement>(null)
  const panelsBtn = useRef<HTMLButtonElement>(null)
  const helpBtn = useRef<HTMLButtonElement>(null)
  const labels = topbarLabels(useWindowWidth())

  const closeAgentMenu = () => { setAgentMenuOpen(false); setExpandedAgent(null) }

  const activePanelCount = [pinboardOpen, infoOpen, filesOpen, racOpen, usageOpen, gitOpen, schedulesOpen, trollboxOpen, inboxOpen, boardOpen].filter(Boolean).length

  const panelRows: Array<{ label: string; icon: IconName; open: boolean; onClick: () => void; badge?: number; divider?: boolean }> = [
    { label: 'Git', icon: 'git-branch', open: gitOpen, onClick: onToggleGit },
    { label: 'Files', icon: 'file-text', open: filesOpen, onClick: onToggleFiles },
    { label: 'Pinboard', icon: 'pin', open: pinboardOpen, onClick: onTogglePinboard },
    { label: 'Info channel', icon: 'radio', open: infoOpen, onClick: onToggleInfo },
    { label: 'Usage', icon: 'gauge', open: usageOpen, onClick: onToggleUsage },
    { label: 'R.A.C.', icon: 'messages-square', open: racOpen, onClick: onToggleRac },
    { label: 'Schedules', icon: 'calendar-clock', open: schedulesOpen, onClick: onToggleSchedules, divider: true },
    { label: 'Trollbox', icon: 'popcorn', open: trollboxOpen, onClick: onToggleTrollbox },
    { label: 'Inbox', icon: 'inbox', open: inboxOpen, onClick: onToggleInbox, badge: inboxUnreadCount },
    { label: 'Sketchpad', icon: 'book-open', open: !!boardOpen, onClick: onToggleBoard ?? (() => {}) }
  ]

  // Icon-only controls keep their word as tooltip and accessible name.
  const named = (word: string, shown: boolean) => (shown ? {} : { 'aria-label': word, title: word })

  return (
    <header className="cog-topbar">
      {/* Left: mark, project, workspace tabs */}
      <div className="cog-topbar__group cog-topbar__left">
        <div className="cog-topbar__mark">
          <CogMark size={20} />
          <h1>Cog</h1>
        </div>
        <span className="cog-topbar__sep" aria-hidden="true" />
        {projectName && (
          <Button variant="ghost" className="cog-topbar__project" onClick={onSwitchProject} title="Switch Project">
            <Icon name="folder" size={BAR_ICON} />
            <span>{projectName}</span>
          </Button>
        )}
        {projectName && <span className="cog-topbar__sep" aria-hidden="true" />}
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitchTab={onSwitchTab}
          onCreateTab={onCreateTab}
          onCloseTab={onCloseTab}
          onRenameTab={onRenameTab}
        />
      </div>

      {/* Middle: spawn, agents, view */}
      <div className="cog-topbar__group cog-topbar__mid">
        <Button variant="hint" onClick={onSpawnClick}>
          <Icon name="plus" size={BAR_ICON} />
          Spawn agent
        </Button>

        <div className="cog-menu-wrap">
          <Button
            ref={agentsBtn}
            className="cog-topbar__counted"
            aria-haspopup="menu"
            aria-expanded={agentMenuOpen}
            aria-label={`Agents, ${agents.length} running`}
            onClick={() => { const next = !agentMenuOpen; setAgentMenuOpen(next); setExpandedAgent(null); if (next) onAgentMenuOpen() }}
          >
            <Icon name="bot" size={BAR_ICON} />
            <span>Agents</span>
            <span className="cog-count" aria-hidden="true">{agents.length}</span>
          </Button>
          {/* Stays open on outside presses, as before: a link can be dragged onto a row. */}
          <Menu open={agentMenuOpen} onClose={closeAgentMenu} anchorRef={agentsBtn} label="Agents" closeOnOutside={false} className="cog-menu--agents">
            {agents.length === 0 && <div className="cog-menu__note">No agents running</div>}
            {agents.map(agent => {
              const groupColor = groups.find(g => g.members.includes(agent.name))?.color
              const expanded = expandedAgent === agent.id
              return (
                <div key={agent.id} data-agent-name={agent.name}>
                  <button
                    type="button"
                    role="menuitem"
                    aria-expanded={expanded}
                    className="cog-menu__item"
                    onClick={() => setExpandedAgent(expanded ? null : agent.id)}
                  >
                    <StatusChip status={agent.status} />
                    {groupColor && <span className="cog-menu__swatch" style={{ background: groupColor }} title="Link group" />}
                    <span className="cog-menu__name">{agent.name}</span>
                    <span className="cog-menu__role">{agent.role}</span>
                    <span className="cog-menu__chev" aria-hidden="true"><Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} /></span>
                  </button>
                  {expanded && (
                    <div className="cog-menu__actions">
                      <Button variant="ghost" role="menuitem" onClick={() => { onAgentClick(agent.id); closeAgentMenu() }}>
                        <Icon name="crosshair" size={14} />Focus window
                      </Button>
                      <Button variant="ghost" role="menuitem" onClick={() => { onClearContext(agent.id); closeAgentMenu() }}>
                        <Icon name="eraser" size={14} />Clear context
                      </Button>
                      <Button variant="ghost" role="menuitem" onClick={() => { onDisconnectAgent(agent.name); closeAgentMenu() }}>
                        <Icon name="unplug" size={14} />Disconnect links
                      </Button>
                      <Button variant="ghost" role="menuitem" className="cog-tone-danger" onClick={() => { onKillAgent(agent.id); closeAgentMenu() }}>
                        <Icon name="circle-x" size={14} />Kill agent
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
            {killedAgents.length > 0 && (
              <div data-killed-list>
                <MenuSeparator />
                <div className="cog-menu__heading">Killed · {killedAgents.length}</div>
                {killedAgents.map(k => (
                  <div key={k.id} data-killed-agent={k.name} className="cog-killed">
                    <span className="cog-killed__name"
                      title={`${k.role} · ${k.cli} · killed ${new Date(k.killedAt).toLocaleString()}${k.resumable ? ' · session resumes on restore' : ''}`}>
                      {k.name}
                    </span>
                    <span className="cog-killed__when">{formatKilledAt(k.killedAt)}</span>
                    <Button variant="ghost" role="menuitem" className="cog-tone-success" onClick={() => { onRestoreAgent(k.id); closeAgentMenu() }}
                      title="Spawn it again; a Claude session resumes">Restore</Button>
                    <Button variant="ghost" role="menuitem" onClick={() => onForgetKilled(k.id)}
                      title="Remove from this list">Forget</Button>
                  </div>
                ))}
              </div>
            )}
          </Menu>
        </div>

        <span title="Toggle view (Ctrl+Shift+M)">
          <Segmented<ViewMode>
            ariaLabel="View mode"
            value={viewMode}
            onChange={mode => { if (mode !== viewMode) onToggleViewMode() }}
            options={[
              { value: 'canvas', label: 'Canvas', icon: 'network' },
              { value: 'mosaic', label: 'Mosaic', icon: 'grid' }
            ]}
          />
        </span>
      </div>

      {/* Right: panels, presets, help, bug, settings, terminal appearance */}
      <div className="cog-topbar__group cog-topbar__right">
        <span className="cog-topbar__sep" aria-hidden="true" />

        <div className="cog-menu-wrap">
          <Button
            ref={panelsBtn}
            variant="ghost"
            className={activePanelCount > 0 ? 'cog-topbar__counted' : undefined}
            aria-haspopup="menu"
            aria-expanded={panelMenu}
            aria-label={activePanelCount > 0 ? `Panels, ${activePanelCount} open` : 'Panels'}
            title={labels.panels ? undefined : 'Panels'}
            onClick={() => setPanelMenu(!panelMenu)}
          >
            <Icon name="panels" size={BAR_ICON} />
            {labels.panels && <span>Panels</span>}
            {activePanelCount > 0 && <span className="cog-count" aria-hidden="true">{activePanelCount}</span>}
          </Button>
          <Menu open={panelMenu} onClose={() => setPanelMenu(false)} anchorRef={panelsBtn} label="Panels" align="right">
            {panelRows.map(row => (
              <React.Fragment key={row.label}>
                {row.divider && <MenuSeparator />}
                <MenuItem
                  icon={row.icon}
                  checked={row.open}
                  onClick={() => { row.onClick(); setPanelMenu(false) }}
                  trailing={row.badge ? <span className="cog-menu__badge" aria-label={`${row.badge} unread`}>{row.badge}</span> : undefined}
                >
                  {row.label}
                </MenuItem>
              </React.Fragment>
            ))}
          </Menu>
        </div>

        <Button variant="ghost" onClick={onPresetsClick} {...named('Presets', labels.presets)}>
          <Icon name="bookmark" size={BAR_ICON} />
          {labels.presets && 'Presets'}
        </Button>

        <div className="cog-menu-wrap">
          <Button
            ref={helpBtn}
            variant="ghost"
            aria-haspopup="menu"
            aria-expanded={helpMenu}
            onClick={() => setHelpMenu(!helpMenu)}
            {...named('Help', labels.help)}
          >
            <Icon name="help" size={BAR_ICON} />
            {labels.help && 'Help'}
          </Button>
          <Menu open={helpMenu} onClose={() => setHelpMenu(false)} anchorRef={helpBtn} label="Help" align="right">
            <MenuItem icon="wrench" onClick={() => { onHelpMcpToolsClick(); setHelpMenu(false) }}>MCP Tools Reference</MenuItem>
          </Menu>
        </div>

        <Button variant="icon" className="cog-btn--ghost" onClick={onBugReport} aria-label="Report a bug" title="Report a bug">
          <Icon name="bug" size={BAR_ICON} />
        </Button>
        <Button variant="icon" className="cog-btn--ghost" onClick={onSettingsClick} aria-label="Settings" title="Settings">
          <Icon name="settings" size={BAR_ICON} />
        </Button>

        <Button
          id="appearance-toggle"
          aria-expanded={appearanceOpen}
          aria-controls="appearance-drawer"
          onClick={onToggleAppearance}
          {...named('Terminal appearance', labels.appearance)}
        >
          <Icon name="palette" size={BAR_ICON} />
          {labels.appearance && 'Terminal appearance'}
        </Button>
      </div>
    </header>
  )
}
