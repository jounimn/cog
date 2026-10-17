import type { AgentStatus } from '../../shared/types'

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
}

interface StatusDetectorOptions {
  promptRegex?: RegExp
  silenceMs?: number
  onChange?: (status: AgentStatus) => void
  onClearDetected?: () => void
}

const RECENT_LINES = 12

export class StatusDetector {
  private _status: AgentStatus = 'idle'
  private promptRegex: RegExp
  private silenceMs: number
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private lastLineMatchedPrompt = false
  private recentLines: string[] = []
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
    // usually a status line or spinner frame, not the input prompt. Keep a
    // short window of recent lines and treat the prompt as visible when any
    // of them matches; silence then means "waiting at the prompt".
    this.recentLines = [...this.recentLines, ...lines].slice(-RECENT_LINES)
    this.lastLineMatchedPrompt = this.recentLines.some(line => this.promptRegex.test(line))

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
