import React, { useEffect, useId, useMemo, useState } from 'react'
import type { InboxMessage, InboxPriority, NotificationThreshold } from '../../shared/types'
import { Button, Icon, Select, Textarea, EmptyState, Toolbar } from '../ui'
import { inboxPriorityPresentation, INBOX_FILTER_LABELS } from '../panel-present'

const PRIORITY_RANK: Record<InboxPriority, number> = {
  low: 0, normal: 1, high: 2, urgent: 3
}

type Filter = 'all' | 'unread' | 'high+' | 'urgent'

const FILTER_OPTIONS: { value: Filter; label: string }[] =
  (Object.keys(INBOX_FILTER_LABELS) as Filter[]).map(value => ({ value, label: INBOX_FILTER_LABELS[value] }))

const THRESHOLD_OPTIONS: { value: NotificationThreshold; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low+' },
  { value: 'normal', label: 'Normal+' },
  { value: 'high', label: 'High+' },
  { value: 'urgent', label: 'Urgent only' }
]

export function InboxPanel(): React.ReactElement {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [threshold, setThreshold] = useState<NotificationThreshold>('high')
  const [replying, setReplying] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  // Proposal IDs still pending (seeded on mount) and ones settled since.
  // The Review button shows only for a still-pending proposal.
  const [pendingProposals, setPendingProposals] = useState<Set<string>>(new Set())
  const [resolvedProposals, setResolvedProposals] = useState<Set<string>>(new Set())
  const filterId = useId()
  const notifyId = useId()

  useEffect(() => {
    let mounted = true
    window.electronAPI.inboxList().then(msgs => { if (mounted) setMessages(msgs) })
    window.electronAPI.inboxGetNotifyThreshold().then(t => { if (mounted) setThreshold(t) })
    // Seed pending proposals so historical, already-resolved proposal messages
    // don't render a stale "Review" button after a restart/remount.
    window.electronAPI.proposalsListPending().then(list => {
      if (mounted) setPendingProposals(new Set(list.map(p => p.id)))
    })
    const offAdd = window.electronAPI.onInboxMessageAdded((msgs) => setMessages(msgs))
    const offUpd = window.electronAPI.onInboxMessageUpdated((msgs) => setMessages(msgs))
    // Track proposals that arrive while mounted so their Review button shows too.
    const offProposal = window.electronAPI.onProposalAdded((p) => {
      setPendingProposals(prev => new Set(prev).add(p.id))
    })
    const offResolved = window.electronAPI.onProposalResolved((p) => {
      setResolvedProposals(prev => new Set(prev).add(p.id))
    })
    return () => { mounted = false; offAdd(); offUpd(); offProposal(); offResolved() }
  }, [])

  // A message wraps a team proposal when it carries a `proposal:<id>` tag.
  const proposalIdOf = (m: InboxMessage): string | null => {
    const tag = m.tags.find(t => t.startsWith('proposal:'))
    return tag ? tag.slice('proposal:'.length) : null
  }
  const handleReviewProposal = async (id: string) => {
    const res = await window.electronAPI.proposalsReopen(id)
    if (!res.ok) {
      // Already approved/rejected/expired/gone — mark it settled so the button hides.
      setResolvedProposals(prev => new Set(prev).add(id))
    }
  }

  const filtered = useMemo(() => {
    return messages.filter(m => {
      if (filter === 'unread') return !m.readAt
      if (filter === 'high+') return PRIORITY_RANK[m.priority] >= PRIORITY_RANK['high']
      if (filter === 'urgent') return m.priority === 'urgent'
      return true
    })
  }, [messages, filter])

  const handleMarkRead = async (id: string) => {
    await window.electronAPI.inboxMarkRead(id)
  }
  const handleDelete = async (id: string) => {
    await window.electronAPI.inboxDelete(id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }
  const handleMarkAllRead = async () => {
    await window.electronAPI.inboxMarkAllRead()
  }
  const handleThresholdChange = async (t: NotificationThreshold) => {
    setThreshold(t)
    await window.electronAPI.inboxSetNotifyThreshold(t)
  }
  const handleStartReply = (id: string) => {
    setReplying(id)
    setReplyText('')
  }
  const handleSendReply = async (agentName: string) => {
    if (!replyText.trim()) return
    const result = await window.electronAPI.inboxReply(agentName, replyText.trim())
    if (result.success) {
      setReplying(null)
      setReplyText('')
    }
  }

  return (
    <div className="cog-panel cog-inbox">
      <Toolbar
        label="Inbox"
        actions={
          <Button variant="ghost" onClick={handleMarkAllRead}>
            <Icon name="check" size={15} />Mark all read
          </Button>
        }
      >
        <label className="cog-inbox__label" htmlFor={filterId}>Filter</label>
        <Select id={filterId} value={filter} options={FILTER_OPTIONS} onChange={setFilter} />
        <label className="cog-inbox__label" htmlFor={notifyId}>Notify</label>
        <Select id={notifyId} value={threshold} options={THRESHOLD_OPTIONS} onChange={handleThresholdChange} />
      </Toolbar>

      <div className="cog-inbox__list">
        {filtered.length === 0 && (
          <EmptyState icon="inbox">
            {filter === 'all'
              ? 'Messages that agents send you will appear here.'
              : `No messages match "${INBOX_FILTER_LABELS[filter]}".`}
          </EmptyState>
        )}
        {filtered.map(m => {
          const pr = inboxPriorityPresentation(m.priority)
          const isUnread = !m.readAt
          const isReplying = replying === m.id
          const proposalId = proposalIdOf(m)
          const showReview = !!proposalId && pendingProposals.has(proposalId) && !resolvedProposals.has(proposalId)
          return (
            <article key={m.id} className={isUnread ? 'cog-msg cog-msg--unread' : 'cog-msg'}>
              <div className="cog-msg__head">
                <span className={pr.tone ? `cog-msg__prio cog-tone-${pr.tone}` : 'cog-msg__prio'}>
                  {pr.icon && <Icon name={pr.icon} size={14} />}{pr.word}
                </span>
                <span className="cog-msg__from">from <strong>{m.agentName}</strong></span>
                {m.tags.length > 0 && (
                  <span className="cog-msg__tags" title={m.tags.map(t => `#${t}`).join(' ')}>
                    {m.tags.map(t => `#${t}`).join(' ')}
                  </span>
                )}
                {isUnread && (
                  <span className="cog-msg__unread cog-tone-working"><Icon name="circle-dot" size={12} />Unread</span>
                )}
                <span className="cog-msg__time">{formatDate(m.createdAt)}</span>
              </div>
              <div className="cog-msg__body">{m.message}</div>
              {showReview && proposalId && (
                <Button className="cog-msg__proposal" onClick={() => handleReviewProposal(proposalId)}>
                  Open / Review team proposal<Icon name="chevron-right" size={15} />
                </Button>
              )}
              <div className="cog-msg__actions">
                {isUnread && (
                  <Button variant="ghost" onClick={() => handleMarkRead(m.id)}>
                    <Icon name="check" size={14} />Mark read
                  </Button>
                )}
                {!isReplying && (
                  <Button variant="ghost" onClick={() => handleStartReply(m.id)}>
                    <Icon name="reply" size={14} />Reply
                  </Button>
                )}
                <div className="cog-msg__spacer" />
                <Button variant="ghost" className="cog-tone-danger" onClick={() => handleDelete(m.id)}>
                  <Icon name="trash" size={14} />Delete
                </Button>
              </div>
              {isReplying && (
                <div className="cog-msg__reply">
                  <Textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={`Reply to ${m.agentName}…`}
                    aria-label={`Reply to ${m.agentName}`}
                    autoFocus
                  />
                  <div className="cog-msg__reply-actions">
                    <Button variant="ghost" onClick={() => { setReplying(null); setReplyText('') }}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleSendReply(m.agentName)}
                      disabled={!replyText.trim()}
                    >Send</Button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}
