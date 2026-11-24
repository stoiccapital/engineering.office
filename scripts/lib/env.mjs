// Shared helpers for the Node CLI scripts (migrate, KV export/import, admin).
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

export const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..')

// DATABASE_URL from the environment, falling back to .dev.vars (wrangler's
// local secrets file) so local commands work without extra setup.
export function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const file = path.join(ROOT, '.dev.vars')
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/)
      if (m) return m[1].replace(/^["']|["']$/g, '')
    }
  }
  throw new Error('DATABASE_URL is not set (env or .dev.vars)')
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      if (v !== undefined) out[k] = v
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i]
      else out[k] = true
    } else out._.push(a)
  }
  return out
}
