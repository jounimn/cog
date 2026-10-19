// Size of each agent's terminal pane, as the renderer last reported it.
//
// The renderer sends its xterm size when the pane mounts and when it is
// resized. A PTY spawned into a pane that already exists (wake, crash
// reconnect, restart) gets neither, so it came up at the 120x30 default and
// the CLI drew 120-column frames into a narrower pane: wrapped lines, the
// status line painted several times over. Remembering the size per agent
// lets every spawn start at the pane's real size.

export interface TerminalSize {
  cols: number
  rows: number
}

/** What a PTY got before the renderer ever reported a size. */
export const DEFAULT_TERMINAL_SIZE: Readonly<TerminalSize> = { cols: 120, rows: 30 }

/**
 * Clear the screen and the scrollback and home the cursor. Sent to the
 * renderer terminal before a respawned PTY's first byte, so the dead
 * session's last frame and its "Resume this session with:" footer do not
 * stay under the new TUI. xterm.js honours CSI 3 J (scrollback clear).
 */
export const RESET_SCREEN = '\x1b[2J\x1b[3J\x1b[H'

function isSize(n: number): boolean {
  return Number.isInteger(n) && n > 0
}

export class TerminalSizes {
  private readonly sizes = new Map<string, TerminalSize>()

  /** Record what the renderer reported; a collapsed or hidden pane's 0x0 is ignored. */
  remember(agentId: string, cols: number, rows: number): void {
    if (!isSize(cols) || !isSize(rows)) return
    this.sizes.set(agentId, { cols, rows })
  }

  /** The last reported size, or the default when the pane never reported one. */
  get(agentId: string): TerminalSize {
    const s = this.sizes.get(agentId) ?? DEFAULT_TERMINAL_SIZE
    return { cols: s.cols, rows: s.rows }
  }

  forget(agentId: string): void {
    this.sizes.delete(agentId)
  }
}
