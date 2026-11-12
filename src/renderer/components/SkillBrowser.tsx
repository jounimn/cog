import React, { useState, useEffect } from 'react'
import type { Skill } from '../../shared/types'
import { Button, Icon, Input, Textarea, Select, Segmented, EmptyState, Row, Dialog } from '../ui'

interface SkillBrowserProps {
  selectedIds: string[]
  onToggleSkill: (skill: Skill) => void
  onClose: () => void
}

const CATEGORIES = ['All', 'coding', 'security', 'research', 'workflow', 'language', 'custom']

type Tab = 'built-in' | 'my-skills' | 'community'

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'built-in', label: 'Built-in' },
  { value: 'my-skills', label: 'My skills' },
  { value: 'community', label: 'Community' }
]

export function SkillBrowser({ selectedIds, onToggleSkill, onClose }: SkillBrowserProps): React.ReactElement {
  const [skills, setSkills] = useState<Skill[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('built-in')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSkill, setNewSkill] = useState({ name: '', description: '', category: 'custom', prompt: '', tags: '' })

  useEffect(() => {
    window.electronAPI.listSkills().then(setSkills)
  }, [])

  const filteredSkills = skills.filter(s => {
    if (activeTab === 'built-in' && s.source !== 'built-in') return false
    if (activeTab === 'my-skills' && s.source !== 'user' && s.source !== 'community') return false
    if (activeTab === 'community') return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q) && !s.tags.some(t => t.toLowerCase().includes(q))) return false
    }
    if (category !== 'All' && s.category !== category) return false
    return true
  })

  const handleCreate = async () => {
    if (!newSkill.name || !newSkill.prompt) return
    const created = await window.electronAPI.createSkill({
      name: newSkill.name,
      description: newSkill.description,
      category: newSkill.category,
      prompt: newSkill.prompt,
      tags: newSkill.tags.split(',').map(t => t.trim()).filter(Boolean)
    })
    setSkills(prev => [...prev, created])
    setShowCreateForm(false)
    setNewSkill({ name: '', description: '', category: 'custom', prompt: '', tags: '' })
  }

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteSkill(id)
    setSkills(prev => prev.filter(s => s.id !== id))
  }

  return (
    <Dialog
      title="Skills browser"
      icon="book-open"
      size="md"
      onClose={onClose}
      bodyClassName="cog-skills"
      footerStart={
        <span className="cog-skills__count">
          <b>{selectedIds.length}</b> skill{selectedIds.length !== 1 ? 's' : ''} attached
        </span>
      }
      footer={<Button onClick={onClose}>Done</Button>}
    >

      {/* Tabs */}
      <Segmented
        ariaLabel="Skill source"
        value={activeTab}
        options={TAB_OPTIONS}
        onChange={(tab) => { setActiveTab(tab); setSearch(''); setCategory('All') }}
      />

      {/* Search + Category (non-community tabs) */}
      {activeTab !== 'community' && (
        <>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…" aria-label="Search skills" />
          <div className="cog-skills__cats" role="group" aria-label="Category">
            {CATEGORIES.map(cat => (
              <Button key={cat} pressed={category === cat} onClick={() => setCategory(cat)}>{cat}</Button>
            ))}
          </div>
        </>
      )}

      {/* Skill List */}
      {activeTab !== 'community' && (
        <div className="cog-skills__list">
          {filteredSkills.length === 0 ? (
            <EmptyState icon="book-open">
              {activeTab === 'my-skills' ? 'No custom skills yet. Create one below.' : 'No skills match your search.'}
            </EmptyState>
          ) : filteredSkills.map(skill => {
            const attached = selectedIds.includes(skill.id)
            return (
              <div key={skill.id} className="cog-skills__item">
                <Row
                  selected={attached}
                  expanded={expandedId === skill.id}
                  ariaLabel={attached ? `${skill.name}, attached` : skill.name}
                  onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                  tooltip={skill.description}
                  icon={<Icon name={expandedId === skill.id ? 'chevron-down' : 'chevron-right'} size={14} />}
                  title={skill.name}
                  meta={skill.description}
                  state={
                    <>
                      {attached && <span className="cog-skills__attached"><Icon name="check" size={12} />Attached</span>}
                      <span className="cog-skills__cat">{skill.category}</span>
                    </>
                  }
                  actions={
                    <>
                      {skill.source !== 'built-in' && (
                        <Button
                          variant="icon"
                          className="cog-tone-danger"
                          onClick={() => handleDelete(skill.id)}
                          aria-label={`Delete ${skill.name}`}
                          title="Delete"
                        >
                          <Icon name="trash" size={14} />
                        </Button>
                      )}
                      {attached
                        ? <Button variant="ghost" onClick={() => onToggleSkill(skill)}><Icon name="minus" size={13} />Remove</Button>
                        : <Button onClick={() => onToggleSkill(skill)}><Icon name="plus" size={13} />Attach</Button>}
                    </>
                  }
                />
                {expandedId === skill.id && (
                  <pre className="cog-pre cog-skills__prompt">{skill.prompt}</pre>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* My Skills: Create button */}
      {activeTab === 'my-skills' && !showCreateForm && (
        <Button onClick={() => setShowCreateForm(true)}><Icon name="plus" size={14} />Create skill</Button>
      )}

      {/* Create Skill Form */}
      {activeTab === 'my-skills' && showCreateForm && (
        <div className="cog-skills__form">
          <Input value={newSkill.name} onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))}
            placeholder="Skill name" aria-label="Skill name" />
          <Input value={newSkill.description} onChange={e => setNewSkill(p => ({ ...p, description: e.target.value }))}
            placeholder="Description" aria-label="Description" />
          <Select
            value={newSkill.category}
            options={CATEGORIES.filter(c => c !== 'All').map(c => ({ value: c, label: c }))}
            onChange={(value) => setNewSkill(p => ({ ...p, category: value }))}
          />
          <Textarea value={newSkill.prompt} onChange={e => setNewSkill(p => ({ ...p, prompt: e.target.value }))}
            placeholder="Skill prompt (instructions for the agent)" rows={4} aria-label="Skill prompt" />
          <Input value={newSkill.tags} onChange={e => setNewSkill(p => ({ ...p, tags: e.target.value }))}
            placeholder="Tags (comma-separated)" aria-label="Tags" />
          <div className="cog-skills__formactions">
            <Button variant="ghost" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newSkill.name || !newSkill.prompt}>Save</Button>
          </div>
        </div>
      )}

      {/* Community Tab */}
      {activeTab === 'community' && (
        <div className="cog-skills__community">
          <p>Browse 90,000+ community skills on skills.sh</p>
          <Button onClick={() => window.open('https://skills.sh', '_blank')}>
            <Icon name="external-link" size={14} />Open skills.sh
          </Button>
          <p className="cog-skills__hint">
            Find a skill you like, then create it in "My skills" with the prompt content.
          </p>
        </div>
      )}
    </Dialog>
  )
}
