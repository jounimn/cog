import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { GitStatus, GitFileStatus, GitLogEntry } from '../../shared/types'
import {
  Button, Icon, Segmented, Menu, MenuItem, Input, Textarea, EmptyState, Loading, Row, Toolbar, SectionHeader
} from '../ui'
import { diffLineKind, fileStatusPresentation, splitPath } from '../git-present'

interface WorktreeRow { slug: string; path: string; branch: string | null; dirty: boolean; agentName: string | null }

declare const electronAPI: {
  gitStatus: () => Promise<GitStatus>
  gitLog: (count?: number) => Promise<GitLogEntry[]>
  gitDiff: (file: string, staged: boolean) => Promise<string>
  gitStage: (file: string) => Promise<{ status?: string; error?: string }>
  gitUnstage: (file: string) => Promise<{ status?: string; error?: string }>
  gitCommit: (message: string) => Promise<{ status?: string; output?: string; error?: string }>
  gitPush: () => Promise<{ status?: string; output?: string; error?: string }>
  gitPull: () => Promise<{ status?: string; output?: string; error?: string }>
  gitBranches: () => Promise<{ current: string; branches: string[] }>
  gitCheckout: (branch: string) => Promise<{ status?: string; error?: string }>
  gitNewBranch: (name: string) => Promise<{ status?: string; error?: string }>
  worktreeList: () => Promise<WorktreeRow[]>
  worktreeRemove: (slug: string, force: boolean) => Promise<{ removed: boolean; detail?: string }>
}

// ── Diff viewer ─────────────────────────────────────────────
function DiffViewer({ diff }: { diff: string }): React.ReactElement {
  return (
    <pre className="cog-diff">
      {diff.split('\n').map((line, i) => {
        const kind = diffLineKind(line)
        return (
          <div key={i} className={kind === 'ctx' ? undefined : `cog-diff__${kind}`}>
            {line}
          </div>
        )
      })}
    </pre>
  )
}

// ── File list item ──────────────────────────────────────────
function FileItem({ file, actionLabel, actionIcon, onAction, onClick, selected }: {
  file: GitFileStatus
  actionLabel: string
  actionIcon: 'plus' | 'minus'
  onAction: () => void
  onClick: () => void
  selected: boolean
}): React.ReactElement {
  const { name, dir } = splitPath(file.path)
  const st = fileStatusPresentation(file.status)
  return (
    <Row
      onClick={onClick}
      selected={selected}
      tooltip={file.path}
      icon={
        <span className={`cog-git__letter cog-tone-${st.tone}`} title={st.label} aria-label={st.label}>
          {st.letter}
        </span>
      }
      title={
        <span className="cog-git__file">
          {name}
          {dir && <span className="cog-git__dir">{dir}</span>}
        </span>
      }
      actions={
        <Button
          variant="icon"
          className="cog-btn--ghost"
          onClick={onAction}
          title={actionLabel}
          aria-label={`${actionLabel} ${file.path}`}
        >
          <Icon name={actionIcon} size={14} />
        </Button>
      }
    />
  )
}

