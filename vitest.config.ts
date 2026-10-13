import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Agent worktrees live under .cog/ and hold full copies of the repo.
    exclude: [...configDefaults.exclude, '.cog/**', '**/.cog/**']
  }
})
