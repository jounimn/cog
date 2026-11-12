import React, { useState, useEffect } from 'react'
import { Button, Dialog, Icon, type IconName } from '../ui'
import { commitKind, type CommitKind } from './commit-kind'

declare const electronAPI: {
  getUpdateChangelog: () => Promise<{ commits: string[]; fromSha: string; toSha: string } | null>
}

export function WhatsNewDialog(): React.ReactElement | null {
  const [changelog, setChangelog] = useState<{ commits: string[]; fromSha: string; toSha: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    electronAPI.getUpdateChangelog().then(cl => {
      if (cl && cl.commits.length > 0) setChangelog(cl)
    })
  }, [])

  if (!changelog || dismissed) return null

  return (
    <Dialog
      title="What's new"
      icon="git-commit"
      size="sm"
      zIndex={100003}
      headerExtra={<>{changelog.fromSha} → {changelog.toSha}</>}
      footer={<Button onClick={() => setDismissed(true)}>Got it</Button>}
    >
      <ul className="cog-whatsnew">
        {changelog.commits.map((commit, i) => {
          // Colour-coded by commit type
          const kind = commitKind(commit)
          return (
            <li key={i} className={`cog-whatsnew--${kind}`}>
              <Icon name={KIND_ICON[kind]} size={12} />
              <span>{commit}</span>
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}

const KIND_ICON: Record<CommitKind, IconName> = {
  feat: 'plus',
  fix: 'wrench',
  refactor: 'refresh-cw',
  chore: 'circle',
  other: 'git-commit'
}
