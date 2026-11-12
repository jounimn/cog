// Open dialogs in the order they opened: the last one is on top. Only the top
// dialog answers Escape, so a nested dialog closes alone, not with its parent.
const open: symbol[] = []

/** Registers a dialog as the new top; returns the function that removes it. */
export function openDialog(id: symbol): () => void {
  open.push(id)
  return () => {
    const i = open.lastIndexOf(id)
    if (i !== -1) open.splice(i, 1)
  }
}

export function isTopDialog(id: symbol): boolean {
  return open.length > 0 && open[open.length - 1] === id
}
