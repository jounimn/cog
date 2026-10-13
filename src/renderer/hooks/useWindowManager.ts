import { useState, useCallback, useRef } from 'react'
import { nextSpawnBounds } from '../window-layout'
import { clampZoom, fitViewport, type Viewport } from '../canvas-math'

export interface WindowState {
  id: string
  title: string
  statusColor?: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
  tabId?: string
}

let nextZ = 1

export function useWindowManager() {
  const [windows, setWindows] = useState<Map<string, WindowState>>(new Map())

  const [zoom, setZoomState] = useState(1.0)
  const [pan, setPanState] = useState({ x: 0, y: 0 })

  // Refs for stable closures (addWindow needs current zoom/pan without recreating)
  const zoomRef = useRef(1.0)
  const panRef = useRef({ x: 0, y: 0 })
  // Size of the canvas viewport element (reported by Workspace). Used to centre
  // spawns on the visible canvas rather than on the whole BrowserWindow.
  const viewportSizeRef = useRef({ width: window.innerWidth, height: window.innerHeight })

  const setZoom = useCallback((level: number) => {
    const clamped = clampZoom(level)
    zoomRef.current = clamped
    setZoomState(clamped)
  }, [])

  const setPan = useCallback((x: number, y: number) => {
    panRef.current = { x, y }
    setPanState({ x, y })
  }, [])

  /** Apply a whole viewport at once (restoring a tab's saved view). */
  const applyViewport = useCallback((vp: Viewport) => {
    const clamped = clampZoom(vp.zoom)
    zoomRef.current = clamped
    panRef.current = { x: vp.panX, y: vp.panY }
    setZoomState(clamped)
    setPanState(panRef.current)
  }, [])

  const setViewportSize = useCallback((width: number, height: number) => {
    if (width > 0 && height > 0) viewportSizeRef.current = { width, height }
  }, [])

  const updateWindowPosition = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => {
      const win = prev.get(id)
      if (!win) return prev
      const next = new Map(prev)
      next.set(id, { ...win, x, y })
      return next
    })
  }, [])

  const updateWindowSize = useCallback((id: string, width: number, height: number) => {
    setWindows(prev => {
      const win = prev.get(id)
      if (!win) return prev
      const next = new Map(prev)
      next.set(id, { ...win, width, height })
      return next
    })
  }, [])

  const zoomToFit = useCallback((viewportWidth: number, viewportHeight: number, tabId?: string) => {
    setWindows(prev => {
      let wins = Array.from(prev.values())
      if (tabId) wins = wins.filter(w => w.tabId === tabId)
      wins = wins.filter(w => !w.minimized)

      const vp = fitViewport(wins, viewportWidth, viewportHeight)
      if (vp) {
        zoomRef.current = vp.zoom
        panRef.current = { x: vp.panX, y: vp.panY }
        setZoomState(vp.zoom)
        setPanState(panRef.current)
      }

      return prev // don't modify windows, just read them
    })
  }, [])

  const addWindow = useCallback((id: string, title: string, statusColor?: string, tabId?: string) => {
    setWindows(prev => {
      const next = new Map(prev)
      // Only tile against windows in the same tab.
      const tabWins = tabId ? Array.from(next.values()).filter(w => w.tabId === tabId) : Array.from(next.values())
      const z = zoomRef.current
      const p = panRef.current
      // Base point (used only when the tab is empty): the canvas coord at the
      // viewport centre, offset so the window is roughly centred.
      const vs = viewportSizeRef.current
      const baseX = (vs.width / 2 - p.x) / z - 300
      const baseY = (vs.height / 2 - p.y) / z - 200
      // Tile to the right of existing windows instead of stacking on top.
      const b = nextSpawnBounds(
        tabWins.map(w => ({ x: w.x, y: w.y, width: w.width, height: w.height })),
        baseX,
        baseY
      )
      next.set(id, {
        id,
        title,
        statusColor,
        tabId,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        zIndex: ++nextZ,
        minimized: false
      })
      return next
    })
  }, []) // stable — uses refs, no zoom/pan in deps

  const addWindowAt = useCallback((id: string, title: string, x: number, y: number, width: number, height: number, statusColor?: string, tabId?: string) => {
    setWindows(prev => {
      const next = new Map(prev)
      next.set(id, {
        id,
        title,
        statusColor,
        tabId,
        x,
        y,
        width,
        height,
        zIndex: ++nextZ,
        minimized: false
      })
      return next
    })
  }, [])

  const removeWindow = useCallback((id: string) => {
    setWindows(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => {
      const win = prev.get(id)
      if (!win) return prev
      const next = new Map(prev)
      next.set(id, { ...win, zIndex: ++nextZ, minimized: false })
      return next
    })
  }, [])

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => {
      const win = prev.get(id)
      if (!win) return prev
      const next = new Map(prev)
      next.set(id, { ...win, minimized: true })
      return next
    })
  }, [])

  const updateStatusColor = useCallback((id: string, color: string) => {
    setWindows(prev => {
      const win = prev.get(id)
      if (!win) return prev
      const next = new Map(prev)
      next.set(id, { ...win, statusColor: color })
      return next
    })
  }, [])

  return {
    windows: Array.from(windows.values()),
    zoom,
    pan,
    setZoom,
    setPan,
    applyViewport,
    setViewportSize,
    addWindow,
    addWindowAt,
    removeWindow,
    focusWindow,
    minimizeWindow,
    updateStatusColor,
    updateWindowPosition,
    updateWindowSize,
    zoomToFit
  }
}
