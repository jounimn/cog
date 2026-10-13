/** Hub reply note when `send_message` targets a sleeping agent. */
export function sleepingMessageNote(to: string): string {
  return `"${to}" is sleeping; your message is queued and will be delivered when a task or the user wakes it`
}

/** One note for a broadcast that reached sleeping agents; undefined when none slept. */
export function sleepingBroadcastNote(names: string[]): string | undefined {
  if (names.length === 0) return undefined
  if (names.length === 1) return sleepingMessageNote(names[0])
  const list = names.map((n) => `"${n}"`).join(', ')
  return `${list} are sleeping; your message is queued and will be delivered when a task or the user wakes them`
}
