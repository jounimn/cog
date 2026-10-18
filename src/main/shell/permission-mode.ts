// Claude Code's permission mode as the user set it in the terminal.
//
// Agents without Auto Mode start Claude Code in its default mode and the user
// cycles to "bypass permissions" (or auto / accept edits / plan) with
// shift+tab. Claude Code does not keep that choice across `--resume`, so a
// wake or an app-restart respawn came back in default mode, where every Cog
// MCP call needs an approval nobody gives. The mode is visible in the TUI's
// input box ("⏵⏵ bypass permissions on (shift+tab to cycle)"), so the PTY
// output tells us which one is current; it is remembered on the agent and
// passed back as `--permission-mode` on the next launch of that session.

export type PermissionMode = 'default' | 'acceptEdits' | 'auto' | 'bypassPermissions' | 'dontAsk' | 'plan'

/** Values `claude --permission-mode` accepts (2.1.x); 'default' means no flag. */
export const PERMISSION_MODES: ReadonlySet<string> = new Set(['default', 'acceptEdits', 'auto', 'bypassPermissions', 'dontAsk', 'plan'])

const ANSI = /\x1b\[[0-9;?<>=]*[a-zA-Z]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g

// Order matters only for the final pick: the LAST marker in the chunk wins,
// because a redraw prints the current mode after the stale one.
const MARKERS: Array<[RegExp, PermissionMode]> = [
  [/bypass permissions on/g, 'bypassPermissions'],
  [/auto mode on/g, 'auto'],
  [/accept edits on/g, 'acceptEdits'],
  [/plan mode on/g, 'plan'],
  [/don.t ask on/g, 'dontAsk'],
  // Default mode shows no mode line, only the shortcut hint, at the prompt.
  [/\? for shortcuts/g, 'default']
]

/** Cheap pre-check so the full scan runs only on chunks that can carry a mode line. */
export function mayCarryPermissionMode(chunk: string): boolean {
  return chunk.includes('shift+tab') || chunk.includes('for shortcuts')
}

/** The permission mode shown last in this chunk of PTY output, if any. */
export function detectPermissionMode(chunk: string): PermissionMode | undefined {
  const text = chunk.replace(ANSI, '').replace(/\s+/g, ' ')
  let best: { index: number; mode: PermissionMode } | undefined
  for (const [re, mode] of MARKERS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (!best || m.index > best.index) best = { index: m.index, mode }
    }
  }
  return best?.mode
}

/**
 * Extra launch arguments for a Claude-family CLI. Auto Mode (the agent's own
 * setting) already means bypass; otherwise a remembered non-default mode is
 * passed back so the session comes up the way the user left it.
 */
export function permissionModeArgs(config: { autoMode: boolean; permissionMode?: string }): string {
  if (config.autoMode) return ' --dangerously-skip-permissions'
  const mode = config.permissionMode
  if (!mode || mode === 'default' || !PERMISSION_MODES.has(mode)) return ''
  if (mode === 'bypassPermissions') return ' --dangerously-skip-permissions'
  return ` --permission-mode ${mode}`
}
