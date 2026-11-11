export interface LinkRef { from: string; to: string }
export interface LinkAgent { id: string; name: string; tabId?: string }
export interface DeliveredEvent { from: string; to: string; tabId?: string }

/** Resolve a link endpoint or message party (agent id or name) to an agent. */
export function findAgent(ref: string, agents: LinkAgent[]): LinkAgent | undefined {
  return agents.find(a => a.id === ref) ?? agents.find(a => a.name === ref)
}

/** Stable key of a link, in agent ids, or null when an endpoint is unknown. */
export function linkKey(link: LinkRef, agents: LinkAgent[]): string | null {
  const a = findAgent(link.from, agents)
  const b = findAgent(link.to, agents)
  return a && b ? `${a.id}->${b.id}` : null
}

/**
 * Which link (as a `fromId->toId` key) a delivered message travelled along,
 * in either link direction, or null when the pair is unlinked, off the active
 * tab, addressed to the user, or names an unknown agent.
 */
export function linkKeyForMessage(
  evt: DeliveredEvent,
  links: LinkRef[],
  agents: LinkAgent[],
  activeTabId: string
): string | null {
  if (evt.tabId && evt.tabId !== activeTabId) return null
  const from = findAgent(evt.from, agents)
  const to = findAgent(evt.to, agents)
  if (!from || !to) return null
  if ((from.tabId ?? activeTabId) !== activeTabId || (to.tabId ?? activeTabId) !== activeTabId) return null
  for (const link of links) {
    const a = findAgent(link.from, agents)
    const b = findAgent(link.to, agents)
    if (!a || !b) continue
    if ((a.id === from.id && b.id === to.id) || (a.id === to.id && b.id === from.id)) {
      return `${a.id}->${b.id}`
    }
  }
  return null
}
