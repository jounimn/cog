import { describe, it, expect } from 'vitest'
import { detectPermissionMode, mayCarryPermissionMode, permissionModeArgs } from '../../src/main/shell/permission-mode'

describe('detectPermissionMode', () => {
  it('reads the mode line Claude Code draws in its input box', () => {
    expect(detectPermissionMode('\x1b[2K⏵⏵ bypass permissions on (shift+tab to cycle)')).toBe('bypassPermissions')
    expect(detectPermissionMode('⏵⏵ auto mode on (shift+tab to cycle) · ← 3 agents')).toBe('auto')
    expect(detectPermissionMode('⏵⏵ accept edits on (shift+tab to cycle)')).toBe('acceptEdits')
    expect(detectPermissionMode('⏸ plan mode on (shift+tab to cycle)')).toBe('plan')
    expect(detectPermissionMode("⏵⏵ don't ask on (shift+tab to cycle)")).toBe('dontAsk')
  })

  it('treats the bare shortcut hint as default mode', () => {
    expect(detectPermissionMode('❯ \x1b[2m? for shortcuts\x1b[22m')).toBe('default')
  })

  it('takes the last marker in a chunk, since a redraw prints the current mode after the stale one', () => {
    expect(detectPermissionMode('⏵⏵ bypass permissions on (shift+tab to cycle)\x1b[5;1H? for shortcuts')).toBe('default')
    expect(detectPermissionMode('? for shortcuts\x1b[5;1H⏵⏵ accept edits on (shift+tab to cycle)')).toBe('acceptEdits')
  })

  it('survives the markers being split across ANSI sequences and spinner lines', () => {
    expect(detectPermissionMode('✻ Brewing…\x1b[K\x1b[38;2;1;2;3m⏵⏵ bypass permissions \x1b[0mon (shift+tab to cycle)')).toBe('bypassPermissions')
  })

  it('returns undefined when no mode line is in the chunk', () => {
    expect(detectPermissionMode('Cooked for 19s · done 04:22')).toBeUndefined()
    expect(mayCarryPermissionMode('Cooked for 19s')).toBe(false)
    expect(mayCarryPermissionMode('⏵⏵ auto mode on (shift+tab to cycle)')).toBe(true)
  })
})

describe('permissionModeArgs', () => {
  it('Auto Mode always means bypass', () => {
    expect(permissionModeArgs({ autoMode: true })).toBe(' --dangerously-skip-permissions')
    expect(permissionModeArgs({ autoMode: true, permissionMode: 'plan' })).toBe(' --dangerously-skip-permissions')
  })

  it('passes a remembered non-default mode back with --permission-mode', () => {
    expect(permissionModeArgs({ autoMode: false, permissionMode: 'acceptEdits' })).toBe(' --permission-mode acceptEdits')
    expect(permissionModeArgs({ autoMode: false, permissionMode: 'auto' })).toBe(' --permission-mode auto')
    expect(permissionModeArgs({ autoMode: false, permissionMode: 'bypassPermissions' })).toBe(' --dangerously-skip-permissions')
  })

  it('adds nothing for default, unknown or missing modes', () => {
    expect(permissionModeArgs({ autoMode: false })).toBe('')
    expect(permissionModeArgs({ autoMode: false, permissionMode: 'default' })).toBe('')
    expect(permissionModeArgs({ autoMode: false, permissionMode: 'rm -rf' })).toBe('')
  })
})
