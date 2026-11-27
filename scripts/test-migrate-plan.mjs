// Round-trip proof: WeekTodo.projectId survives JSON serialize + migratePlan.
// Mirrors the actual save path (JSON.stringify → PUT → fetch → migratePlan).
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const tsSrc = `
import { migratePlan, type QuartalPlan } from '../src/types'

const plan: QuartalPlan = {
  year: 2026,
  employees: [{ id: 'e1', name: 'MA 1', branch: 'de' }],
  cells: {},
  todos: {
    '0:10': [
      {
        id: 't1',
        text: 'Angebot vorbereiten',
        state: 'offen',
        projectId: 'proj-abc-123',
      },
    ],
  },
}

// Simulate save → fetch cycle: JSON serialize, parse back, migrate.
const roundTripped = JSON.parse(JSON.stringify(plan))
const migrated = migratePlan(roundTripped)
if (!migrated) throw new Error('migratePlan returned null')
const t = migrated.todos['0:10']?.[0]
if (!t) throw new Error('todo lost')
if (t.projectId !== 'proj-abc-123') {
  throw new Error(\`projectId lost (got \${JSON.stringify(t.projectId)})\`)
}
console.log('ok · projectId round-trips through JSON + migratePlan:', t.projectId)
`

writeFileSync(new URL('./_migrate-plan-check.ts', import.meta.url), tsSrc)
const res = spawnSync('npx', ['tsx', new URL('./_migrate-plan-check.ts', import.meta.url).pathname], {
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url).pathname,
})
process.exit(res.status ?? 1)
