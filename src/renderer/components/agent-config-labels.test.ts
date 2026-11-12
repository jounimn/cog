import { describe, it, expect } from 'vitest'
import { shellLabel, autoModeFlag } from './AgentConfigForm'

describe('shellLabel', () => {
  it('names every shell as before', () => {
    expect(shellLabel('powershell')).toBe('PowerShell')
    expect(shellLabel('cmd')).toBe('Command Prompt (cmd)')
    expect(shellLabel('wsl')).toBe('WSL (recommended for Codex on Windows)')
    expect(shellLabel('bash')).toBe('Bash')
    expect(shellLabel('zsh')).toBe('Zsh')
    expect(shellLabel('fish')).toBe('Fish')
  })
})

describe('autoModeFlag', () => {
  it('maps each CLI to its auto-approve flag', () => {
    expect(autoModeFlag('claude')).toBe('(--dangerously-skip-permissions)')
    expect(autoModeFlag('openclaude')).toBe('(--dangerously-skip-permissions)')
    expect(autoModeFlag('codex')).toBe('(--yolo)')
    expect(autoModeFlag('kimi')).toBe('(--yolo)')
    expect(autoModeFlag('gemini')).toBe('(--yolo)')
    expect(autoModeFlag('copilot')).toBe('(--allow-all)')
    expect(autoModeFlag('pi')).toBe('(Pi has no prompts — always auto)')
  })

  it('falls back to auto-run', () => {
    expect(autoModeFlag('terminal')).toBe('(auto-run)')
    expect(autoModeFlag('')).toBe('(auto-run)')
  })
})
