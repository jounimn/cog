import React, { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { AgentConfig } from '../../shared/types'
import { SkillBrowser } from './SkillBrowser'
import { Button, Checkbox, Field, Icon, Input, Row, Select, Textarea } from '../ui'
import { agentSlug, defaultWorktreeForRole } from '../../shared/agent-worktree-defaults'

export const ROLE_PRESETS = [
  { label: 'Orchestrator', value: 'orchestrator', hint: 'Coordinates agents, dispatches tasks, synthesizes results' },
  { label: 'Worker', value: 'worker', hint: 'Executes tasks assigned by the orchestrator' },
  { label: 'Researcher', value: 'researcher', hint: 'Gathers information, reads docs, explores codebases' },
  { label: 'Reviewer', value: 'reviewer', hint: 'Reviews code and work from other agents' },
  { label: 'Custom', value: '', hint: '' }
]

export const CLI_PRESETS = [
  { label: 'Claude Code', value: 'claude' },
  { label: 'Codex CLI', value: 'codex' },
  { label: 'Kimi CLI', value: 'kimi' },
  { label: 'Gemini CLI', value: 'gemini' },
  { label: 'OpenClaude (Any Model)', value: 'openclaude' },
  { label: 'GitHub Copilot CLI', value: 'copilot' },
  { label: 'Grok CLI (Experimental)', value: 'grok' },
  { label: 'Pi (pi.dev)', value: 'pi' },
  { label: 'Plain Terminal', value: 'terminal' },
  { label: 'Custom', value: '' }
]

export const CLI_MODELS: Record<string, { label: string; value: string }[]> = {
  claude: [
    { label: 'Fable 5', value: 'claude-fable-5' },
    { label: 'Sonnet', value: 'sonnet' },
    { label: 'Opus', value: 'opus' },
    { label: 'Haiku', value: 'haiku' },
    { label: 'Opus [1M context]', value: 'opus[1m]' },
    { label: 'Sonnet [1M context]', value: 'sonnet[1m]' },
    { label: 'Default (no --model flag)', value: '' },
  ],
  codex: [
    { label: 'o4-mini (default)', value: '' },
    { label: 'GPT-5.5', value: 'gpt-5.5' },
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5', value: 'gpt-5' },
    { label: 'o3', value: 'o3' },
    { label: 'o3-pro', value: 'o3-pro' },
    { label: 'GPT-4.1', value: 'gpt-4.1' },
    { label: 'GPT-4.1 mini', value: 'gpt-4.1-mini' },
  ],
  kimi: [
    // kimi-cli's --model flag is broken — passing any value resets auth.
    // Only the "default" (no flag) option works; switch models from inside
    // kimi via `/model`. See cli-launch.ts kimi branch for the rationale.
    { label: 'Default (use /model inside kimi to switch)', value: '' },
  ],
  gemini: [
    { label: 'Default', value: '' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    { label: 'Gemini 2.0 Flash Thinking', value: 'gemini-2.0-flash-thinking' },
  ],
  copilot: [
    { label: 'Default (Copilot model)', value: '' },
    { label: 'GPT-5.5', value: 'gpt-5.5' },
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5', value: 'gpt-5' },
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'o3', value: 'o3' },
    { label: 'o4-mini', value: 'o4-mini' },
  ],
  grok: [
    { label: 'Default', value: '' },
    { label: 'Grok 3', value: 'grok-3' },
    { label: 'Grok 3 Mini', value: 'grok-3-mini' },
    { label: 'Grok 2', value: 'grok-2' },
  ],
  pi: [
    // Pi is model-agnostic; you pick the model/provider during Pi's own first-run
    // setup. The Cog passes no --model flag. See cli-launch.ts pi branch.
    { label: 'Configured in Pi (set on first run)', value: '' },
  ],
  openclaude: [
    // OpenAI
    { label: 'GPT-5.5', value: 'gpt-5.5' },
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5', value: 'gpt-5' },
    { label: 'GPT-4o', value: 'gpt-4o' },
    { label: 'GPT-4.1', value: 'gpt-4.1' },
    { label: 'GPT-4.1 mini', value: 'gpt-4.1-mini' },
    { label: 'o3', value: 'o3' },
    { label: 'o3-pro', value: 'o3-pro' },
    { label: 'o4-mini', value: 'o4-mini' },
    // Google (via OpenRouter/OpenAI-compatible)
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    // DeepSeek
    { label: 'DeepSeek V3', value: 'deepseek-chat' },
    { label: 'DeepSeek R1', value: 'deepseek-reasoner' },
    // Meta / Ollama
    { label: 'Llama 4 Scout (Ollama)', value: 'llama4-scout' },
    { label: 'Llama 4 Maverick (Ollama)', value: 'llama4-maverick' },
    { label: 'Llama 3.3 70B (Ollama)', value: 'llama3.3' },
    { label: 'Llama 3.1 8B (Ollama)', value: 'llama3.1:8b' },
    // Mistral
    { label: 'Mistral Large', value: 'mistral-large-latest' },
    { label: 'Codestral', value: 'codestral-latest' },
    // Qwen
    { label: 'Qwen 3 (Ollama)', value: 'qwen3' },
    { label: 'Qwen 2.5 Coder (Ollama)', value: 'qwen2.5-coder' },
    // Custom
    { label: 'Custom Model', value: '' },
  ],
}

export const OPENCLAUDE_PROVIDERS: { label: string; url: string }[] = [
  { label: 'OpenAI', url: 'https://api.openai.com/v1' },
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  { label: 'Together AI', url: 'https://api.together.xyz/v1' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
  { label: 'Ollama (Local)', url: 'http://localhost:11434/v1' },
  { label: 'Custom URL', url: '' },
]

const WINDOWS_SHELLS: AgentConfig['shell'][] = ['powershell', 'cmd', 'wsl']
const POSIX_SHELLS: AgentConfig['shell'][] = ['bash', 'zsh', 'fish']

export interface AgentConfigFormValue {
  name: string
  cli: string
  customCli: string
  cwd: string
  role: string
  customRole: string
  ceoNotes: string
  shell: AgentConfig['shell']
  admin: boolean
  autoMode: boolean
  promptRegex: string
  model: string
  customModel: string
  providerUrl: string
  customProviderUrl: string
  selectedSkills: Array<{ id: string; name: string }>
  showAdvanced: boolean
  worktree: boolean
  worktreeTouched: boolean
  spawnAsleep: boolean
  neverSleep: boolean
}

export interface AgentConfigFormProps {
  value: AgentConfigFormValue
  onChange: Dispatch<SetStateAction<AgentConfigFormValue>>
  /** Inline error messages keyed by field name */
  errors?: Partial<Record<keyof AgentConfigFormValue, string>>
  /** Spawn asleep is creation-only; the edit dialog hides it. */
  hideSpawnAsleep?: boolean
}

export function buildSubmitConfig(v: AgentConfigFormValue): Omit<AgentConfig, 'id'> {
  return {
    name: v.name.trim(),
    cli: v.cli || v.customCli.trim(),
    cwd: v.cwd.trim(),
    role: (v.role || v.customRole).trim(),
    ceoNotes: v.ceoNotes.trim(),
    shell: v.shell,
    admin: v.admin,
    autoMode: v.autoMode,
    promptRegex: v.promptRegex.trim() || undefined,
    model: (v.model || v.customModel.trim()) || undefined,
    providerUrl: v.cli === 'openclaude' ? (v.providerUrl || v.customProviderUrl.trim()) || undefined : undefined,
    experimental: v.cli === 'grok' ? true : undefined,
    skills: v.selectedSkills.length > 0 ? v.selectedSkills.map(s => s.id) : undefined,
    worktree: (v.cli || v.customCli.trim()) === 'terminal' ? false : v.worktree,
    spawnAsleep: v.spawnAsleep || undefined,
    neverSleep: v.neverSleep || undefined,
  }
}

export function emptyFormValue(defaults?: Partial<AgentConfigFormValue>): AgentConfigFormValue {
  const isWindows = navigator.platform.toLowerCase().includes('win')
  return {
    name: '',
    cli: 'claude',
    customCli: '',
    cwd: '',
    role: 'worker',
    customRole: '',
    ceoNotes: '',
    shell: isWindows ? 'powershell' : 'bash',
    admin: false,
    autoMode: false,
    promptRegex: '',
    model: 'sonnet',
    customModel: '',
    providerUrl: 'https://api.openai.com/v1',
    customProviderUrl: '',
    selectedSkills: [],
    showAdvanced: false,
    worktree: defaultWorktreeForRole('worker', 'claude'),
    worktreeTouched: false,
    spawnAsleep: false,
    neverSleep: false,
    ...defaults,
  }
}

export function AgentConfigForm({ value, onChange, errors, hideSpawnAsleep }: AgentConfigFormProps): React.ReactElement {
  const [showSkillBrowser, setShowSkillBrowser] = useState(false)
  const isWindows = navigator.platform.toLowerCase().includes('win')
  const shellOptions = isWindows ? WINDOWS_SHELLS : POSIX_SHELLS

  const set = <K extends keyof AgentConfigFormValue>(key: K, v: AgentConfigFormValue[K]) => {
    onChange(prev => {
      const next = { ...prev, [key]: v }
      if (key === 'role' || key === 'customRole' || key === 'cli' || key === 'customCli') {
        const cli = (next.cli || next.customCli).trim()
        if (cli === 'terminal') next.worktree = false
        else if (!next.worktreeTouched) next.worktree = defaultWorktreeForRole((next.role || next.customRole).trim(), cli)
      }
      return next
    })
  }
  const effectiveCli = (value.cli || value.customCli).trim()
  const worktreeSlug = agentSlug(value.name) || 'agent'

  // Reset model + provider to defaults when CLI actually changes (not on mount)
  const prevCliRef = useRef(value.cli)
  useEffect(() => {
    if (prevCliRef.current !== value.cli) {
      prevCliRef.current = value.cli
      onChange(prev => ({
        ...prev,
        model: '',
        customModel: '',
        providerUrl: 'https://api.openai.com/v1',
        customProviderUrl: '',
      }))
    }
  }, [value.cli])

  // Keep shell valid when platform changes
  useEffect(() => {
    if (!shellOptions.includes(value.shell)) {
      set('shell', shellOptions[0])
    }
  }, [isWindows])

  return (
    <>
      <Field label="Name" error={errors?.name}>
        <Input value={value.name} onChange={e => set('name', e.target.value)} required placeholder="worker-1" aria-invalid={errors?.name ? true : undefined} />
      </Field>

      <Field label="CLI">
        <Select value={value.cli} onChange={v => set('cli', v)} options={CLI_PRESETS} />
      </Field>

      {value.cli === '' && (
        <Field label="Custom command">
          <Input mono value={value.customCli} onChange={e => set('customCli', e.target.value)} required placeholder="my-agent --flag" />
        </Field>
      )}

      {CLI_MODELS[value.cli] && (
        <Field label="Model">
          <Select value={value.model} onChange={v => set('model', v)} options={CLI_MODELS[value.cli]} />
        </Field>
      )}

      {value.cli === 'grok' && (
        <p className="cog-agentform__note cog-tone-warning">
          Experimental integration: community-maintained Grok CLI support may change underneath us.
        </p>
      )}
      {value.cli === 'pi' && (
        <p className="cog-agentform__note cog-tone-success">
          Pi runs tools without permission prompts and uses the model/provider you
          set up inside Pi. The Cog auto-installs pi-mcp-adapter on first launch so
          Pi can reach the hub tools. Requires the `pi` CLI on your PATH.
        </p>
      )}

      {value.cli === 'openclaude' && (
        <Field label="Provider">
          <Select
            value={value.providerUrl}
            onChange={v => set('providerUrl', v)}
            options={OPENCLAUDE_PROVIDERS.map(p => ({ value: p.url, label: p.label }))}
          />
        </Field>
      )}

      {value.cli === 'openclaude' && value.providerUrl === '' && (
        <Field label="Custom provider URL">
          <Input
            mono
            value={value.customProviderUrl}
            onChange={e => set('customProviderUrl', e.target.value)}
            placeholder="https://api.example.com/v1"
            required
          />
        </Field>
      )}

      {value.cli === 'openclaude' && value.model === '' && (
        <Field label="Custom model name">
          <Input
            mono
            value={value.customModel}
            onChange={e => set('customModel', e.target.value)}
            placeholder="e.g. gpt-4o-mini, codellama"
          />
        </Field>
      )}

      <Field label="Working directory" error={errors?.cwd}>
        <div className="cog-field__inline">
          <Input mono value={value.cwd} onChange={e => set('cwd', e.target.value)} aria-invalid={errors?.cwd ? true : undefined} />
          <Button
            variant="ghost"
            onClick={() => window.electronAPI.browseDirectory(value.cwd).then(d => { if (d) set('cwd', d) })}
          >
            <Icon name="folder-open" size={14} />Browse
          </Button>
        </div>
      </Field>

      <div className="cog-dialog__checks">
        <div>
          <Checkbox
            checked={effectiveCli === 'terminal' ? false : value.worktree}
            disabled={effectiveCli === 'terminal'}
            onChange={checked => onChange(prev => ({ ...prev, worktree: checked, worktreeTouched: true }))}
          >
            Isolated worktree
          </Checkbox>
          <div className="cog-dialog__checkhint">
            <span className="cog-mono">.cog/worktrees/{worktreeSlug}</span> · branch <span className="cog-mono">cog/{worktreeSlug}</span>
          </div>
        </div>

        {!hideSpawnAsleep && (
          <Checkbox
            checked={value.spawnAsleep}
            onChange={checked => onChange(prev => ({ ...prev, spawnAsleep: checked }))}
          >
            Spawn asleep (wake on first task)
          </Checkbox>
        )}

        <Checkbox
          checked={value.neverSleep}
          onChange={checked => onChange(prev => ({ ...prev, neverSleep: checked }))}
        >
          Never sleep
        </Checkbox>
      </div>

      <Field label="Role" help={ROLE_PRESETS.find(r => r.value === value.role)?.hint}>
        <Select value={value.role} onChange={v => set('role', v)} options={ROLE_PRESETS} />
      </Field>

      {value.role === '' && (
        <Field label="Custom role">
          <Input value={value.customRole} onChange={e => set('customRole', e.target.value)} required placeholder="e.g. Monitor, Tester" />
        </Field>
      )}

      <div className="cog-field cog-agentform__skills" role="group" aria-label="Skills (optional)">
        <span className="cog-field__label">Skills (optional)</span>
        {value.selectedSkills.length > 0 && (
          <div className="cog-dialog__list">
            {value.selectedSkills.map(skill => (
              <Row
                key={skill.id}
                icon={<Icon name="check" size={12} />}
                title={skill.name}
                actions={
                  <Button
                    variant="icon"
                    onClick={() => set('selectedSkills', value.selectedSkills.filter(s => s.id !== skill.id))}
                    aria-label={`Remove ${skill.name}`}
                    title="Remove"
                  >
                    <Icon name="x" size={14} />
                  </Button>
                }
              />
            ))}
          </div>
        )}
        <Button variant="ghost" className="cog-agentform__addskills" onClick={() => setShowSkillBrowser(true)}>
          <Icon name="plus" size={14} />Add skills
        </Button>
      </div>

      <Field label="CEO notes">
        <Textarea
          value={value.ceoNotes}
          onChange={e => set('ceoNotes', e.target.value)}
          rows={4}
          className="cog-agentform__notes"
          placeholder="Instructions for this agent..."
        />
      </Field>

      <div className="cog-dialog__checks">
        <div>
          <Checkbox checked={value.autoMode} onChange={checked => set('autoMode', checked)}>
            Auto-approve mode
          </Checkbox>
          <div className="cog-dialog__checkhint">
            <span className="cog-mono">{autoModeFlag(value.cli)}</span>
          </div>
        </div>

        <Checkbox checked={value.admin} onChange={checked => set('admin', checked)}>
          Run as admin
        </Checkbox>
      </div>

      <button
        type="button"
        className="cog-disclosure cog-disclosure--inline cog-agentform__advanced"
        aria-expanded={value.showAdvanced}
        onClick={() => set('showAdvanced', !value.showAdvanced)}
      >
        <Icon name={value.showAdvanced ? 'chevron-down' : 'chevron-right'} size={14} />Advanced
      </button>

      {value.showAdvanced && (
        <>
          <Field
            label="Shell"
            help={value.shell === 'wsl'
              ? 'Runs the agent inside your default WSL distro (real Linux PTY — fixes the Codex Enter-key freeze on Windows). Requires WSL installed and codex/node available inside the distro. Windows paths like C:\\… are auto-translated to /mnt/c/…'
              : isWindows ? 'Use cmd if a CLI is not found in PowerShell' : 'Pick the shell that matches your local CLI setup'}
          >
            <Select
              value={value.shell}
              onChange={v => set('shell', v)}
              options={shellOptions.map(option => ({ value: option, label: shellLabel(option) }))}
            />
          </Field>
          <Field label="Prompt regex override">
            <Input mono value={value.promptRegex} onChange={e => set('promptRegex', e.target.value)} placeholder="[>❯]\\s*$" />
          </Field>
        </>
      )}

      {showSkillBrowser && (
        <SkillBrowser
          selectedIds={value.selectedSkills.map(s => s.id)}
          onToggleSkill={(skill) => {
            const exists = value.selectedSkills.find(s => s.id === skill.id)
            if (exists) {
              set('selectedSkills', value.selectedSkills.filter(s => s.id !== skill.id))
            } else {
              set('selectedSkills', [...value.selectedSkills, { id: skill.id, name: skill.name }])
            }
          }}
          onClose={() => setShowSkillBrowser(false)}
        />
      )}
    </>
  )
}

/** Display label for a shell option in the Advanced section. */
export function shellLabel(option: AgentConfig['shell']): string {
  return option === 'powershell' ? 'PowerShell' :
    option === 'cmd' ? 'Command Prompt (cmd)' :
    option === 'wsl' ? 'WSL (recommended for Codex on Windows)' :
    option === 'bash' ? 'Bash' :
    option === 'zsh' ? 'Zsh' : 'Fish'
}

/** The auto-approve flag shown beside the checkbox, per CLI. */
export function autoModeFlag(cli: string): string {
  return cli === 'claude' ? '(--dangerously-skip-permissions)' :
    cli === 'openclaude' ? '(--dangerously-skip-permissions)' :
    cli === 'codex' ? '(--yolo)' :
    cli === 'kimi' ? '(--yolo)' :
    cli === 'gemini' ? '(--yolo)' :
    cli === 'copilot' ? '(--allow-all)' :
    cli === 'pi' ? '(Pi has no prompts — always auto)' : '(auto-run)'
}
