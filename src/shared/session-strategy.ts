// How each CLI's session is resumed (see src/main/agent-session.ts). Shared so
// the renderer can tell which agents are able to sleep without importing
// main-process modules.
export type SessionStrategy = 'pinnable' | 'discovered' | 'directory' | 'none'

export function sessionStrategyFor(cli: string): SessionStrategy {
  switch (cli) {
    case 'claude':
    case 'openclaude':
    case 'gemini':
    case 'copilot':
    case 'grok':
      return 'pinnable'
    case 'codex':
    case 'kimi':
      return 'discovered'
    case 'pi':
      return 'directory'
    default:
      return 'none'
  }
}
