import type { AgentStatus } from '../../shared/types'

// TUI redraws position the cursor instead of printing newlines, so the prompt
// and the status bar arrive glued together. Cursor moves (CUP, CHA, VPA, the
// relative moves) and erases become line breaks before the rest is stripped.
function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[HfABCDEFGdJK]/g, '\n')
    .replace(/\x1b\[[0-9;?<>=]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    .replace(/\r/g, '\n')
}

interface StatusDetectorOptions {
  promptRegex?: RegExp
  silenceMs?: number
  onChange?: (status: AgentStatus) => void
  onClearDetected?: () => void
}

// Enough normalised text to hold one full TUI repaint (the prompt line plus
// whatever the CLI draws under it), while spinner frames stream past.
const RECENT_CHARS = 4000

export class StatusDetector {
  private _status: AgentStatus = 'idle'
  private promptRegex: RegExp
  private silenceMs: number
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private lastLineMatchedPrompt = false
  private recentText = ''
  private onChange?: (status: AgentStatus) => void
  private onClearDetected?: () => void
  private awaitingPromptAfterClear = false

  constructor(opts: StatusDetectorOptions = {}) {
    this.promptRegex = opts.promptRegex ?? /[>\u276F\u203A]\s*$/
    this.silenceMs = opts.silenceMs ?? 2000
    this.onChange = opts.onChange
    this.onClearDetected = opts.onClearDetected
  }

  get status(): AgentStatus {
    return this._status
  }

  onData(data: string): void {
    this.setStatus('working')

    const clean = stripAnsi(data)
    const lines = clean.split('\n').filter(line => line.trim().length > 0)
    if (lines.some(line => line.trim() === '/clear')) {
      this.awaitingPromptAfterClear = true
    }
    // TUI CLIs repaint with cursor moves, so the last line of a chunk is
    // usually a status line or spinner frame, not the input prompt. Keep the
    // recent normalised text and treat the prompt as visible when any line in
    // it matches; silence then means "waiting at the prompt".
    this.recentText = (this.recentText + '\n' + clean).slice(-RECENT_CHARS)
    this.lastLineMatchedPrompt = this.recentText.split('\n').some(line => line.trim().length > 0 && this.promptRegex.test(line))

    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => {
      if (this.lastLineMatchedPrompt && this._status === 'working') {
        if (this.awaitingPromptAfterClear) {
          this.awaitingPromptAfterClear = false
          this.onClearDetected?.()
        }
        this.setStatus('active')
      }
    }, this.silenceMs)
  }

  onExit(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.setStatus('disconnected')
  }

  private setStatus(status: AgentStatus): void {
    if (this._status !== status) {
      this._status = status
      this.onChange?.(status)
    }
  }
}
