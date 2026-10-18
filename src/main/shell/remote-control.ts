// Claude Code Remote Control, per agent.
//
// Remote Control lets claude.ai/code and the mobile app drive a local
// session. With `remoteControlAtStartup: true` in the user's settings every
// Claude session starts one, so a workspace of ten agents floods the user's
// remote session list with workers nobody wants to drive from a phone.
//
// Cog decides per agent: the orchestrator gets Remote Control (named after
// its project and agent, so it is recognisable in the list); every other
// agent gets it turned off. The user's own setting cannot be undone from a
// project settings file (Claude Code ignores repo-scoped
// `remoteControlAtStartup`), but a `--settings <file>` on the command line
// overrides it. Verified on Claude Code 2.1.301: a user setting of `true`
// plus `--settings` with `false` starts no Remote Control; `--remote-control
// <name>` starts one with that name.

export interface RemoteControlInput {
  id: string
  name: string
  cwd: string
  role?: string
  /** Explicit per-agent choice; when absent the role decides. */
  remoteControl?: boolean
}

/** Settings file content that keeps a session off Remote Control. */
export const REMOTE_CONTROL_OFF_SETTINGS = { remoteControlAtStartup: false } as const

export function isOrchestratorRole(role: string | undefined): boolean {
  return typeof role === 'string' && role.trim().toLowerCase() === 'orchestrator'
}

/** Orchestrators get Remote Control unless told otherwise; everyone else does not. */
export function wantsRemoteControl(config: RemoteControlInput): boolean {
  return config.remoteControl ?? isOrchestratorRole(config.role)
}

const MAX_NAME = 64

/**
 * Session name shown in claude.ai/code: "<project folder> / <agent name>".
 * The name is spliced into a shell command inside double quotes, so only
 * letters, digits, space and ._-/ survive; the agent id is the fallback.
 */
export function remoteControlSessionName(config: RemoteControlInput): string {
  const project = (config.cwd || '').split(/[\\/]+/).filter(Boolean).pop() ?? ''
  const raw = project ? `${project} / ${config.name}` : config.name
  const clean = raw.replace(/[^\p{L}\p{N} ._/-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME).trim()
  return clean || `cog-${config.id}`
}

/**
 * Launch arguments for a Claude session: `--remote-control "<name>"` when
 * the agent should have it, `--settings "<offSettingsPath>"` when not.
 */
export function remoteControlArgs(config: RemoteControlInput, offSettingsPath: string): string {
  if (wantsRemoteControl(config)) return ` --remote-control "${remoteControlSessionName(config)}"`
  return ` --settings "${offSettingsPath}"`
}
