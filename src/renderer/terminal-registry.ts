/**
 * Keeps one live terminal per agent for the lifetime of the agent, independent
 * of React mounting.
 *
 * The Workspace only renders the active tab's windows, so switching tabs
 * unmounts every TerminalWindow in the tab you leave. Rebuilding xterm on
 * re-mount loses the screen: the CLI inside the PTY only repaints on a resize
 * (SIGWINCH), so the user sees a blank terminal until they drag a border.
 * Instead, the component acquires a handle from this registry and only
 * attaches/detaches its DOM element; the terminal (and its PTY subscription)
 * keeps running while hidden. `dispose` is called when the agent's window is
 * actually removed.
 */
export interface Disposable {
  dispose(): void
}

export interface TerminalRegistry<H extends Disposable> {
  /** Existing handle for the agent, or a new one from the factory. */
  acquire(agentId: string): H
  has(agentId: string): boolean
  /** Tear the terminal down and forget it. No-op for unknown ids. */
  dispose(agentId: string): void
  ids(): string[]
}

export function createTerminalRegistry<H extends Disposable>(
  factory: (agentId: string) => H
): TerminalRegistry<H> {
  const handles = new Map<string, H>()
  return {
    acquire(agentId) {
      let h = handles.get(agentId)
      if (!h) {
        h = factory(agentId)
        handles.set(agentId, h)
      }
      return h
    },
    has: (agentId) => handles.has(agentId),
    dispose(agentId) {
      const h = handles.get(agentId)
      if (!h) return
      handles.delete(agentId)
      h.dispose()
    },
    ids: () => Array.from(handles.keys())
  }
}
