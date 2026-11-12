import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { InfoEntry } from '../../shared/types'
import { useContainCanvasScroll } from '../hooks/useContainCanvasScroll'
import { EmptyState } from '../ui'

function formatTimestamp(value: string): string {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value

  const diffMs = Date.now() - time
  if (diffMs < 0) {
    return new Date(value).toLocaleString()
  }

  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 10) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(value).toLocaleString()
}

function sortNewestFirst(entries: InfoEntry[]): InfoEntry[] {
  return [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function InfoChannelPanel({ tabId }: { tabId?: string }): React.ReactElement {
  const [entries, setEntries] = useState<InfoEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const attachWheelGuard = useContainCanvasScroll<HTMLDivElement>()

  useEffect(() => {
    let isMounted = true

    const loadEntries = async () => {
      const nextEntries = await window.electronAPI.getInfoEntries(tabId)
      if (isMounted) {
        setEntries(sortNewestFirst(nextEntries))
      }
    }

    void loadEntries()

    const cleanup = window.electronAPI.onInfoUpdate((updatedEntries) => {
      // Filter push updates by tab
      const filtered = tabId
        ? updatedEntries.filter(e => !e.tabId || e.tabId === tabId)
        : updatedEntries
      setEntries(sortNewestFirst(filtered))
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0
      }
    })

    return () => {
      isMounted = false
      cleanup()
    }
  }, [tabId])

  const renderedEntries = useMemo(() => sortNewestFirst(entries), [entries])

  return (
    <div ref={attachWheelGuard} className="cog-panel cog-info">
      {renderedEntries.length === 0 ? (
        <EmptyState icon="radio">Notes that agents post to the info channel will appear here.</EmptyState>
      ) : (
        <div ref={scrollRef} className="cog-info__list">
          {renderedEntries.map(entry => (
            <article key={entry.id} className="cog-info__entry">
              <div className="cog-info__head">
                <span className="cog-info__from">{entry.from}</span>
                <span className="cog-info__time">{formatTimestamp(entry.createdAt)}</span>
              </div>

              <div className="cog-info__note">{entry.note}</div>

              {entry.tags.length > 0 && (
                <div className="cog-info__tags">
                  {entry.tags.map(tag => (
                    <span key={`${entry.id}-${tag}`} className="cog-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
