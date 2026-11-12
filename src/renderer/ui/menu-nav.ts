/**
 * Next focused item in a menu for a navigation key, or null when the key is not a
 * navigation key. `current` is -1 when no item has focus (focus is on the menu itself).
 * Arrows wrap; Home and End jump to the ends.
 */
export function menuNavIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
