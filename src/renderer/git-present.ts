import type { GitFileStatus } from '../shared/types'

export type DiffLineKind = 'add' | 'del' | 'hunk' | 'meta' | 'ctx'

/** Kind of one line of a unified diff; drives its colour in the Git panel. */
export function diffLineKind(line: string): DiffLineKind {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'add'
  if (line.startsWith('-') && !line.startsWith('---')) return 'del'
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('diff ') || line.startsWith('index ')) return 'meta'
  return 'ctx'
}

export type GitTone = 'success' | 'warning' | 'danger' | 'working'

export interface FileStatusPresentation {
  /** The mono letter shown in the row's icon column. */
  letter: string
  /** The word for the letter (tooltip and screen readers): colour is never the only signal. */
  label: string
  tone: GitTone
}

const FILE_STATUS: Record<GitFileStatus['status'], FileStatusPresentation> = {
  added: { letter: 'A', label: 'added', tone: 'success' },
  modified: { letter: 'M', label: 'modified', tone: 'warning' },
  deleted: { letter: 'D', label: 'deleted', tone: 'danger' },
  renamed: { letter: 'R', label: 'renamed', tone: 'working' }
}

export function fileStatusPresentation(status: GitFileStatus['status']): FileStatusPresentation {
  return { ...FILE_STATUS[status] }
}

/** Splits a repo path into its file name and the directory before it ('' at the root). */
export function splitPath(path: string): { name: string; dir: string } {
  const name = path.split('/').pop() || path
  return { name, dir: path !== name ? path.replace(/\/[^/]+$/, '') : '' }
}
