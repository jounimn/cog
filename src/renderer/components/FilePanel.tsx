import React, { useState, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { Button, Icon, EmptyState, SectionHeader } from '../ui'

interface FileEntry {
  name: string
  type: 'file' | 'directory'
  path: string
}

interface OpenFile {
  path: string
  name: string
  content: string
  dirty: boolean
}

declare const electronAPI: {
  listFiles: (dirPath?: string) => Promise<{ path: string; items: FileEntry[] }>
  readFile: (filePath: string) => Promise<{ path: string; content: string } | null>
  writeFile: (filePath: string, content: string) => Promise<boolean>
}

// Detect language from file extension
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', md: 'markdown', css: 'css', scss: 'scss',
    html: 'html', xml: 'xml', yaml: 'yaml', yml: 'yaml',
    py: 'python', rs: 'rust', go: 'go', java: 'java',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    sql: 'sql', graphql: 'graphql', toml: 'toml',
  }
  return map[ext ?? ''] ?? 'plaintext'
}

// --- Tree Node Component ---
function TreeNode({ entry, depth, onFileClick }: {
  entry: FileEntry
  depth: number
  onFileClick: (path: string) => void
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const handleToggle = async (): Promise<void> => {
    if (entry.type === 'file') {
      onFileClick(entry.path)
      return
    }
    if (!loaded) {
      const result = await electronAPI.listFiles(entry.path)
      setChildren(result.items)
      setLoaded(true)
    }
    setExpanded(!expanded)
  }

  const isDir = entry.type === 'directory'
  return (
    <div>
      <button
        type="button"
        className="cog-tree__item"
        onClick={handleToggle}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={entry.path}
        aria-expanded={isDir ? expanded : undefined}
      >
        <span className="cog-tree__chev" aria-hidden="true">
          {isDir && <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={14} />}
        </span>
        <span className="cog-tree__kind" aria-hidden="true">
          <Icon name={isDir ? (expanded ? 'folder-open' : 'folder') : 'file'} size={14} />
        </span>
        <span className="cog-tree__name">{entry.name}</span>
      </button>
      {expanded && children.map(child => (
        <TreeNode key={child.path} entry={child} depth={depth + 1} onFileClick={onFileClick} />
      ))}
    </div>
  )
}

// --- Main FilePanel Component ---
export function FilePanel(): React.ReactElement {
  const [rootFiles, setRootFiles] = useState<FileEntry[]>([])
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)

  useEffect(() => {
    electronAPI.listFiles('.').then(result => setRootFiles(result.items))
  }, [])

  const openFile = useCallback(async (filePath: string) => {
    // Check if already open
    const existing = openFiles.find(f => f.path === filePath)
    if (existing) {
      setActiveTab(filePath)
      return
    }

    const result = await electronAPI.readFile(filePath)
    if (!result) return

    const name = filePath.split('/').pop() || filePath
    setOpenFiles(prev => [...prev, { path: filePath, name, content: result.content, dirty: false }])
    setActiveTab(filePath)
  }, [openFiles])

  const closeTab = useCallback((filePath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenFiles(prev => prev.filter(f => f.path !== filePath))
    if (activeTab === filePath) {
      setActiveTab(openFiles.length > 1 ? openFiles.find(f => f.path !== filePath)?.path ?? null : null)
    }
  }, [activeTab, openFiles])

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeTab || value === undefined) return
    setOpenFiles(prev => prev.map(f =>
      f.path === activeTab ? { ...f, content: value, dirty: true } : f
    ))
  }, [activeTab])

  const saveFile = useCallback(async () => {
    if (!activeTab) return
    const file = openFiles.find(f => f.path === activeTab)
    if (!file || !file.dirty) return

    const success = await electronAPI.writeFile(file.path, file.content)
    if (success) {
      setOpenFiles(prev => prev.map(f =>
        f.path === activeTab ? { ...f, dirty: false } : f
      ))
    }
  }, [activeTab, openFiles])

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        saveFile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveFile])

  const activeFile = openFiles.find(f => f.path === activeTab)

  return (
    <div className="cog-panel cog-files">
      {/* File tree sidebar */}
      <div className="cog-files__tree">
        <SectionHeader>Explorer</SectionHeader>
        {rootFiles.map(entry => (
          <TreeNode key={entry.path} entry={entry} depth={0} onFileClick={openFile} />
        ))}
      </div>

      {/* Editor area */}
      <div className="cog-files__main">
        {/* Tabs */}
        {openFiles.length > 0 && (
          <div className="cog-ftabs" role="tablist" aria-label="Open files">
            {openFiles.map(file => (
              <div
                key={file.path}
                role="tab"
                aria-selected={activeTab === file.path}
                className="cog-ftab"
                title={file.path}
                onClick={() => setActiveTab(file.path)}
              >
                {file.dirty && <span className="cog-ftab__dirty" title="Unsaved changes" aria-label="Unsaved changes" />}
                <span>{file.name}</span>
                <Button
                  variant="icon"
                  onClick={e => closeTab(file.path, e)}
                  aria-label={`Close ${file.name}`}
                  title="Close"
                >
                  <Icon name="x" size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Monaco Editor */}
        {activeFile ? (
          <Editor
            height="100%"
            language={getLanguage(activeFile.name)}
            value={activeFile.content}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: 'gutter',
              automaticLayout: true,
            }}
          />
        ) : (
          <EmptyState icon="file-text">Click a file in the explorer to open it here.</EmptyState>
        )}
      </div>
    </div>
  )
}
