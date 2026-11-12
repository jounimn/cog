import React, { useState, useEffect } from 'react'
import type { AgentConfig, AgentState, WorkspacePreset, WindowPosition, CanvasState, CommunityTeam, CommunityTeamListItem, CommunityCategory, CommunityAgent } from '../../shared/types'
import type { WindowState } from '../hooks/useWindowManager'
import { CLI_MODELS } from './SpawnDialog'
import { Dialog, Field, Button, Icon, Input, Textarea, Select, Segmented, Checkbox, Row, SectionHeader, EmptyState, Loading, type IconName } from '../ui'

interface PresetDialogProps {
  agents: AgentState[]
  windows: WindowState[]
  zoom: number
  pan: { x: number; y: number }
  onLoadPreset: (configs: Omit<AgentConfig, 'id'>[], windows: WindowPosition[], canvas: CanvasState) => void
  onClose: () => void
}

interface PresetInfo {
  name: string
  savedAt: string
}

type Tab = 'save' | 'load' | 'templates' | 'community'

type CommunityCategoryOrAll = CommunityCategory | 'all'

const COMMUNITY_CATEGORIES: { value: CommunityCategoryOrAll; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'research', label: 'Research' },
  { value: 'coding', label: 'Coding' },
  { value: 'review', label: 'Review' },
  { value: 'full-stack', label: 'Full-Stack' },
  { value: 'decomp', label: 'Decomp' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'other', label: 'Other' }
]

interface PresetTemplate {
  name: string
  description: string
  requiredClis: string[]
  agents: Omit<AgentConfig, 'id' | 'cwd'>[]
}

