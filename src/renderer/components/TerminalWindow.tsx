import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { AgentTheme } from '../../shared/types'
import { resolveTheme } from '../themes'
import { createTerminalRegistry } from '../terminal-registry'

interface TerminalWindowProps {
  agentId: string
  theme?: AgentTheme
}

interface TerminalHandle {
  term: Terminal
  fit: FitAddon
  /** The DOM node xterm rendered into. Re-parented on every mount. */
  element: HTMLDivElement
  dispose(): void
}

function xtermTheme(theme?: AgentTheme) {
  const resolved = resolveTheme(theme)
  return {
    background: resolved.bg,
    foreground: resolved.text,
    cursor: resolved.text,
    selectionBackground: '#444'
  }
}

/**
 * Build a live terminal for an agent: xterm + PTY wiring. Lives in the
 * registry for the agent's lifetime, so switching tabs (which unmounts the
 * component) neither recreates the terminal nor loses its screen.
 */
function createTerminal(agentId: string): TerminalHandle {
  const element = document.createElement('div')
  element.style.width = '100%'
  element.style.height = '100%'

  const term = new Terminal({
    theme: xtermTheme(),
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontSize: 13,
    cursorBlink: true,
    scrollback: 5000
  })

  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(element)

  const cleanupOutput = window.electronAPI.onPtyOutput((id, data) => {
    if (id === agentId) term.write(data)
  })

  // Ctrl+C: copy if text selected, otherwise send SIGINT to PTY
  // Ctrl+V: paste from clipboard into PTY
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.ctrlKey && ev.key === 'c' && ev.type === 'keydown') {
      if (term.hasSelection()) {
        navigator.clipboard.writeText(term.getSelection())
        term.clearSelection()
        return false
      }
    }
    if (ev.ctrlKey && ev.key === 'v' && ev.type === 'keydown') {
      ev.preventDefault() // prevent native paste → onData double-write
      navigator.clipboard.readText().then(text => {
        // Route through xterm's paste() so multi-line pastes get wrapped in
        // bracketed-paste sequences when the CLI enables that mode — without
        // it, raw newlines hit the CLI as Enter and submit after the first
        // line. paste() fires onData, which forwards to writeToPty.
        if (text) term.paste(text)
      })
      return false
    }
    return true
  })

  const disposable = term.onData((data) => {
    // Filter out focus in/out escape sequences (ESC[I, ESC[O)
    // These get sent when clicking the terminal and some TUIs (Codex) can't handle them
    const filtered = data.replace(/\x1b\[(?:I|O)/g, '')
    if (filtered) window.electronAPI.writeToPty(agentId, filtered)
  })

  return {
    term,
    fit,
    element,
    dispose() {
      cleanupOutput()
      disposable.dispose()
      term.dispose()
      element.remove()
    }
  }
}

export const terminalRegistry = createTerminalRegistry<TerminalHandle>(createTerminal)

export function TerminalWindow({ agentId, theme }: TerminalWindowProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handle = terminalRegistry.acquire(agentId)
    const { term, fit, element } = handle
    container.appendChild(element)

    const syncSize = () => {
      fit.fit()
      window.electronAPI.resizePty(agentId, term.cols, term.rows)
    }
    syncSize()
    // Hidden while in another tab, xterm may have skipped paints — repaint
    // the whole screen from its own buffer now that it is visible again.
    term.refresh(0, Math.max(0, term.rows - 1))

    const observer = new ResizeObserver(syncSize)
    observer.observe(container)

    return () => {
      observer.disconnect()
      // Detach only — the terminal keeps running (and buffering PTY output)
      // until App disposes it when the agent's window goes away.
      if (element.parentNode === container) container.removeChild(element)
    }
  }, [agentId])

  // Live-update xterm theme when the prop changes — don't re-create the terminal
  useEffect(() => {
    if (!terminalRegistry.has(agentId)) return
    terminalRegistry.acquire(agentId).term.options.theme = xtermTheme(theme)
  }, [agentId, theme])

  const resolved = resolveTheme(theme)
  return (
    <div
      ref={containerRef}
      onWheel={(e) => e.stopPropagation()}
      style={{ width: '100%', height: '100%', backgroundColor: resolved.bg }}
    />
  )
}
