import { describe, it, expect } from 'vitest'
import {
  wantsRemoteControl,
  remoteControlSessionName,
  remoteControlArgs,
  REMOTE_CONTROL_OFF_SETTINGS
} from '../../src/main/shell/remote-control'

const agent = (over: Partial<Parameters<typeof wantsRemoteControl>[0]> = {}) => ({
  id: 'a1',
  name: 'worker-1',
  cwd: 'C:\\Users\\me\\Projects\\Produção-Sites',
  role: 'worker',
  ...over
})

describe('wantsRemoteControl', () => {
  it('is on for an orchestrator and off for everyone else, by role', () => {
    expect(wantsRemoteControl(agent({ role: 'orchestrator' }))).toBe(true)
    expect(wantsRemoteControl(agent({ role: ' Orchestrator ' }))).toBe(true)
    expect(wantsRemoteControl(agent({ role: 'worker' }))).toBe(false)
    expect(wantsRemoteControl(agent({ role: 'reviewer' }))).toBe(false)
    expect(wantsRemoteControl(agent({ role: undefined }))).toBe(false)
  })

  it('lets an explicit per-agent choice override the role', () => {
    expect(wantsRemoteControl(agent({ role: 'orchestrator', remoteControl: false }))).toBe(false)
    expect(wantsRemoteControl(agent({ role: 'worker', remoteControl: true }))).toBe(true)
  })
})

describe('remoteControlSessionName', () => {
  it('names the session after the project folder and the agent', () => {
    expect(remoteControlSessionName(agent({ name: 'orchestrator' }))).toBe('Produção-Sites / orchestrator')
    expect(remoteControlSessionName(agent({ name: 'orchestrator', cwd: '/home/me/proj/' }))).toBe('proj / orchestrator')
  })

  it('strips anything that could break out of the shell quotes', () => {
    expect(remoteControlSessionName(agent({ name: 'orch"; rm -rf ~ #', cwd: 'C:\\p' }))).toBe('p / orch rm -rf')
    expect(remoteControlSessionName(agent({ name: '$(whoami)`x`', cwd: 'C:\\p' }))).toBe('p / whoami x')
  })

  it('falls back to the agent id when nothing printable is left, and caps the length', () => {
    expect(remoteControlSessionName(agent({ name: '"""', cwd: '' }))).toBe('cog-a1')
    expect(remoteControlSessionName(agent({ name: 'x'.repeat(200), cwd: 'C:\\p' })).length).toBeLessThanOrEqual(64)
  })
})

describe('remoteControlArgs', () => {
  it('turns Remote Control on with a name for an orchestrator', () => {
    expect(remoteControlArgs(agent({ role: 'orchestrator', name: 'orchestrator' }), 'C:\\tmp\\off.json'))
      .toBe(' --remote-control "Produção-Sites / orchestrator"')
  })

  it('turns it off through a settings file for everyone else', () => {
    expect(remoteControlArgs(agent(), 'C:\\tmp\\off.json')).toBe(' --settings "C:\\tmp\\off.json"')
    expect(REMOTE_CONTROL_OFF_SETTINGS).toEqual({ remoteControlAtStartup: false })
  })
})