// ── Main GitPanel ───────────────────────────────────────────
export function GitPanel(): React.ReactElement {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [log, setLog] = useState<GitLogEntry[]>([])
  const [viewMode, setViewMode] = useState<'status' | 'log'>('status')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFileStaged, setSelectedFileStaged] = useState(false)
  const [diffContent, setDiffContent] = useState<string>('')
  const [commitMsg, setCommitMsg] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showBranches, setShowBranches] = useState(false)
  const [branches, setBranches] = useState<string[]>([])
  const [newBranchName, setNewBranchName] = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)

  const branchDropdownRef = useRef<HTMLDivElement>(null)
  const branchButtonRef = useRef<HTMLButtonElement>(null)

  const [worktrees, setWorktrees] = useState<WorktreeRow[]>([])

  const refreshWorktrees = useCallback(async () => {
    try {
      setWorktrees(await electronAPI.worktreeList())
    } catch (err) {
      setError(`Failed to list worktrees: ${err}`)
    }
  }, [])

  const removeWorktree = useCallback(async (w: WorktreeRow) => {
    if (w.agentName) return
    let force = false
    if (w.dirty) {
      if (!window.confirm('Worktree has uncommitted changes. Remove anyway?')) return
      force = true
    }
    try {
      const r = await electronAPI.worktreeRemove(w.slug, force)
      if (!r.removed) setError(r.detail ?? `Could not remove ${w.slug}`)
    } catch (err) {
      setError(`Remove failed: ${err}`)
    }
    await refreshWorktrees()
  }, [refreshWorktrees])

  const removeAllClean = useCallback(async () => {
    for (const w of worktrees) {
      if (w.dirty || w.agentName) continue
      try {
        const r = await electronAPI.worktreeRemove(w.slug, false)
        if (!r.removed) setError(r.detail ?? `Could not remove ${w.slug}`)
      } catch (err) {
        setError(`Remove failed: ${err}`)
      }
    }
    await refreshWorktrees()
  }, [worktrees, refreshWorktrees])

  // ── Fetch status ──────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    try {
      const s = await electronAPI.gitStatus()
      setStatus(s)
    } catch (err) {
      setError(`Failed to get git status: ${err}`)
    }
  }, [])

  const refreshLog = useCallback(async () => {
    try {
      const entries = await electronAPI.gitLog(20)
      setLog(entries)
    } catch (err) {
      setError(`Failed to get git log: ${err}`)
    }
  }, [])

  // Load once on mount — no auto-refresh (expensive on large repos)
  useEffect(() => {
    refreshStatus()
    refreshLog()
    refreshWorktrees()
  }, [refreshStatus, refreshLog, refreshWorktrees])

  // Close branch dropdown on outside click
  useEffect(() => {
    if (!showBranches) return
    const handler = (e: MouseEvent): void => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setShowBranches(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showBranches])

  // ── Actions ───────────────────────────────────────────────
  const fetchDiff = useCallback(async (file: string, staged: boolean) => {
    setSelectedFile(file)
    setSelectedFileStaged(staged)
    try {
      const d = await electronAPI.gitDiff(file, staged)
      setDiffContent(d)
    } catch (err) {
      setDiffContent(`Error fetching diff: ${err}`)
    }
  }, [])

  const stageFile = useCallback(async (file: string) => {
    setError(null)
    const result = await electronAPI.gitStage(file)
    if (result.error) setError(result.error)
    await refreshStatus()
    // If we were viewing this file's diff, refresh it
    if (selectedFile === file) fetchDiff(file, true)
  }, [refreshStatus, selectedFile, fetchDiff])

  const unstageFile = useCallback(async (file: string) => {
    setError(null)
    const result = await electronAPI.gitUnstage(file)
    if (result.error) setError(result.error)
    await refreshStatus()
    if (selectedFile === file) fetchDiff(file, false)
  }, [refreshStatus, selectedFile, fetchDiff])

  const stageAll = useCallback(async () => {
    if (!status) return
    setError(null)
    for (const f of status.unstaged) {
      await electronAPI.gitStage(f.path)
    }
    await refreshStatus()
  }, [status, refreshStatus])

  const unstageAll = useCallback(async () => {
    if (!status) return
    setError(null)
    for (const f of status.staged) {
      await electronAPI.gitUnstage(f.path)
    }
    await refreshStatus()
  }, [status, refreshStatus])

  const commit = useCallback(async () => {
    if (!commitMsg.trim() || !status?.staged.length) return
    setError(null)
    setLoading('commit')
    try {
      const result = await electronAPI.gitCommit(commitMsg.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setCommitMsg('')
        setSelectedFile(null)
        setDiffContent('')
      }
      await refreshStatus()
      await refreshLog()
    } catch (err) {
      setError(`Commit failed: ${err}`)
    } finally {
      setLoading(null)
    }
  }, [commitMsg, status, refreshStatus, refreshLog])

  const push = useCallback(async () => {
    setError(null)
    setLoading('push')
    try {
      const result = await electronAPI.gitPush()
      if (result.error) setError(result.error)
      await refreshStatus()
    } catch (err) {
      setError(`Push failed: ${err}`)
    } finally {
      setLoading(null)
    }
  }, [refreshStatus])

  const pull = useCallback(async () => {
    setError(null)
    setLoading('pull')
    try {
      const result = await electronAPI.gitPull()
      if (result.error) setError(result.error)
      await refreshStatus()
      await refreshLog()
    } catch (err) {
      setError(`Pull failed: ${err}`)
    } finally {
      setLoading(null)
    }
  }, [refreshStatus, refreshLog])

  const fetchBranches = useCallback(async () => {
    try {
      const info = await electronAPI.gitBranches()
      setBranches(info.branches)
    } catch (err) {
      setError(`Failed to fetch branches: ${err}`)
    }
  }, [])

  const switchBranch = useCallback(async (branch: string) => {
    setError(null)
    setLoading('checkout')
    setShowBranches(false)
    try {
      const result = await electronAPI.gitCheckout(branch)
      if (result.error) setError(result.error)
      await refreshStatus()
      await refreshLog()
    } catch (err) {
      setError(`Checkout failed: ${err}`)
    } finally {
      setLoading(null)
    }
  }, [refreshStatus, refreshLog])

  const createBranch = useCallback(async () => {
    if (!newBranchName.trim()) return
    setError(null)
    setLoading('new-branch')
    try {
      const result = await electronAPI.gitNewBranch(newBranchName.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setNewBranchName('')
        setShowNewBranch(false)
      }
      await refreshStatus()
      await refreshLog()
    } catch (err) {
      setError(`Create branch failed: ${err}`)
    } finally {
      setLoading(null)
    }
  }, [newBranchName, refreshStatus, refreshLog])

  // ── Not a repo ────────────────────────────────────────────
  if (status && !status.isRepo) {
    return (
      <div className="cog-panel">
        <EmptyState icon="git-branch">
          This project is not a git repository. Changes, history and branches appear here once it is one.
        </EmptyState>
      </div>
    )
  }

  // ── Loading initial status ────────────────────────────────
  if (!status) {
    return (
      <div className="cog-panel">
        <Loading>Loading git status…</Loading>
      </div>
    )
  }

  const canCommit = commitMsg.trim().length > 0 && status.staged.length > 0
  const cancelNewBranch = (): void => { setShowNewBranch(false); setNewBranchName('') }
  const inSync = status.ahead === 0 && status.behind === 0

  return (
    <div className="cog-panel cog-git">
      {/* ── Error banner ─────────────────────────────────── */}
      {error && (
        <div className="cog-banner cog-banner--danger" role="alert">
          <Icon name="circle-alert" size={14} />
          <span className="cog-banner__text" title={error}>{error}</span>
          <Button variant="icon" className="cog-btn--ghost" onClick={() => setError(null)} aria-label="Dismiss error" title="Dismiss">
            <Icon name="x" size={14} />
          </Button>
        </div>
      )}

      {/* ── Branch bar ───────────────────────────────────── */}
      <Toolbar
        label="Git"
        actions={
          <>
            {showNewBranch ? (
              <div className="cog-git__newbranch">
                <Input
                  mono
                  autoFocus
                  value={newBranchName}
                  onChange={e => setNewBranchName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') createBranch()
                    if (e.key === 'Escape') cancelNewBranch()
                  }}
                  placeholder="branch-name"
                  aria-label="New branch name"
                />
                <Button variant="ghost" onClick={createBranch} disabled={loading === 'new-branch'}>
                  {loading === 'new-branch' ? 'Creating…' : 'Create'}
                </Button>
                <Button variant="icon" className="cog-btn--ghost" onClick={cancelNewBranch} aria-label="Cancel new branch" title="Cancel">
                  <Icon name="x" size={14} />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setShowNewBranch(true)} title="New branch">
                <Icon name="plus" size={14} />
                <span>Branch</span>
              </Button>
            )}
            <Button
              variant="icon"
              className="cog-btn--ghost"
              onClick={() => { refreshStatus(); refreshLog(); refreshWorktrees() }}
              aria-label="Refresh"
              title="Refresh"
            >
              <Icon name="refresh-cw" size={14} />
            </Button>
            <Button variant="ghost" onClick={pull} disabled={loading === 'pull'} title="Pull">
              <Icon name="arrow-down" size={14} />
              <span>{loading === 'pull' ? 'Pulling…' : 'Pull'}</span>
            </Button>
            <Button variant="ghost" onClick={push} disabled={status.ahead === 0 || loading === 'push'} title="Push">
              <Icon name="arrow-up" size={14} />
              <span>{loading === 'push' ? 'Pushing…' : 'Push'}</span>
            </Button>
          </>
        }
      >
        {/* Branch name + dropdown */}
        <div className="cog-menu-wrap" ref={branchDropdownRef}>
          <Button
            ref={branchButtonRef}
            variant="ghost"
            className="cog-git__branch"
            aria-haspopup="menu"
            aria-expanded={showBranches}
            title={status.branch || 'HEAD'}
            onClick={() => { setShowBranches(!showBranches); if (!showBranches) fetchBranches() }}
          >
            <Icon name="git-branch" size={14} />
            <span>{status.branch || 'HEAD'}</span>
            <Icon name="chevron-down" size={14} />
          </Button>
          <Menu
            open={showBranches}
            onClose={() => setShowBranches(false)}
            anchorRef={branchButtonRef}
            label="Branches"
            closeOnOutside={false}
          >
            {branches.map(b => (
              <MenuItem key={b} checked={b === status.branch} onClick={() => switchBranch(b)}>
                <span className="cog-mono">{b}</span>
              </MenuItem>
            ))}
            {branches.length === 0 && <div className="cog-menu__note">No branches found</div>}
          </Menu>
        </div>

        {/* Ahead/behind */}
        <span
          className="cog-git__sync"
          title={`${status.ahead} ahead, ${status.behind} behind`}
          aria-label={`${status.ahead} commits ahead, ${status.behind} behind`}
        >
          {inSync ? (
            <>
              <span><Icon name="arrow-up" size={12} />0</span>
              <span><Icon name="arrow-down" size={12} />0</span>
            </>
          ) : (
            <>
              {status.ahead > 0 && <span className="cog-tone-success"><Icon name="arrow-up" size={12} />{status.ahead}</span>}
              {status.behind > 0 && <span className="cog-tone-danger"><Icon name="arrow-down" size={12} />{status.behind}</span>}
            </>
          )}
        </span>

        {/* View mode: Status / Log */}
        <Segmented
          ariaLabel="Git view"
          value={viewMode}
          options={[
            { value: 'status', label: 'Status', icon: 'file-text' },
            { value: 'log', label: 'Log', icon: 'git-commit' }
          ]}
          onChange={mode => { setViewMode(mode); if (mode === 'log') refreshLog() }}
        />
      </Toolbar>

      {/* ── Agent worktrees ──────────────────────────────── */}
      {worktrees.length > 0 && (
        <div className="cog-git__worktrees">
          <SectionHeader
            count={worktrees.length}
            actions={
              <Button
                variant="ghost"
                className="cog-tone-danger"
                onClick={removeAllClean}
                disabled={!worktrees.some(w => !w.dirty && !w.agentName)}
              >
                Remove all clean
              </Button>
            }
          >
            Agent worktrees
          </SectionHeader>
          {worktrees.map(w => (
            <Row
              key={w.slug}
              tooltip={w.path}
              icon={<Icon name="git-branch" size={14} />}
              id={w.slug}
              title={<span className="cog-mono">{w.branch ?? `cog/${w.slug}`}</span>}
              meta={w.agentName ?? '—'}
              state={w.dirty ? (
                <span className="cog-row__state cog-tone-warning"><Icon name="circle-dot" size={12} />dirty</span>
              ) : (
                <span className="cog-row__state cog-tone-success"><Icon name="circle-check" size={12} />clean</span>
              )}
              actions={
                <Button
                  variant="ghost"
                  className="cog-tone-danger"
                  disabled={!!w.agentName}
                  onClick={() => removeWorktree(w)}
                  title={w.agentName ? `In use by ${w.agentName}` : 'Remove worktree'}
                >
                  Remove
                </Button>
              }
            />
          ))}
        </div>
      )}

      {/* ── Content area ─────────────────────────────────── */}
      <div className="cog-git__body">
        {viewMode === 'status' ? (
          <div className="cog-git__status">
            {/* Staged files */}
            <SectionHeader
              count={status.staged.length}
              actions={status.staged.length > 0 ? <Button variant="ghost" onClick={unstageAll}>Unstage all</Button> : null}
            >
              Staged
            </SectionHeader>
            <div className="cog-git__files">
              {status.staged.length === 0 ? (
                <EmptyState icon="circle-dot" compact>No staged changes. Stage a file below to include it in the next commit.</EmptyState>
              ) : (
                status.staged.map(f => (
                  <FileItem
                    key={`staged-${f.path}`}
                    file={f}
                    actionLabel="Unstage"
                    actionIcon="minus"
                    onAction={() => unstageFile(f.path)}
                    onClick={() => fetchDiff(f.path, true)}
                    selected={selectedFile === f.path && selectedFileStaged}
                  />
                ))
              )}
            </div>

            {/* Unstaged / changes */}
            <SectionHeader
              count={status.unstaged.length}
              actions={status.unstaged.length > 0 ? <Button variant="ghost" onClick={stageAll}>Stage all</Button> : null}
            >
              Changes
            </SectionHeader>
            <div className="cog-git__files">
              {status.unstaged.length === 0 ? (
                <EmptyState icon="circle-check" compact>No unstaged changes. Files you edit appear here.</EmptyState>
              ) : (
                status.unstaged.map(f => (
                  <FileItem
                    key={`unstaged-${f.path}`}
                    file={f}
                    actionLabel="Stage"
                    actionIcon="plus"
                    onAction={() => stageFile(f.path)}
                    onClick={() => fetchDiff(f.path, false)}
                    selected={selectedFile === f.path && !selectedFileStaged}
                  />
                ))
              )}
            </div>

            {/* Diff viewer */}
            {diffContent && (
              <div className="cog-git__diff">
                <SectionHeader
                  actions={
                    <Button
                      variant="icon"
                      className="cog-btn--ghost"
                      onClick={() => { setSelectedFile(null); setDiffContent('') }}
                      aria-label="Close diff"
                      title="Close diff"
                    >
                      <Icon name="x" size={14} />
                    </Button>
                  }
                >
                  {selectedFile}<em>{selectedFileStaged ? 'staged' : 'unstaged'}</em>
                </SectionHeader>
                <DiffViewer diff={diffContent} />
              </div>
            )}
          </div>
        ) : (
          /* ── Log view ────────────────────────────────────── */
          <div>
            {log.length === 0 ? (
              <EmptyState icon="git-commit">No commits found. Commits on this branch appear here, newest first.</EmptyState>
            ) : (
              log.map(entry => (
                <Row
                  key={entry.sha}
                  tooltip={entry.message}
                  icon={<Icon name="git-commit" size={14} />}
                  id={entry.sha.slice(0, 7)}
                  title={entry.message}
                  meta={entry.author}
                  state={<span className="cog-mono">{entry.relativeDate}</span>}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Commit section ───────────────────────────────── */}
      <div className="cog-git__commit">
        <Textarea
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          placeholder="Commit message"
          aria-label="Commit message"
          rows={2}
          onKeyDown={e => {
            if (e.ctrlKey && e.key === 'Enter' && canCommit) commit()
          }}
        />
        <Button onClick={commit} disabled={!canCommit || loading === 'commit'} title="Commit (Ctrl+Enter)">
          <Icon name="git-commit" size={14} />
          <span>
            {loading === 'commit'
              ? 'Committing…'
              : `Commit ${status.staged.length} file${status.staged.length !== 1 ? 's' : ''}`}
          </span>
        </Button>
      </div>
    </div>
  )
}
