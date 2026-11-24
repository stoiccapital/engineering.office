#!/usr/bin/env node
// Read-only dump of EVERY key in the FORECAST_KV namespace to a JSON file,
// as input for scripts/kv-import.mjs. Uses the wrangler CLI, so for the
// production namespace you must be logged in (`wrangler login`) with an
// account that can read it. Nothing is written to KV.
//
//   node scripts/kv-export.mjs --remote                 # production KV
//   node scripts/kv-export.mjs --local                  # local wrangler state
//   options: --namespace-id <id> (default: wrangler.toml)  --out <file>
//            --skip-backups (leave out bak-* snapshot keys)  --concurrency 6
//
// The dump contains plaintext passwords from the old login system: keep it
// out of git (backups/ is ignored) and delete it once the import is verified.
import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { ROOT, parseArgs } from './lib/env.mjs'

const run = promisify(execFile)
const args = parseArgs()
const mode = args.remote ? '--remote' : args.local ? '--local' : null
if (!mode) {
  console.error('specify --remote (production KV) or --local (local wrangler state)')
  process.exit(1)
}

const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8')
const namespaceId = args['namespace-id'] ?? toml.match(/binding\s*=\s*"FORECAST_KV"[\s\S]*?id\s*=\s*"([^"]+)"/)?.[1]
if (!namespaceId) {
  console.error('namespace id not found; pass --namespace-id')
  process.exit(1)
}

const wrangler = path.join(ROOT, 'node_modules', '.bin', 'wrangler')
const extra = args['persist-to'] ? ['--persist-to', args['persist-to']] : []
// wrangler 3 reads remote KV by default and rejects --remote; wrangler 4
// defaults to local and needs it.
const { stdout: wranglerVersion } = await run(wrangler, ['--version'], { cwd: ROOT })
const major = Number(wranglerVersion.match(/(\d+)\.\d+\.\d+/)?.[1] ?? 4)
const modeArgs = mode === '--remote' && major < 4 ? [] : [mode]

async function wr(cmdArgs, encoding = 'utf8') {
  const { stdout } = await run(wrangler, [...cmdArgs, '--namespace-id', namespaceId, ...modeArgs, ...extra], {
    cwd: ROOT,
    maxBuffer: 256 * 1024 * 1024,
    encoding,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' },
  })
  return stdout
}

console.log(`listing keys in ${namespaceId} (${mode}) …`)
const listOut = await wr(['kv', 'key', 'list'])
const listed = JSON.parse(listOut.slice(listOut.indexOf('[')))
let names = listed.map((k) => k.name)
if (args['skip-backups']) names = names.filter((n) => !n.startsWith('bak-'))
console.log(`${listed.length} keys listed, exporting ${names.length}`)

const out = []
const concurrency = Number(args.concurrency ?? 6)
let done = 0
async function worker(queue) {
  while (queue.length) {
    const name = queue.shift()
    const buf = await wr(['kv', 'key', 'get', name], 'buffer')
    const value = buf.toString('utf8')
    out.push({ key: name, value, sha256: crypto.createHash('sha256').update(value, 'utf8').digest('hex') })
    done++
    if (done % 25 === 0 || done === names.length) process.stdout.write(`  ${done}/${names.length}\r`)
  }
}
const queue = [...names]
await Promise.all(Array.from({ length: Math.min(concurrency, names.length || 1) }, () => worker(queue)))
out.sort((a, b) => (a.key < b.key ? -1 : 1))

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const file = args.out ?? path.join(ROOT, 'backups', `kv-export-${stamp}.json`)
fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(
  file,
  JSON.stringify({ exportedAt: new Date().toISOString(), namespaceId, source: mode.slice(2), keyCount: out.length, keys: out }),
  { mode: 0o600 },
)
console.log(`\nwrote ${out.length} keys → ${file}`)
