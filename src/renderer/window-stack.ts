/**
 * The top visible window: the highest zIndex among the non-minimized ones
 * (focusing a window bumps its zIndex). On a tie the earlier window wins.
 */
export function topVisibleWindow<T extends { zIndex: number; minimized: boolean }>(windows: readonly T[]): T | undefined {
  let top: T | undefined
  for (const w of windows) {
    if (w.minimized) continue
    if (!top || w.zIndex > top.zIndex) top = w
  }
  return top
}