const BUILT_IN_TEMPLATES: PresetTemplate[] = [
  {
    name: 'Orchestrator + Workers',
    description: '1 orchestrator (Opus) directing 2 workers (Sonnet). Classic delegation pattern.',
    requiredClis: ['claude'],
    agents: [
      { name: 'orchestrator', cli: 'claude', role: 'orchestrator', ceoNotes: 'You are the lead. Break tasks into subtasks and delegate to workers. Synthesize their results. Use post_task() and send_message() to coordinate.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'worker-1', cli: 'claude', role: 'worker', ceoNotes: 'You are a worker. Check read_tasks() and get_messages() for assignments. Complete tasks and report back to the orchestrator.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'worker-2', cli: 'claude', role: 'worker', ceoNotes: 'You are a worker. Check read_tasks() and get_messages() for assignments. Complete tasks and report back to the orchestrator.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
    ]
  },
  {
    name: 'Research Squad',
    description: '1 orchestrator + 3 researchers. Deep research with parallel information gathering.',
    requiredClis: ['claude'],
    agents: [
      { name: 'lead', cli: 'claude', role: 'orchestrator', ceoNotes: 'You coordinate a research team. Break research questions into sub-questions. Assign to researchers via post_task(). Synthesize findings posted to the info channel.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'researcher-1', cli: 'claude', role: 'researcher', ceoNotes: 'You are a researcher. Check read_tasks() for research assignments. Post findings to post_info() with relevant tags.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'researcher-2', cli: 'claude', role: 'researcher', ceoNotes: 'You are a researcher. Check read_tasks() for research assignments. Post findings to post_info() with relevant tags.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'researcher-3', cli: 'claude', role: 'researcher', ceoNotes: 'You are a researcher. Check read_tasks() for research assignments. Post findings to post_info() with relevant tags.', shell: 'powershell', admin: false, autoMode: true, model: 'haiku' },
    ]
  },
  {
    name: 'Code + Review',
    description: '1 coder + 1 reviewer. Continuous code review workflow.',
    requiredClis: ['claude'],
    agents: [
      { name: 'coder', cli: 'claude', role: 'worker', ceoNotes: 'You write code. After completing each change, send_message() to the reviewer with a summary of what changed and why.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'reviewer', cli: 'claude', role: 'reviewer', ceoNotes: 'You review code. When the coder messages you, use get_agent_output() to see their terminal, review the changes, and send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
    ]
  },
  {
    name: 'Speed Swarm',
    description: '3 Haiku agents for maximum throughput on simple parallel tasks.',
    requiredClis: ['claude'],
    agents: [
      { name: 'swarm-1', cli: 'claude', role: 'worker', ceoNotes: 'You are a fast worker. Check read_tasks() for assignments. Complete them quickly and move to the next.', shell: 'powershell', admin: false, autoMode: true, model: 'haiku' },
      { name: 'swarm-2', cli: 'claude', role: 'worker', ceoNotes: 'You are a fast worker. Check read_tasks() for assignments. Complete them quickly and move to the next.', shell: 'powershell', admin: false, autoMode: true, model: 'haiku' },
      { name: 'swarm-3', cli: 'claude', role: 'worker', ceoNotes: 'You are a fast worker. Check read_tasks() for assignments. Complete them quickly and move to the next.', shell: 'powershell', admin: false, autoMode: true, model: 'haiku' },
    ]
  },
  {
    name: 'Solo Opus',
    description: '1 Opus agent. Full power, no coordination overhead.',
    requiredClis: ['claude'],
    agents: [
      { name: 'agent', cli: 'claude', role: 'worker', ceoNotes: 'You are a solo agent. Check read_tasks() and get_messages() for work. You have full autonomy to plan and execute.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
    ]
  },
  {
    name: 'TDD Pipeline',
    description: '1 coder + 1 tester + 1 reviewer. Red-green-refactor workflow.',
    requiredClis: ['claude'],
    agents: [
      { name: 'coder', cli: 'claude', role: 'worker', ceoNotes: 'You implement features. Wait for test specs from the tester before writing code. After implementing, send_message() to the reviewer.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'tester', cli: 'claude', role: 'worker', ceoNotes: 'You write tests FIRST. When a task is posted, write failing tests that define the expected behavior, then send_message() to the coder with the test file path.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'reviewer', cli: 'claude', role: 'reviewer', ceoNotes: 'You review completed work. When the coder messages you, review both tests and implementation. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
    ]
  },
  {
    name: 'Documentation Team',
    description: '1 researcher + 1 writer + 1 reviewer. Produce polished documentation.',
    requiredClis: ['claude'],
    agents: [
      { name: 'researcher', cli: 'claude', role: 'researcher', ceoNotes: 'You gather information for documentation. Read source code, existing docs, and tests. Post findings to post_info() with tags.', shell: 'powershell', admin: false, autoMode: true, model: 'haiku' },
      { name: 'writer', cli: 'claude', role: 'worker', ceoNotes: 'You write documentation. Use read_info() to access research findings. send_message() to the reviewer when a section is complete.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'reviewer', cli: 'claude', role: 'reviewer', ceoNotes: 'You review documentation for accuracy, clarity, and completeness. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
    ]
  },
  {
    name: 'Rapid Prototyper',
    description: '1 architect (Opus) + 2 builders (Sonnet). Architecture-first rapid development.',
    requiredClis: ['claude'],
    agents: [
      { name: 'architect', cli: 'claude', role: 'orchestrator', ceoNotes: 'You design the architecture first. Post the design to post_info() with tag "architecture". Then break implementation into tasks via post_task().', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'builder-1', cli: 'claude', role: 'worker', ceoNotes: 'You build what the architect designs. Check read_info() for architecture specs, then read_tasks() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'builder-2', cli: 'claude', role: 'worker', ceoNotes: 'You build what the architect designs. Check read_info() for architecture specs, then read_tasks() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
    ]
  },
  {
    name: 'Claude + Codex',
    description: 'Claude Opus orchestrates, Codex o4-mini implements. Best of both ecosystems.',
    requiredClis: ['claude', 'codex'],
    agents: [
      { name: 'lead', cli: 'claude', role: 'orchestrator', ceoNotes: 'You orchestrate. Break tasks down and delegate to the coder via post_task() and send_message().', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'coder', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() and get_messages() for assignments from the lead.', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Claude + Kimi',
    description: 'Claude plans and coordinates, Kimi researches. Dual-brain research team.',
    requiredClis: ['claude', 'kimi'],
    agents: [
      { name: 'planner', cli: 'claude', role: 'orchestrator', ceoNotes: 'You plan research strategy. Break questions into sub-questions. Delegate to the researcher via post_task().', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'researcher', cli: 'kimi', role: 'researcher', ceoNotes: 'You research deeply. Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Claude + Gemini',
    description: 'Claude orchestrates, Gemini 2.5 Pro researches. Google knowledge + Anthropic reasoning.',
    requiredClis: ['claude', 'gemini'],
    agents: [
      { name: 'lead', cli: 'claude', role: 'orchestrator', ceoNotes: 'You coordinate. Delegate research tasks to the researcher. Synthesize findings.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'researcher', cli: 'gemini', role: 'researcher', ceoNotes: 'You research using your broad knowledge. Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  {
    name: 'GPT-4o + DeepSeek',
    description: 'GPT-4o orchestrator, DeepSeek coder. Cost-optimized multi-model team.',
    requiredClis: ['openclaude'],
    agents: [
      { name: 'lead', cli: 'openclaude', role: 'orchestrator', ceoNotes: 'You orchestrate the team. Break tasks down and delegate.', shell: 'powershell', admin: false, autoMode: true, model: 'gpt-4o', providerUrl: 'https://api.openai.com/v1' },
      { name: 'coder', cli: 'openclaude', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'deepseek-chat', providerUrl: 'https://api.deepseek.com/v1' },
    ]
  },
  {
    name: 'Full OpenAI',
    description: 'GPT-4o lead + 2 GPT-4.1 workers. All OpenAI, maximum compatibility.',
    requiredClis: ['openclaude'],
    agents: [
      { name: 'lead', cli: 'openclaude', role: 'orchestrator', ceoNotes: 'You orchestrate. Break tasks down and delegate to workers.', shell: 'powershell', admin: false, autoMode: true, model: 'gpt-4o', providerUrl: 'https://api.openai.com/v1' },
      { name: 'worker-1', cli: 'openclaude', role: 'worker', ceoNotes: 'You implement. Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'gpt-4.1', providerUrl: 'https://api.openai.com/v1' },
      { name: 'worker-2', cli: 'openclaude', role: 'worker', ceoNotes: 'You implement. Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'gpt-4.1', providerUrl: 'https://api.openai.com/v1' },
    ]
  },
  {
    name: 'DeepSeek Squad',
    description: '3 DeepSeek agents. Cheapest possible multi-agent team.',
    requiredClis: ['openclaude'],
    agents: [
      { name: 'lead', cli: 'openclaude', role: 'orchestrator', ceoNotes: 'You coordinate. Break tasks and delegate.', shell: 'powershell', admin: false, autoMode: true, model: 'deepseek-chat', providerUrl: 'https://api.deepseek.com/v1' },
      { name: 'worker-1', cli: 'openclaude', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for work.', shell: 'powershell', admin: false, autoMode: true, model: 'deepseek-chat', providerUrl: 'https://api.deepseek.com/v1' },
      { name: 'worker-2', cli: 'openclaude', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for work.', shell: 'powershell', admin: false, autoMode: true, model: 'deepseek-chat', providerUrl: 'https://api.deepseek.com/v1' },
    ]
  },
  {
    name: 'Mixed Provider',
    description: 'GPT-4o lead + DeepSeek coder + Claude reviewer. Best of three worlds.',
    requiredClis: ['openclaude', 'claude'],
    agents: [
      { name: 'lead', cli: 'openclaude', role: 'orchestrator', ceoNotes: 'You orchestrate. Delegate coding to the coder, review requests to the reviewer.', shell: 'powershell', admin: false, autoMode: true, model: 'gpt-4o', providerUrl: 'https://api.openai.com/v1' },
      { name: 'coder', cli: 'openclaude', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'deepseek-chat', providerUrl: 'https://api.deepseek.com/v1' },
      { name: 'reviewer', cli: 'claude', role: 'reviewer', ceoNotes: 'You review code. Use get_agent_output() to inspect work. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
    ]
  },
  {
    name: 'OpenRouter Mix',
    description: 'Via OpenRouter: access multiple models with a single API key.',
    requiredClis: ['openclaude'],
    agents: [
      { name: 'lead', cli: 'openclaude', role: 'orchestrator', ceoNotes: 'You orchestrate. Delegate tasks.', shell: 'powershell', admin: false, autoMode: true, model: 'openai/gpt-4o', providerUrl: 'https://openrouter.ai/api/v1' },
      { name: 'coder', cli: 'openclaude', role: 'worker', ceoNotes: 'You implement. Check read_tasks() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'deepseek/deepseek-chat', providerUrl: 'https://openrouter.ai/api/v1' },
    ]
  },
  {
    name: 'Ollama Local',
    description: '2 Llama 3 agents running locally via Ollama. Fully offline, no API keys needed.',
    requiredClis: ['openclaude'],
    agents: [
      { name: 'orchestrator', cli: 'openclaude', role: 'orchestrator', ceoNotes: 'You coordinate local agents. Break tasks and delegate.', shell: 'powershell', admin: false, autoMode: true, model: 'llama3', providerUrl: 'http://localhost:11434/v1' },
      { name: 'worker-1', cli: 'openclaude', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'llama3', providerUrl: 'http://localhost:11434/v1' },
    ]
  },
  {
    name: 'Hybrid Local + Cloud',
    description: 'Ollama worker (free, local) + Claude Opus orchestrator (smart, cloud).',
    requiredClis: ['openclaude', 'claude'],
    agents: [
      { name: 'orchestrator', cli: 'claude', role: 'orchestrator', ceoNotes: 'You orchestrate. The worker runs locally and is slower — give clear, specific instructions.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'worker', cli: 'openclaude', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for assignments. You run locally.', shell: 'powershell', admin: false, autoMode: true, model: 'llama3', providerUrl: 'http://localhost:11434/v1' },
    ]
  },
  // --- Codex-only ---
  {
    name: 'Solo Codex',
    description: '1 Codex agent with o4-mini. Lightweight, fast, OpenAI-powered.',
    requiredClis: ['codex'],
    agents: [
      { name: 'agent', cli: 'codex', role: 'worker', ceoNotes: 'You are a solo agent. Check read_tasks() and get_messages() for work. You have full autonomy.', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Codex Orchestrator + Workers',
    description: '1 o3 orchestrator + 2 o4-mini workers. All OpenAI native.',
    requiredClis: ['codex'],
    agents: [
      { name: 'orchestrator', cli: 'codex', role: 'orchestrator', ceoNotes: 'You are the lead. Break tasks into subtasks and delegate to workers via post_task() and send_message().', shell: 'powershell', admin: false, autoMode: true, model: 'o3' },
      { name: 'worker-1', cli: 'codex', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for assignments. Complete tasks and report back.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'worker-2', cli: 'codex', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for assignments. Complete tasks and report back.', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Codex Code + Review',
    description: '1 o4-mini coder + 1 o3 reviewer. Codex-native code review loop.',
    requiredClis: ['codex'],
    agents: [
      { name: 'coder', cli: 'codex', role: 'worker', ceoNotes: 'You write code. After each change, send_message() to the reviewer with a summary.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'reviewer', cli: 'codex', role: 'reviewer', ceoNotes: 'You review code. When the coder messages you, use get_agent_output() to inspect their work. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: 'o3' },
    ]
  },
  // --- Kimi-only ---
  {
    name: 'Solo Kimi',
    description: '1 Kimi agent. Moonshot-powered, strong at research and Chinese language tasks.',
    requiredClis: ['kimi'],
    agents: [
      { name: 'agent', cli: 'kimi', role: 'worker', ceoNotes: 'You are a solo agent. Check read_tasks() and get_messages() for work.', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Kimi Research Pair',
    description: '1 orchestrator + 1 researcher. Kimi-native deep research team.',
    requiredClis: ['kimi'],
    agents: [
      { name: 'lead', cli: 'kimi', role: 'orchestrator', ceoNotes: 'You plan research. Break questions into sub-questions. Delegate via post_task(). Synthesize findings.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'researcher', cli: 'kimi', role: 'researcher', ceoNotes: 'You research deeply. Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Kimi Code + Review',
    description: '1 coder + 1 reviewer. Kimi-native code review workflow.',
    requiredClis: ['kimi'],
    agents: [
      { name: 'coder', cli: 'kimi', role: 'worker', ceoNotes: 'You write code. After each change, send_message() to the reviewer.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'reviewer', cli: 'kimi', role: 'reviewer', ceoNotes: 'You review code. Use get_agent_output() to inspect work. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  // --- Gemini-only ---
  {
    name: 'Solo Gemini',
    description: '1 Gemini 2.5 Pro agent. Google-powered, strong at broad knowledge tasks.',
    requiredClis: ['gemini'],
    agents: [
      { name: 'agent', cli: 'gemini', role: 'worker', ceoNotes: 'You are a solo agent. Check read_tasks() and get_messages() for work.', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  {
    name: 'Gemini Research Squad',
    description: '1 Pro orchestrator + 2 Flash researchers. Google-native research team.',
    requiredClis: ['gemini'],
    agents: [
      { name: 'lead', cli: 'gemini', role: 'orchestrator', ceoNotes: 'You coordinate research. Break questions into sub-questions. Delegate via post_task().', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
      { name: 'researcher-1', cli: 'gemini', role: 'researcher', ceoNotes: 'Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-flash' },
      { name: 'researcher-2', cli: 'gemini', role: 'researcher', ceoNotes: 'Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-flash' },
    ]
  },
  {
    name: 'Gemini Code + Review',
    description: '1 Flash coder + 1 Pro reviewer. Gemini-native code review loop.',
    requiredClis: ['gemini'],
    agents: [
      { name: 'coder', cli: 'gemini', role: 'worker', ceoNotes: 'You write code. After each change, send_message() to the reviewer.', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-flash' },
      { name: 'reviewer', cli: 'gemini', role: 'reviewer', ceoNotes: 'You review code. Use get_agent_output() to inspect work. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  // --- Cross-CLI (non-Claude) ---
  {
    name: 'Codex + Kimi',
    description: 'Codex codes, Kimi researches. OpenAI implementation + Moonshot knowledge.',
    requiredClis: ['codex', 'kimi'],
    agents: [
      { name: 'coder', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() and get_messages() for assignments. Report back when done.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'researcher', cli: 'kimi', role: 'researcher', ceoNotes: 'You research and provide context. Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Codex + Gemini',
    description: 'Codex codes, Gemini researches. OpenAI implementation + Google knowledge.',
    requiredClis: ['codex', 'gemini'],
    agents: [
      { name: 'coder', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'researcher', cli: 'gemini', role: 'researcher', ceoNotes: 'You research and provide context. Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  {
    name: 'Kimi + Gemini',
    description: 'Kimi + Gemini dual research. Two knowledge bases, one team.',
    requiredClis: ['kimi', 'gemini'],
    agents: [
      { name: 'kimi-researcher', cli: 'kimi', role: 'researcher', ceoNotes: 'You research from the Moonshot perspective. Check read_tasks() for assignments. Post findings to post_info() with tags.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'gemini-researcher', cli: 'gemini', role: 'researcher', ceoNotes: 'You research from the Google perspective. Check read_tasks() for assignments. Post findings to post_info() with tags.', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  {
    name: 'Triple Threat',
    description: 'Codex + Kimi + Gemini. Three ecosystems, one project. No Claude needed.',
    requiredClis: ['codex', 'kimi', 'gemini'],
    agents: [
      { name: 'coder', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: 'o3' },
      { name: 'researcher', cli: 'kimi', role: 'researcher', ceoNotes: 'You research. Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'analyst', cli: 'gemini', role: 'researcher', ceoNotes: 'You analyze and verify. Check read_tasks() for assignments. Cross-reference findings in read_info().', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  // --- Triple combos with Claude ---
  {
    name: 'Claude + Codex + Kimi',
    description: 'Claude orchestrates, Codex implements, Kimi researches. Three ecosystems working in harmony.',
    requiredClis: ['claude', 'codex', 'kimi'],
    agents: [
      { name: 'orchestrator', cli: 'claude', role: 'orchestrator', ceoNotes: 'You coordinate. Delegate coding to the coder and research to the researcher via post_task() and send_message().', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'coder', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'researcher', cli: 'kimi', role: 'researcher', ceoNotes: 'You research. Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Claude + Codex + Gemini',
    description: 'Claude orchestrates, Codex implements, Gemini researches. Anthropic brains + OpenAI hands + Google eyes.',
    requiredClis: ['claude', 'codex', 'gemini'],
    agents: [
      { name: 'orchestrator', cli: 'claude', role: 'orchestrator', ceoNotes: 'You coordinate. Delegate coding to the coder and research to the researcher.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'coder', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'researcher', cli: 'gemini', role: 'researcher', ceoNotes: 'You research. Check read_tasks() for assignments. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  {
    name: 'Claude + Kimi + Gemini',
    description: 'Claude orchestrates two research powerhouses. Dual-source knowledge gathering.',
    requiredClis: ['claude', 'kimi', 'gemini'],
    agents: [
      { name: 'lead', cli: 'claude', role: 'orchestrator', ceoNotes: 'You coordinate dual researchers. Give each different angles on the same question. Synthesize their findings.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'kimi-researcher', cli: 'kimi', role: 'researcher', ceoNotes: 'You research from the Moonshot perspective. Post findings to post_info() with tags.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'gemini-researcher', cli: 'gemini', role: 'researcher', ceoNotes: 'You research from the Google perspective. Post findings to post_info() with tags.', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  // --- Quad combo ---
  {
    name: 'The Full Stack',
    description: 'Claude + Codex + Kimi + Gemini. All four major CLIs in one team. Maximum ecosystem diversity.',
    requiredClis: ['claude', 'codex', 'kimi', 'gemini'],
    agents: [
      { name: 'orchestrator', cli: 'claude', role: 'orchestrator', ceoNotes: 'You lead a multi-ecosystem team. Delegate implementation to Codex, research to Kimi and Gemini. Synthesize everything.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
      { name: 'coder', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. Check read_tasks() and get_messages() for assignments from the orchestrator.', shell: 'powershell', admin: false, autoMode: true, model: 'o3' },
      { name: 'researcher-east', cli: 'kimi', role: 'researcher', ceoNotes: 'You research. Focus on technical depth and implementation patterns. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'researcher-west', cli: 'gemini', role: 'researcher', ceoNotes: 'You research. Focus on broad context and documentation. Post findings to post_info().', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
  // --- More creative cross-CLI mixes ---
  {
    name: 'Codex + Claude Review',
    description: 'Codex does the heavy coding, Claude Opus reviews everything. Speed + quality.',
    requiredClis: ['codex', 'claude'],
    agents: [
      { name: 'coder-1', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. After each change, send_message() to the reviewer.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'coder-2', cli: 'codex', role: 'worker', ceoNotes: 'You implement code. After each change, send_message() to the reviewer.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'reviewer', cli: 'claude', role: 'reviewer', ceoNotes: 'You review all code from both coders. Use get_agent_output() to inspect. Be thorough — you are the quality gate.', shell: 'powershell', admin: false, autoMode: true, model: 'opus' },
    ]
  },
  {
    name: 'Gemini Lead + Claude Workers',
    description: 'Gemini Pro orchestrates, Claude Sonnet workers execute. Google planning + Anthropic hands.',
    requiredClis: ['gemini', 'claude'],
    agents: [
      { name: 'lead', cli: 'gemini', role: 'orchestrator', ceoNotes: 'You plan and coordinate. Break work into tasks via post_task(). Review results.', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
      { name: 'worker-1', cli: 'claude', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for assignments. Execute and report back.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'worker-2', cli: 'claude', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for assignments. Execute and report back.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
    ]
  },
  {
    name: 'Kimi Lead + Codex Workers',
    description: 'Kimi orchestrates, Codex workers implement. Moonshot planning + OpenAI execution.',
    requiredClis: ['kimi', 'codex'],
    agents: [
      { name: 'lead', cli: 'kimi', role: 'orchestrator', ceoNotes: 'You plan and delegate. Break work into tasks. Review completed work.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'worker-1', cli: 'codex', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'worker-2', cli: 'codex', role: 'worker', ceoNotes: 'Check read_tasks() and get_messages() for assignments.', shell: 'powershell', admin: false, autoMode: true, model: '' },
    ]
  },
  {
    name: 'Everyone Reviews Claude',
    description: 'Claude codes, everyone else reviews from their perspective. Maximum feedback diversity.',
    requiredClis: ['claude', 'codex', 'kimi', 'gemini'],
    agents: [
      { name: 'coder', cli: 'claude', role: 'worker', ceoNotes: 'You write code. After each change, broadcast() to all reviewers and wait for feedback from all three before proceeding.', shell: 'powershell', admin: false, autoMode: true, model: 'sonnet' },
      { name: 'reviewer-openai', cli: 'codex', role: 'reviewer', ceoNotes: 'You review code from the OpenAI perspective. Use get_agent_output() to inspect. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: 'o3' },
      { name: 'reviewer-kimi', cli: 'kimi', role: 'reviewer', ceoNotes: 'You review code from the Moonshot perspective. Use get_agent_output() to inspect. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: '' },
      { name: 'reviewer-gemini', cli: 'gemini', role: 'reviewer', ceoNotes: 'You review code from the Google perspective. Use get_agent_output() to inspect. send_message() back with feedback.', shell: 'powershell', admin: false, autoMode: true, model: 'gemini-2.5-pro' },
    ]
  },
]

const ALL_CLIS = ['claude', 'codex', 'kimi', 'gemini', 'openclaude']
const CLI_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  kimi: 'Kimi',
  gemini: 'Gemini',
  openclaude: 'OpenClaude',
}

export function PresetDialog({ agents, windows, zoom, pan, onLoadPreset, onClose }: PresetDialogProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('save')
  const [presetName, setPresetName] = useState('')
  const [presets, setPresets] = useState<PresetInfo[]>([])
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [cwdOverride, setCwdOverride] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCwdPrompt, setShowCwdPrompt] = useState(false)
  const [templateToLoad, setTemplateToLoad] = useState<PresetTemplate | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [cliFilters, setCliFilters] = useState<Set<string>>(new Set())
  const [editingAgents, setEditingAgents] = useState<AgentConfig[] | null>(null)
  // Community Teams state
  const [communityItems, setCommunityItems] = useState<CommunityTeamListItem[]>([])
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityError, setCommunityError] = useState<string | null>(null)
  const [communitySort, setCommunitySort] = useState<'stars' | 'newest'>('stars')
  const [communityCategory, setCommunityCategory] = useState<CommunityCategoryOrAll>('all')
  const [communityTeamToImport, setCommunityTeamToImport] = useState<CommunityTeam | null>(null)
  const [communityFetchingTeam, setCommunityFetchingTeam] = useState(false)
  // Share flow
  const [sharePreset, setSharePreset] = useState<WorkspacePreset | null>(null)
  const [shareName, setShareName] = useState('')
  const [shareDescription, setShareDescription] = useState('')
  const [shareAuthor, setShareAuthor] = useState(() => {
    try { return localStorage.getItem('cog-community-author') || '' } catch { return '' }
  })
  const [shareCategory, setShareCategory] = useState<CommunityCategory>('coding')
  const [shareAgents, setShareAgents] = useState<CommunityAgent[]>([])
  const [shareSubmitting, setShareSubmitting] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [shareSuccess, setShareSuccess] = useState<string | null>(null)

  const filteredTemplates = BUILT_IN_TEMPLATES.filter(t => {
    if (templateSearch) {
      const q = templateSearch.toLowerCase()
      if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
    }
    if (cliFilters.size > 0) {
      if (!t.requiredClis.every(cli => cliFilters.has(cli))) return false
    }
    return true
  })

  const toggleCliFilter = (cli: string) => {
    setCliFilters(prev => {
      const next = new Set(prev)
      if (next.has(cli)) next.delete(cli)
      else next.add(cli)
      return next
    })
  }

  // Reset selection and load presets list when tab changes
  // Note: don't clear editingAgents here — it gets set before setActiveTab('save')
  useEffect(() => {
    setSelectedPreset(null)
    setTemplateToLoad(null)
    setTemplateSearch('')
    setCliFilters(new Set())
    if (activeTab === 'load') {
      setEditingAgents(null)
      loadPresetsList()
    } else if (activeTab === 'templates') {
      setEditingAgents(null)
    } else if (activeTab === 'community') {
      setEditingAgents(null)
      loadCommunityList(false)
    }
  }, [activeTab])

  const loadPresetsList = async () => {
    try {
      setLoading(true)
      setError(null)
      const names = await window.electronAPI.listPresets()
      // Fetch details for each preset to get savedAt
      const presetInfos: PresetInfo[] = []
      for (const name of names) {
        try {
          const preset = await window.electronAPI.loadPreset(name)
          presetInfos.push({
            name,
            savedAt: preset.savedAt
          })
        } catch {
          // Skip corrupted presets
        }
      }
      setPresets(presetInfos.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets')
    } finally {
      setLoading(false)
    }
  }

  const loadCommunityList = async (force: boolean) => {
    try {
      setCommunityLoading(true)
      setCommunityError(null)
      const res = await window.electronAPI.communityList({ force })
      if (!res.success) throw new Error(res.error || 'Failed to load community teams')
      setCommunityItems(res.items as CommunityTeamListItem[])
    } catch (err) {
      setCommunityError(err instanceof Error ? err.message : 'Failed to load community teams')
    } finally {
      setCommunityLoading(false)
    }
  }

  const handleToggleStar = async (issueNumber: number, e: React.MouseEvent) => {
    e.stopPropagation()
    // Optimistic flip — update UI immediately, roll back on failure
    setCommunityItems(prev => prev.map(item => {
      if (item.issueNumber !== issueNumber) return item
      const next = !item.isStarredByMe
      return { ...item, isStarredByMe: next, stars: Math.max(0, item.stars + (next ? 1 : -1)) }
    }))
    try {
      const res = await window.electronAPI.communityToggleStar(issueNumber)
      if (!res.success) throw new Error(res.error || 'Star failed')
      // Reconcile with server response (in case of race)
      setCommunityItems(prev => prev.map(item => item.issueNumber === issueNumber
        ? { ...item, stars: res.stars, isStarredByMe: res.isStarredByMe }
        : item
      ))
    } catch (err) {
      // Roll back
      setCommunityItems(prev => prev.map(item => {
        if (item.issueNumber !== issueNumber) return item
        const back = !item.isStarredByMe
        return { ...item, isStarredByMe: back, stars: Math.max(0, item.stars + (back ? 1 : -1)) }
      }))
      setCommunityError(err instanceof Error ? err.message : 'Failed to toggle star')
    }
  }

  const handleCommunityCardClick = async (item: CommunityTeamListItem) => {
    try {
      setCommunityFetchingTeam(true)
      setCommunityError(null)
      const res = await window.electronAPI.communityGet(item.issueNumber)
      if (!res.success) throw new Error(res.error || 'Failed to fetch team')
      setCommunityTeamToImport(res.team as CommunityTeam)
      setShowCwdPrompt(true)
    } catch (err) {
      setCommunityError(err instanceof Error ? err.message : 'Failed to fetch team')
    } finally {
      setCommunityFetchingTeam(false)
    }
  }

  const openShareDialog = async (presetName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setLoading(true)
      setError(null)
      const preset = await window.electronAPI.loadPreset(presetName)
      setSharePreset(preset)
      setShareName(preset.name)
      setShareDescription('')
      setShareError(null)
      setShareSuccess(null)
      // Convert AgentConfigs to CommunityAgents (strip cwd/id/tab/group/provider)
      setShareAgents(preset.agents.map(a => ({
        name: a.name,
        cli: a.cli,
        role: a.role,
        ceoNotes: a.ceoNotes,
        shell: a.shell,
        admin: a.admin,
        autoMode: a.autoMode,
        ...(a.model ? { model: a.model } : {}),
        ...(a.experimental ? { experimental: a.experimental } : {}),
        ...(a.skills && a.skills.length > 0 ? { skills: a.skills } : {}),
        ...(a.theme ? { theme: a.theme } : {}),
        ...(a.worktree !== undefined ? { worktree: a.worktree } : {})
      })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open preset for sharing')
    } finally {
      setLoading(false)
    }
  }

  const updateShareAgent = (idx: number, field: keyof CommunityAgent, value: string | boolean) => {
    setShareAgents(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const handleShareSubmit = async () => {
    if (!shareName.trim()) { setShareError('Name is required'); return }
    if (!shareDescription.trim()) { setShareError('Description is required'); return }
    if (!shareAuthor.trim()) { setShareError('Author is required'); return }
    try {
      setShareSubmitting(true)
      setShareError(null)
      try { localStorage.setItem('cog-community-author', shareAuthor.trim()) } catch { /* noop */ }
      const res = await window.electronAPI.communityShare({
        name: shareName.trim(),
        description: shareDescription.trim(),
        author: shareAuthor.trim(),
        category: shareCategory,
        agents: shareAgents
      })
      if (!res.success) throw new Error(res.error || 'Share failed')
      setShareSuccess(`Shared! Your team is now in Community Teams.`)
      // Refresh community list cache so it shows up next time they browse
      loadCommunityList(true)
      // Auto-close the share dialog after a moment
      setTimeout(() => {
        setSharePreset(null)
        setShareSuccess(null)
      }, 1500)
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Share failed')
    } finally {
      setShareSubmitting(false)
    }
  }

  const handleSave = async () => {
    if (!presetName.trim()) return

    try {
      setLoading(true)
      setError(null)

      // Convert WindowState[] to WindowPosition[]
      const windowPositions: WindowPosition[] = windows.map(w => ({
        agentName: w.title,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height
      }))

      const canvas: CanvasState = {
        zoom,
        panX: pan.x,
        panY: pan.y
      }

      // Use editingAgents if editing an existing preset, otherwise save current workspace
      const agentConfigs: AgentConfig[] = editingAgents
        ? editingAgents
        : agents.map(a => ({
            id: a.id,
            name: a.name,
            cli: a.cli,
            cwd: a.projectRoot ?? a.cwd,
            role: a.role,
            ceoNotes: a.ceoNotes,
            shell: a.shell,
            admin: a.admin,
            autoMode: a.autoMode,
            promptRegex: a.promptRegex,
            model: a.model,
            experimental: a.experimental,
            worktree: a.worktree,
            spawnAsleep: a.spawnAsleep,
            neverSleep: a.neverSleep
          }))

      await window.electronAPI.savePreset(presetName.trim(), agentConfigs, windowPositions, canvas)
      setPresetName('')
      setEditingAgents(null)
      setActiveTab('load')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset')
    } finally {
      setLoading(false)
    }
  }

  const handleEditPreset = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setLoading(true)
      setError(null)
      const preset = await window.electronAPI.loadPreset(name)
      setEditingAgents(preset.agents)
      setPresetName(name)
      setActiveTab('save')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preset for editing')
    } finally {
      setLoading(false)
    }
  }

  const handleClonePreset = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setLoading(true)
      setError(null)
      const preset = await window.electronAPI.loadPreset(name)
      setEditingAgents(preset.agents)
      setPresetName(`${name}-copy`)
      setActiveTab('save')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone preset')
    } finally {
      setLoading(false)
    }
  }

  const updateEditingAgent = (index: number, field: keyof AgentConfig, value: string | boolean) => {
    setEditingAgents(prev => {
      if (!prev) return prev
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const removeEditingAgent = (index: number) => {
    setEditingAgents(prev => {
      if (!prev) return prev
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete preset "${name}"?`)) return

    try {
      setLoading(true)
      await window.electronAPI.deletePreset(name)
      if (selectedPreset === name) setSelectedPreset(null)
      await loadPresetsList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadClick = () => {
    if (!selectedPreset) return
    setShowCwdPrompt(true)
  }

  const handleUpdatePreset = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      setLoading(true)
      setError(null)

      const windowPositions: WindowPosition[] = windows.map(w => ({
        agentName: w.title,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height
      }))

      const canvas: CanvasState = {
        zoom,
        panX: pan.x,
        panY: pan.y
      }

      const agentConfigs: AgentConfig[] = agents.map(a => ({
        id: a.id,
        name: a.name,
        cli: a.cli,
        cwd: a.projectRoot ?? a.cwd,
        role: a.role,
        ceoNotes: a.ceoNotes,
        shell: a.shell,
        admin: a.admin,
        autoMode: a.autoMode,
        promptRegex: a.promptRegex,
        model: a.model,
        experimental: a.experimental,
        worktree: a.worktree,
        spawnAsleep: a.spawnAsleep,
        neverSleep: a.neverSleep
      }))

      await window.electronAPI.savePreset(name, agentConfigs, windowPositions, canvas)
      await loadPresetsList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preset')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmLoad = async () => {
    try {
      setLoading(true)
      setError(null)

      let configs: Omit<AgentConfig, 'id'>[]
      let savedWindows: WindowPosition[] = []
      let savedCanvas: CanvasState = { zoom: 1, panX: 0, panY: 0 }

      if (communityTeamToImport && activeTab === 'community') {
        // Importing a community team — convert CommunityAgent[] to AgentConfig[] (sans id)
        configs = communityTeamToImport.agents.map(a => ({
          name: a.name,
          cli: a.cli,
          cwd: cwdOverride.trim() || '',
          role: a.role,
          ceoNotes: a.ceoNotes,
          shell: a.shell,
          admin: a.admin,
          autoMode: a.autoMode,
          ...(a.model ? { model: a.model } : {}),
          ...(a.experimental ? { experimental: a.experimental } : {}),
          ...(a.skills ? { skills: a.skills } : {}),
          ...(a.theme ? { theme: a.theme } : {}),
          ...(a.worktree !== undefined ? { worktree: a.worktree } : {})
        }))
      } else if (templateToLoad && activeTab === 'templates') {
        // Loading from built-in template — no saved positions
        configs = templateToLoad.agents.map(agent => ({
          ...agent,
          cwd: cwdOverride.trim() || ''
        }))
      } else if (selectedPreset) {
        // Loading from saved preset — include window positions and canvas
        const preset = await window.electronAPI.loadPreset(selectedPreset)
        configs = preset.agents.map(({ id, ...rest }) => ({
          ...rest,
          cwd: cwdOverride.trim() || rest.cwd
        }))
        savedWindows = preset.windows || []
        savedCanvas = preset.canvas || savedCanvas
      } else {
        return
      }

      onLoadPreset(configs, savedWindows, savedCanvas)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleString()
    } catch {
      return isoString
    }
  }

  const handleBrowseCwd = async () => {
    const dir = await window.electronAPI.browseDirectory(cwdOverride || '')
    if (dir) setCwdOverride(dir)
  }

  // CWD Override Prompt Modal
  if (showCwdPrompt) {
    return (
      <Dialog
        title={activeTab === 'community' && communityTeamToImport
          ? `Import Team: ${communityTeamToImport.name}`
          : activeTab === 'templates'
            ? `Use Template: ${templateToLoad?.name}`
            : `Load Preset: ${selectedPreset}`}
        icon="folder-open"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCwdPrompt(false)}>Back</Button>
            <Button onClick={handleConfirmLoad} disabled={loading}>Load</Button>
          </>
        }
      >
        <Field label="Working directory for all agents">
          <span className="cog-field__inline">
            <Input
              mono
              value={cwdOverride}
              onChange={e => setCwdOverride(e.target.value)}
              placeholder="Leave empty to use original paths"
            />
            <Button variant="ghost" onClick={handleBrowseCwd}>
              <Icon name="folder-open" size={14} />Browse
            </Button>
          </span>
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </Dialog>
    )
  }

  const filteredCommunity = communityItems
    .filter(i => communityCategory === 'all' || i.category === communityCategory)
    .sort((a, b) => {
      if (communitySort === 'stars') return b.stars - a.stars
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const footerStart = activeTab === 'community'
    ? (communityFetchingTeam ? 'Fetching team details...' : 'Click a team to import it')
    : undefined

  const footer = activeTab === 'save' ? (
    <>
      <Button variant="ghost" onClick={() => { setEditingAgents(null); if (editingAgents) setActiveTab('load'); else onClose() }}>
        {editingAgents ? 'Back' : 'Cancel'}
      </Button>
      <Button
        onClick={handleSave}
        disabled={!presetName.trim() || loading || (editingAgents !== null && editingAgents.length === 0)}
      >
        Save
      </Button>
    </>
  ) : activeTab === 'load' ? (
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={handleLoadClick} disabled={!selectedPreset || loading}>Load</Button>
    </>
  ) : activeTab === 'templates' ? (
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={() => { if (templateToLoad) setShowCwdPrompt(true) }} disabled={!templateToLoad}>
        Use template
      </Button>
    </>
  ) : (
    <Button variant="ghost" onClick={onClose}>Close</Button>
  )

  const closeShareIfIdle = () => { if (!shareSubmitting) setSharePreset(null) }

  return (
    <>
      <Dialog
        title="Workspace presets"
        icon="bookmark"
        size="lg"
        className="cog-presets"
        bodyClassName="cog-presets__body"
        onClose={onClose}
        footerStart={footerStart}
        footer={footer}
      >
        <Segmented<Tab>
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Preset tabs"
          options={[
            { value: 'save', label: 'Save' },
            { value: 'load', label: 'Load' },
            { value: 'templates', label: 'Templates' },
            { value: 'community', label: 'Community' }
          ]}
        />

        {error && <Notice tone="danger">{error}</Notice>}

        {activeTab === 'save' && (
          <div className="cog-dialog__group">
            <Field label="Preset name">
              <Input
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="e.g., My Workspace"
              />
            </Field>
            {editingAgents ? (
              <>
                <SectionHeader>
                  Editing {editingAgents.length} agent{editingAgents.length !== 1 ? 's' : ''}
                </SectionHeader>
                <div className="cog-presets__agents cog-presets__agents--edit">
                  {editingAgents.map((agent, idx) => (
                    <div key={idx} className="cog-presets__agent">
                      <div className="cog-presets__agenthead">
                        <span>Agent {idx + 1}</span>
                        {editingAgents.length > 1 && (
                          <Button
                            variant="icon"
                            onClick={() => removeEditingAgent(idx)}
                            title="Remove agent"
                            aria-label="Remove agent"
                          >
                            <Icon name="x" size={14} />
                          </Button>
                        )}
                      </div>
                      <div className="cog-presets__grid">
                        <Field label="Name">
                          <Input
                            value={agent.name}
                            onChange={e => updateEditingAgent(idx, 'name', e.target.value)}
                          />
                        </Field>
                        <Field label="CLI">
                          <Select<string>
                            value={agent.cli}
                            onChange={v => updateEditingAgent(idx, 'cli', v)}
                            options={EDIT_CLI_OPTIONS}
                          />
                        </Field>
                        <Field label="Role">
                          <Select<string>
                            value={agent.role}
                            onChange={v => updateEditingAgent(idx, 'role', v)}
                            options={EDIT_ROLE_OPTIONS}
                          />
                        </Field>
                        <Field label="Model">
                          {(() => {
                            const models = CLI_MODELS[agent.cli]
                            const currentModel = agent.model || ''
                            if (!models) {
                              return (
                                <Input
                                  mono
                                  value={currentModel}
                                  onChange={e => updateEditingAgent(idx, 'model', e.target.value)}
                                  placeholder="default"
                                />
                              )
                            }
                            const hasCurrent = models.some(m => m.value === currentModel)
                            return (
                              <Select<string>
                                value={currentModel}
                                onChange={v => updateEditingAgent(idx, 'model', v)}
                                options={[
                                  ...(!hasCurrent && currentModel
                                    ? [{ value: currentModel, label: `${currentModel} (custom)` }]
                                    : []),
                                  ...models.map(m => ({ value: m.value, label: m.label }))
                                ]}
                              />
                            )
                          })()}
                        </Field>
                      </div>
                      <Field label="Instructions">
                        <Textarea
                          value={agent.ceoNotes}
                          onChange={e => updateEditingAgent(idx, 'ceoNotes', e.target.value)}
                          rows={2}
                          className="cog-presets__notes"
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="cog-presets__summary">
                Saves {agents.length} agent{agents.length !== 1 ? 's' : ''} and {windows.length} window position{windows.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {activeTab === 'load' && (
          loading ? (
            <Loading>Loading presets...</Loading>
          ) : presets.length === 0 ? (
            <EmptyState icon="bookmark">No presets saved yet</EmptyState>
          ) : (
            <div className="cog-dialog__list cog-presets__list cog-presets__list--load">
              {presets.map(preset => (
                <Row
                  key={preset.name}
                  icon={<Icon name="bookmark" size={14} />}
                  title={preset.name}
                  meta={formatDate(preset.savedAt)}
                  selected={selectedPreset === preset.name}
                  onClick={() => setSelectedPreset(preset.name)}
                  actions={
                    <>
                      <Button
                        variant="icon"
                        onClick={e => handleUpdatePreset(preset.name, e)}
                        title="Update preset with current layout"
                        aria-label="Update preset with current layout"
                      >
                        <Icon name="refresh-cw" size={14} />
                      </Button>
                      <Button
                        variant="icon"
                        onClick={e => handleClonePreset(preset.name, e)}
                        title="Clone preset"
                        aria-label="Clone preset"
                      >
                        <Icon name="copy" size={14} />
                      </Button>
                      <Button
                        variant="icon"
                        onClick={e => handleEditPreset(preset.name, e)}
                        title="Edit preset"
                        aria-label="Edit preset"
                      >
                        <Icon name="pencil" size={14} />
                      </Button>
                      <Button
                        variant="icon"
                        onClick={e => openShareDialog(preset.name, e)}
                        title="Share to Community"
                        aria-label="Share to Community"
                      >
                        <Icon name="star" size={14} />
                      </Button>
                      <Button
                        variant="icon"
                        className="cog-tone-danger"
                        onClick={e => handleDelete(preset.name, e)}
                        title="Delete preset"
                        aria-label="Delete preset"
                      >
                        <Icon name="trash" size={14} />
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )
        )}

        {activeTab === 'templates' && (
          <div className="cog-dialog__group">
            <Input
              value={templateSearch}
              onChange={e => setTemplateSearch(e.target.value)}
              placeholder="Search templates..."
              aria-label="Search templates"
            />
            <div className="cog-presets__filters" role="group" aria-label="Filter by CLI">
              {ALL_CLIS.map(cli => (
                <Checkbox key={cli} checked={cliFilters.has(cli)} onChange={() => toggleCliFilter(cli)}>
                  {CLI_LABELS[cli]}
                </Checkbox>
              ))}
              {cliFilters.size > 0 && (
                <Button variant="ghost" className="cog-presets__clear" onClick={() => setCliFilters(new Set())}>
                  Clear
                </Button>
              )}
            </div>
            {filteredTemplates.length === 0 ? (
              <EmptyState icon="search" compact>No templates match your filters.</EmptyState>
            ) : (
              <div className="cog-dialog__list cog-presets__list cog-presets__list--templates">
                {filteredTemplates.map(template => (
                  <Row
                    key={template.name}
                    className="cog-presets__row"
                    icon={<Icon name="users" size={14} />}
                    title={template.name}
                    meta={
                      <>
                        <span>{template.description}</span>
                        <span className="cog-presets__detail">
                          {template.agents.length} agent{template.agents.length !== 1 ? 's' : ''}
                          {' · '}
                          Requires: {template.requiredClis.map(c => CLI_LABELS[c] || c).join(', ')}
                        </span>
                      </>
                    }
                    selected={selectedPreset === template.name && activeTab === 'templates'}
                    onClick={() => {
                      setSelectedPreset(template.name)
                      setTemplateToLoad(template)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'community' && (
          <div className="cog-dialog__group">
            {/* Controls row — sort + refresh */}
            <div className="cog-presets__bar">
              <span className="cog-presets__sort">
                <Select<'stars' | 'newest'>
                  value={communitySort}
                  onChange={setCommunitySort}
                  ariaLabel="Sort community teams"
                  options={[
                    { value: 'stars', label: 'Most starred' },
                    { value: 'newest', label: 'Newest' }
                  ]}
                />
              </span>
              <Button
                variant="ghost"
                onClick={() => loadCommunityList(true)}
                disabled={communityLoading}
                title="Refresh from GitHub"
              >
                {communityLoading ? '...' : <><Icon name="refresh-cw" size={14} />Refresh</>}
              </Button>
              <span className="cog-presets__count">
                {communityItems.length} team{communityItems.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Category filter */}
            <div className="cog-presets__cats">
              <Segmented<CommunityCategoryOrAll>
                value={communityCategory}
                onChange={setCommunityCategory}
                ariaLabel="Filter by category"
                options={COMMUNITY_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
              />
            </div>

            {communityError && <Notice tone="danger">{communityError}</Notice>}

            {/* Team list */}
            {communityLoading && communityItems.length === 0 ? (
              <Loading>Loading community teams...</Loading>
            ) : filteredCommunity.length === 0 ? (
              <EmptyState icon="users" compact>
                {communityItems.length === 0
                  ? 'No teams shared yet. Be the first — share a preset from the Load tab!'
                  : 'No teams match the selected category.'}
              </EmptyState>
            ) : (
              <div className="cog-dialog__list cog-presets__list cog-presets__list--community">
                {filteredCommunity.map(item => (
                  <Row
                    key={item.issueNumber}
                    className="cog-presets__row"
                    icon={<Icon name="users" size={14} />}
                    title={item.name}
                    state={<span className="cog-presets__cat">{item.category}</span>}
                    meta={
                      <>
                        <span>{item.description.length > 140 ? item.description.slice(0, 140) + '...' : item.description}</span>
                        <span className="cog-presets__detail">
                          {item.agentCount} agent{item.agentCount !== 1 ? 's' : ''}
                          {' · '}
                          <span className="cog-mono">{item.clis.join(' + ')}</span>
                          {' · by '}
                          <span className="cog-presets__author">{item.author}</span>
                        </span>
                      </>
                    }
                    onClick={() => handleCommunityCardClick(item)}
                    actions={
                      <Button
                        variant="ghost"
                        className={item.isStarredByMe ? 'cog-presets__star cog-presets__star--on' : 'cog-presets__star'}
                        onClick={e => handleToggleStar(item.issueNumber, e)}
                        title={item.isStarredByMe ? 'Unstar' : 'Star'}
                        aria-pressed={item.isStarredByMe}
                      >
                        <Icon name="star" size={14} />
                        <span>{item.stars}</span>
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Share Dialog — overlayed when sharePreset is set */}
      {sharePreset && (
        <Dialog
          title="Share to community"
          icon="star"
          size="md"
          className="cog-presets"
          zIndex={100002}
          onClose={closeShareIfIdle}
          closeOnBackdrop
          footer={
            <>
              <Button variant="ghost" onClick={() => setSharePreset(null)} disabled={shareSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleShareSubmit} disabled={shareSubmitting}>
                {shareSubmitting ? 'Sharing...' : 'Share'}
              </Button>
            </>
          }
        >
          <Notice tone="warning" icon="triangle-alert">
            Your CEO Notes will be visible to everyone. Review and edit below to remove any project-specific details.
          </Notice>

          {shareError && <Notice tone="danger">{shareError}</Notice>}
          {shareSuccess && <Notice tone="success" icon="circle-check">{shareSuccess}</Notice>}

          <div className="cog-presets__grid">
            <Field label="Team name">
              <Input value={shareName} onChange={e => setShareName(e.target.value)} />
            </Field>
            <Field label="Category">
              <Select<CommunityCategory>
                value={shareCategory}
                onChange={setShareCategory}
                options={COMMUNITY_CATEGORIES.filter(c => c.value !== 'all').map(c => ({
                  value: c.value as CommunityCategory,
                  label: c.label
                }))}
              />
            </Field>
          </div>
          <Field label="Author (displayed to everyone)">
            <Input
              value={shareAuthor}
              onChange={e => setShareAuthor(e.target.value)}
              placeholder="Your name or handle"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={shareDescription}
              onChange={e => setShareDescription(e.target.value)}
              placeholder="What is this team good for? What's the workflow?"
              rows={3}
              className="cog-presets__notes"
            />
          </Field>

          <SectionHeader count={shareAgents.length}>
            Agents <span className="cog-presets__sectionhint">edit CEO Notes to sanitize</span>
          </SectionHeader>
          <div className="cog-presets__agents cog-presets__agents--share">
            {shareAgents.map((a, idx) => (
              <div key={idx} className="cog-presets__agent">
                <div className="cog-presets__agenthead">
                  <span>{a.name}</span>
                  <span className="cog-presets__agentmeta">
                    {a.cli}{a.model ? ` · ${a.model}` : ''} · {a.role}
                  </span>
                </div>
                <Textarea
                  value={a.ceoNotes}
                  onChange={e => updateShareAgent(idx, 'ceoNotes', e.target.value)}
                  rows={3}
                  aria-label={`CEO Notes for ${a.name}`}
                  className="cog-presets__notes"
                />
              </div>
            ))}
          </div>
        </Dialog>
      )}
    </>
  )
}

const EDIT_CLI_OPTIONS: { value: string; label: string }[] = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'codex', label: 'Codex CLI' },
  { value: 'kimi', label: 'Kimi CLI' },
  { value: 'gemini', label: 'Gemini CLI' },
  { value: 'openclaude', label: 'OpenClaude' },
  { value: 'copilot', label: 'Copilot CLI' },
  { value: 'grok', label: 'Grok CLI' },
  { value: 'terminal', label: 'Plain Terminal' }
]

const EDIT_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'orchestrator', label: 'Orchestrator' },
  { value: 'worker', label: 'Worker' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'reviewer', label: 'Reviewer' }
]

/** An inline message inside the dialog body: error, warning or success, with its icon. */
function Notice({ tone, icon = 'circle-alert', children }: {
  tone: 'danger' | 'warning' | 'success'
  icon?: IconName
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className={`cog-presets__notice cog-presets__notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon} size={14} />
      <span>{children}</span>
    </div>
  )
}
