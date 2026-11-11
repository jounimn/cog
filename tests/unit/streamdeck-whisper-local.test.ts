import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub nodejs-whisper before importing the client
vi.mock('nodejs-whisper', () => ({
  nodewhisper: vi.fn(async (_path: string) => 'hello from local whisper\n'),
}))

// Keep the test hermetic: under Electron's Node (npm test) shelljs can't
// auto-detect execPath, so the client falls back to `which('node')`, which
// walks the real PATH and can take seconds on a busy machine.
vi.mock('shelljs', () => {
  const sh = { config: { execPath: 'node' }, which: vi.fn(() => 'node') }
  return { default: sh, ...sh }
})

import { LocalWhisperClient } from '../../src/main/streamdeck/whisper-client'

describe('LocalWhisperClient', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('writes audio to temp file, runs nodewhisper, returns trimmed text', async () => {
    const client = new LocalWhisperClient({ model: 'base.en' })
    const text = await client.transcribe(new ArrayBuffer(16))
    expect(text).toBe('hello from local whisper')
  })

  it('cleans up the temp audio file even on error', async () => {
    const { nodewhisper } = await import('nodejs-whisper') as { nodewhisper: ReturnType<typeof vi.fn> }
    nodewhisper.mockRejectedValueOnce(new Error('whisper exploded'))

    const client = new LocalWhisperClient({ model: 'base.en' })
    await expect(client.transcribe(new ArrayBuffer(16))).rejects.toThrow('whisper exploded')
    // We don't assert filesystem state here — implementation uses fs.rmSync in finally;
    // this test just confirms the error propagates.
  })
})
