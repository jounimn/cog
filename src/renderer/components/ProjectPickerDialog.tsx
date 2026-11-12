import React, { useState, useEffect } from 'react'
import type { RecentProject } from '../../shared/types'
import { Button, Dialog, EmptyState, Icon } from '../ui'

declare const electronAPI: {
  listRecentProjects: () => Promise<RecentProject[]>
  openFolderDialog: () => Promise<string | null>
  switchProject: (path: string) => Promise<RecentProject>
}

interface ProjectPickerDialogProps {
  isFullScreen: boolean
  onProjectOpened: (project: RecentProject) => void
  onCancel?: () => void
}

export function ProjectPickerDialog({ isFullScreen, onProjectOpened, onCancel }: ProjectPickerDialogProps): React.ReactElement {
  const [recent, setRecent] = useState<RecentProject[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    electronAPI.listRecentProjects().then(setRecent)
  }, [])

  const handleOpenFolder = async () => {
    const folderPath = await electronAPI.openFolderDialog()
    if (!folderPath) return
    setLoading(true)
    const project = await electronAPI.switchProject(folderPath)
    onProjectOpened(project)
  }

  const handleSelectRecent = async (projectPath: string) => {
    setLoading(true)
    const project = await electronAPI.switchProject(projectPath)
    onProjectOpened(project)
  }

  return (
    <Dialog
      title={isFullScreen ? 'Open a project' : 'Switch project'}
      icon="folder-open"
      size="sm"
      zIndex={9999}
      opaque={isFullScreen}
      onClose={onCancel}
    >
      <Button variant="ghost" className="cog-picker__open" onClick={handleOpenFolder} disabled={loading}>
        <Icon name="folder-open" size={14} />Open Folder...
      </Button>

      {recent.length > 0 && (
        <div className="cog-picker__recent">
          <span className="cog-field__label cog-picker__label">Recent projects</span>
          <div className="cog-dialog__list cog-picker__list">
            {recent.map(project => (
              <button
                key={project.path}
                type="button"
                className="cog-row cog-row--action"
                onClick={() => handleSelectRecent(project.path)}
                disabled={loading}
                title={project.path}
              >
                <span className="cog-row__icon"><Icon name="folder" size={14} /></span>
                <span className="cog-row__title">{project.name}</span>
                <span className="cog-row__line2">
                  <span className="cog-row__meta">{project.path}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recent.length === 0 && (
        <EmptyState icon="folder" compact>
          No recent projects. Open a folder to get started.
        </EmptyState>
      )}
    </Dialog>
  )
}
