import React, { useState } from 'react'
import { Button, Icon } from '../ui'

interface Tab {
  id: string
  name: string
  projectPath?: string
}

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string
  onSwitchTab: (tabId: string) => void
  onCreateTab: () => void
  onCloseTab: (tabId: string) => void
  onRenameTab: (tabId: string, name: string) => void
}

export function TabBar({ tabs, activeTabId, onSwitchTab, onCreateTab, onCloseTab, onRenameTab }: TabBarProps): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const startRename = (tab: Tab) => {
    setEditingId(tab.id)
    setEditName(tab.name)
  }

  const confirmRename = () => {
    if (editingId && editName.trim()) {
      onRenameTab(editingId, editName.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="cog-tabs" role="tablist" aria-label="Workspaces">
      {tabs.map(tab => {
        const active = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className="cog-tab"
            onClick={() => onSwitchTab(tab.id)}
            onKeyDown={e => {
              if (e.target !== e.currentTarget) return
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitchTab(tab.id) }
            }}
            title={tab.projectPath ? `Folder: ${tab.projectPath}` : `${tab.name} — double-click to rename; use + to add a folder-bound workspace`}
          >
            {tab.projectPath && <Icon name="folder" size={14} />}
            {editingId === tab.id ? (
              <input
                className="cog-tab__input"
                aria-label="Workspace name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={confirmRename}
                onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditingId(null) }}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span
                className="cog-tab__name"
                onDoubleClick={(e) => { e.stopPropagation(); startRename(tab) }}
              >
                {tab.name}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                type="button"
                className="cog-tab__close"
                tabIndex={-1}
                aria-label={`Close ${tab.name}`}
                title="Close workspace"
                onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id) }}
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        )
      })}
      <Button
        variant="icon"
        className="cog-btn--ghost"
        onClick={onCreateTab}
        aria-label="New workspace"
        title="New workspace — pick a project folder for its team"
      >
        <Icon name="plus" size={15} />
      </Button>
    </div>
  )
}
