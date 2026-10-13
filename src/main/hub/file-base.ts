// Pure lookup of the base directory for relative /files/* paths: the calling
// agent's cwd (its worktree) when it lies inside the project root, else the root.

const normalise = (p: string): string => p.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '')

function isInside(root: string, p: string): boolean {
  const r = normalise(root)
  const n = normalise(p)
  return n === r || n.startsWith(r + '/')
}

// The X-Cog-Agent header is URL-encoded by the MCP server (names may be non-latin1).
export function decodeAgentHeader(raw: string): string {
  try { return decodeURIComponent(raw) } catch { return raw }
}

export function resolveFileBase(
  registryGet: (name: string) => { cwd?: string } | undefined,
  rawHeader: string | undefined,
  root: string | null
): string | undefined {
  if (!rawHeader) return root ?? undefined
  const cwd = registryGet(decodeAgentHeader(rawHeader))?.cwd
  if (cwd && root && isInside(root, cwd)) return cwd
  return root ?? undefined
}
