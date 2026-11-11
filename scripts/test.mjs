#!/usr/bin/env node
/**
 * Run vitest inside Electron's own Node runtime.
 *
 * postinstall (rebuild-native.mjs) swaps better-sqlite3's binary for the
 * Electron build so the app can load it. Plain `vitest` runs on the system
 * Node, whose ABI differs, so every DB-backed test failed with
 * NODE_MODULE_VERSION mismatch. ELECTRON_RUN_AS_NODE makes the Electron
 * binary behave as Node with the matching ABI — one native build serves
 * both the app and the tests, nothing to recompile.
 *
 * Usage: node scripts/test.mjs [run|watch] [vitest args...]
 *   `npm test`           -> vitest run
 *   `npm run test:watch` -> vitest (watch)
 *   `npm run test:node`  -> plain vitest on system Node (DB tests will fail)
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
// In plain Node, the `electron` package exports the path to the binary.
const electronBin = require('electron')
const vitestEntry = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

const [mode = 'run', ...rest] = process.argv.slice(2)
const args = [vitestEntry, ...(mode === 'watch' ? [] : ['run']), ...rest]

const child = spawn(electronBin, args, {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)))
