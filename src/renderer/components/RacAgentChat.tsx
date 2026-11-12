import React, { useState, useEffect, useCallback } from 'react'
import { Button, Icon, Input, EmptyState, Toolbar } from '../ui'

interface Message {
  id: string
  from: string
  to: string
  message: string
  timestamp: string
}

declare const electronAPI: {
  hubSendMessage: (from: string, to: string, message: string) => Promise<any>
  hubGetMessageHistory: (agent?: string, limit?: number) => Promise<Message[]>
}

interface RacAgentChatProps {
  agentName: string
}

export function RacAgentChat({ agentName }: RacAgentChatProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await electronAPI.hubGetMessageHistory(agentName, 50)
      setMessages(msgs)
    } catch { /* hub unreachable */ }
  }, [agentName])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  const handleSend = async () => {
    if (!input.trim()) return
    setSending(true)
    try {
      await electronAPI.hubSendMessage('user', agentName, input.trim())
      setInput('')
      // Immediate refresh to show the sent message
      setTimeout(fetchMessages, 500)
    } catch { /* failed */ }
    setSending(false)
  }

  // Sort messages chronologically (oldest first, newest at bottom)
  const sortedMessages = [...messages].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return (
    <div className="cog-panel cog-chat">
      {/* Header */}
      <Toolbar label={`Chat with ${agentName}`}>
        <span className="cog-toolbar__title">
          <Icon name="bot" size={14} />
          <span>{agentName} <span className="cog-toolbar__sub">Remote R.A.C. agent</span></span>
        </span>
      </Toolbar>

      {/* Messages */}
      <div className="cog-chat__list">
        {sortedMessages.length === 0 ? (
          <EmptyState icon="messages-square">
            No messages yet. Send a task to this agent below,{'\n'}
            or have your orchestrator <span className="cog-mono">send_message("{agentName}", "...")</span>.
          </EmptyState>
        ) : (
          sortedMessages.map(msg => {
            const fromAgent = msg.from === agentName
            return (
              <div key={msg.id} className={fromAgent ? 'cog-chat__msg cog-chat__msg--agent' : 'cog-chat__msg'}>
                <div className="cog-chat__head">
                  <Icon name={fromAgent ? 'bot' : 'user'} size={13} />
                  <span>{msg.from}</span>
                  <span className="cog-chat__time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                {/* Agent output is data: mono and pre-wrap so ASCII alignment survives */}
                <div className="cog-chat__body">{msg.message}</div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="cog-chat__input">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={`Send message to ${agentName}…`}
          aria-label={`Message to ${agentName}`}
        />
        <Button onClick={handleSend} disabled={sending || !input.trim()}>
          <Icon name="send" size={14} />Send
        </Button>
      </div>
    </div>
  )
}
