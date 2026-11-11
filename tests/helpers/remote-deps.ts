import { vi } from 'vitest'
import { TokenManager } from '../../src/main/remote/token-manager'
import type { RemoteServerDeps } from '../../src/main/remote/remote-server'

/**
 * A complete RemoteServerDeps with inert defaults. Typed as the full interface
 * so a dep added to RemoteServer shows up here as a type error instead of a
 * runtime 500 in every route test.
 */
export function makeRemoteDeps(overrides: Partial<RemoteServerDeps> = {}): RemoteServerDeps {
  const deps: RemoteServerDeps = {
    tokenManager: new TokenManager(() => 1_000_000),
    getProjectName: () => 'TestProject',
    getAgents: () => [],
    getSchedules: () => [],
    getPinboardTasks: () => [],
    getAgentOutput: () => [],
    sendMessage: vi.fn(),
    pauseSchedule: vi.fn(),
    resumeSchedule: vi.fn(),
    restartSchedule: vi.fn(),
    postTask: vi.fn(),
    getInfoEntries: () => [],
    getWorkshopPasscodeSet: () => false,
    getWorkspaceState: () => null,
    getWorkshopPasscodeHash: () => null,
    killAgent: vi.fn(),
    spawnAgentFromWorkshop: vi.fn(),
    onWorkshopWindowUpdate: vi.fn(),
    onWorkshopPanelToggle: vi.fn(),
    getAgentLayouts: () => ({}),
    getInboxMessages: () => [],
    getInboxUnreadCount: () => 0,
    markInboxRead: () => true,
    approveProposal: async () => ({ success: true }),
    rejectProposal: () => ({ success: true }),
    replyToInbox: () => ({ success: true }),
    getTrollboxState: () => null,
    sendTrollboxMessage: async () => ({ ok: true }),
    getPresets: () => []
  }
  return { ...deps, ...overrides }
}
