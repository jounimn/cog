import { describe, it, expect } from 'vitest'
import { sleepingMessageNote, sleepingBroadcastNote } from './sleep-notes'

describe('sleepingMessageNote', () => {
  it('names the sleeping recipient and says the message is queued', () => {
    expect(sleepingMessageNote('Ada')).toBe(
      '"Ada" is sleeping; your message is queued and will be delivered when a task or the user wakes it'
    )
  })
})

describe('sleepingBroadcastNote', () => {
  it('is undefined when nobody is asleep', () => {
    expect(sleepingBroadcastNote([])).toBeUndefined()
  })

  it('uses the single-recipient note for one sleeper', () => {
    expect(sleepingBroadcastNote(['Ada'])).toBe(sleepingMessageNote('Ada'))
  })

  it('lists every sleeper once in a single note', () => {
    expect(sleepingBroadcastNote(['Ada', 'Bob'])).toBe(
      '"Ada", "Bob" are sleeping; your message is queued and will be delivered when a task or the user wakes them'
    )
  })
})
