import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createRoutes } from './routes'
import { AgentRegistry } from './agent-registry'
import { MessageRouter } from './message-router'
import { sleepingMessageNote } from '../sleep/sleep-notes'
import type { AgentConfig } from '../../shared/types'

const base: AgentConfig = {
  id: 'a1', name: 'Alpha', cli: 'claude', cwd: 'C:/tmp', role: 'worker',
  ceoNotes: '', shell: 'powershell', admin: false, autoMode: true
}

// Real registry + message router (no sqlite, no Electron); the rest are fakes.
function makeApp() {
  const registry = new AgentRegistry()
  const messages = new MessageRouter(registry)
  const app = express()
  app.use(express.json())
  app.use(createRoutes(
    registry, messages, { accessor: null }, {} as never, {} as never,
    { store: null }, { path: null }, undefined, { postMessage: vi.fn() } as never
  ))
  return { app, registry, messages }
}

describe('POST /messages/send to a sleeping agent', () => {
  it('queues the message, returns status queued with the note, and leaves the agent asleep', async () => {
    const { app, registry, messages } = makeApp()
    registry.register({ ...base, name: 'Sender', id: 's1' })
    registry.register({ ...base, sleeping: true, sleptAt: '2026-10-13T00:00:00.000Z' })

    const res = await request(app).post('/messages/send').send({ from: 'Sender', to: 'Alpha', message: 'hi' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('queued')
    expect(res.body.note).toBe(sleepingMessageNote('Alpha'))
    expect(registry.get('Alpha')?.status).toBe('sleeping')
    expect(messages.getMessages('Alpha', true).map((m) => m.message)).toEqual(['hi'])
  })

  it('an awake recipient gets no sleep note', async () => {
    const { app, registry } = makeApp()
    registry.register({ ...base, name: 'Sender', id: 's1' })
    registry.register(base)
    const res = await request(app).post('/messages/send').send({ from: 'Sender', to: 'Alpha', message: 'hi' })
    expect(res.body.note).toBeUndefined()
    expect(res.body.status).not.toBe('error')
  })
})
