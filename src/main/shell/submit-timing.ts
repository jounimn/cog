// When to press Enter after pasting a prompt into a TUI CLI.
//
// The CLIs echo and re-render the pasted text; an Enter that lands while they
// are still rendering is dropped and the prompt sits unsent in the input box
// (seen live on a loaded machine with the long wake prompt: reconnect text +
// queued nudge). So Enter goes out once the minimum delay has passed AND the
// terminal has been quiet for `quietMs`, or at `maxMs` regardless, so a
// chatty TUI (spinners, clocks) can never hold the prompt forever.
export interface SubmitWhenQuietOptions {
  /** Timestamp of the last byte the PTY produced. */
  lastOutputAt: () => number
  /** Sends the Enter. Called exactly once. */
  submit: () => void
  /** Never submit before this many ms (CLI-specific render floor). */
  minMs: number
  quietMs?: number
  maxMs?: number
  now?: () => number
}

export const DEFAULT_QUIET_MS = 300
export const DEFAULT_MAX_MS = 8000
const POLL_MS = 100

/** Returns a cancel function. */
export function submitWhenQuiet(opts: SubmitWhenQuietOptions): () => void {
  const now = opts.now ?? Date.now
  const quietMs = opts.quietMs ?? DEFAULT_QUIET_MS
  const maxMs = opts.maxMs ?? DEFAULT_MAX_MS
  const started = now()
  let timer: ReturnType<typeof setTimeout> | null = null
  let done = false

  const fire = (): void => {
    if (done) return
    done = true
    timer = null
    opts.submit()
  }
  const check = (): void => {
    if (done) return
    const elapsed = now() - started
    if (elapsed >= maxMs || (elapsed >= opts.minMs && now() - opts.lastOutputAt() >= quietMs)) {
      fire()
      return
    }
    timer = setTimeout(check, POLL_MS)
  }
  timer = setTimeout(check, Math.min(opts.minMs, maxMs))
  return () => {
    done = true
    if (timer) clearTimeout(timer)
    timer = null
  }
}
