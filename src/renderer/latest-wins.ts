/**
 * Orders async requests that race to apply the same setting: each `begin()`
 * starts a new generation and returns a check that stays true only until the
 * next `begin()`. A slow, older request that settles last is dropped.
 */
export interface LatestWins {
  begin(): () => boolean
}

export function createLatestWins(): LatestWins {
  let generation = 0
  return {
    begin() {
      const mine = ++generation
      return () => mine === generation
    }
  }
}
