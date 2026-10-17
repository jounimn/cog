// When, and how often, to press Enter after pasting a prompt into a TUI CLI.
//
// Two things go wrong with a single Enter at a fixed delay:
// - The CLI is still rendering the paste when the Enter arrives (long prompt,
//   loaded machine) and the Enter is dropped.
// - Claude Code drops the Enter outright while its SessionStart hooks and MCP
//   servers are still starting: the text stays in the input box, unsent. On a
//   laptop with several hooks this window was measured at ~30 s after launch,
//   for fresh and resumed sessions alike, and it happens on every wake.
//
// So: send the first Enter once the minimum delay has passed and the PTY has
// been quiet for `quietMs` (or at `firstMaxMs`); then watch the output. A
// submission makes the CLI stream for a while (spinner frames, hook lines):
// `acceptChunks` chunks spanning at least `acceptSpanMs` count as accepted and
// stop the loop. If that does not happen within `retryMs`, press Enter again,
// up to `maxTries` times. An extra Enter on an already-submitted prompt lands
// on an empty input box and does nothing.
export interface SubmitUntilAcceptedOptions {
  /** Date.now() of the last byte the PTY produced. */
  lastOutputAt: () => number
  /** Number of data chunks the PTY has produced so far. */
  outputChunks: () => number
  /** Sends the Enter. Called once per try. */
  submit: () => void
  /** Never send the first Enter before this many ms (CLI-specific render floor). */
  minMs: number
  quietMs?: number
  firstMaxMs?: number
  retryMs?: number
  maxTries?: number
  acceptChunks?: number
  acceptSpanMs?: number
  now?: () => number
  /** Called once with the try count that got through, or null after giving up. */
  onDone?: (acceptedOnTry: number | null) => void
}

export const DEFAULT_QUIET_MS = 300
export const DEFAULT_FIRST_MAX_MS = 8000
export const DEFAULT_RETRY_MS = 5000
export const DEFAULT_MAX_TRIES = 12
export const DEFAULT_ACCEPT_CHUNKS = 15
export const DEFAULT_ACCEPT_SPAN_MS = 2500
const POLL_MS = 100

/** Returns a cancel function. */
export function submitUntilAccepted(opts: SubmitUntilAcceptedOptions): () => void {
  const now = opts.now ?? Date.now
  const quietMs = opts.quietMs ?? DEFAULT_QUIET_MS
  const firstMaxMs = opts.firstMaxMs ?? DEFAULT_FIRST_MAX_MS
  const retryMs = opts.retryMs ?? DEFAULT_RETRY_MS
  const maxTries = opts.maxTries ?? DEFAULT_MAX_TRIES
  const acceptChunks = opts.acceptChunks ?? DEFAULT_ACCEPT_CHUNKS
  const acceptSpanMs = opts.acceptSpanMs ?? DEFAULT_ACCEPT_SPAN_MS

  const started = now()
  let timer: ReturnType<typeof setTimeout> | null = null
  let done = false
  let tries = 0
  let enterAt = 0
  let chunksAtEnter = 0
  let firstOutputAfterEnter = 0

  const finish = (acceptedOnTry: number | null): void => {
    if (done) return
    done = true
    timer = null
    opts.onDone?.(acceptedOnTry)
  }
  const press = (): void => {
    tries++
    enterAt = now()
    chunksAtEnter = opts.outputChunks()
    firstOutputAfterEnter = 0
    opts.submit()
  }
  const check = (): void => {
    if (done) return
    const t = now()
    if (tries === 0) {
      const elapsed = t - started
      if (elapsed >= firstMaxMs || (elapsed >= opts.minMs && t - opts.lastOutputAt() >= quietMs)) press()
    } else {
      const last = opts.lastOutputAt()
      if (!firstOutputAfterEnter && last > enterAt) firstOutputAfterEnter = last
      const accepted =
        opts.outputChunks() - chunksAtEnter >= acceptChunks &&
        firstOutputAfterEnter > 0 &&
        last - firstOutputAfterEnter >= acceptSpanMs
      if (accepted) { finish(tries); return }
      if (t - enterAt >= retryMs) {
        if (tries >= maxTries) { finish(null); return }
        press()
      }
    }
    timer = setTimeout(check, POLL_MS)
  }
  timer = setTimeout(check, Math.min(opts.minMs, firstMaxMs))
  return () => {
    done = true
    if (timer) clearTimeout(timer)
    timer = null
  }
}
