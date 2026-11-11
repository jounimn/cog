export const PANEL_IDS: Record<string, string> = {
  '__pinboard__': 'pinboard',
  '__info__': 'info',
  '__files__': 'files',
  '__rac__': 'rac',
  '__usage__': 'usage',
  '__git__': 'git',
  '__schedules__': 'schedules',
  '__trollbox__': 'trollbox',
  '__inbox__': 'inbox',
  '__board__': 'board',
}

// Extract panel type from a potentially tab-qualified ID (e.g. '__pinboard__::tab-1')
export function getPanelType(id: string): string | undefined {
  for (const [prefix, type] of Object.entries(PANEL_IDS)) {
    if (id === prefix || id.startsWith(prefix + '::')) {
      return type
    }
  }
  return undefined
}
