// Weekly rollover — carries unfinished todos from the previous ISO week into
// the current week. Runs once per Monday 00:00 Berlin (Sunday 23:00 UTC in
// winter / Sunday 22:00 UTC in summer) via a Cloudflare Scheduled Worker
// that fetches this URL with the shared BACKUP_SECRET header. Intentionally
// idempotent: if it runs twice on the same Monday, the second run sees
// everything already marked `carriedOver` and does nothing.
//
// Rules (as agreed with the operator):
//  - A todo rolls over if progress < 100 AND state != 'erledigt'.
//  - Already-carried originals (`carriedOver = true`) never re-roll.
//  - Max 3 rolls per chain — `carriedCount` is incremented each hop.
//  - Original is locked read-only; duplicate carries progress, text, days
//    and a reference back to its origin.

interface Env {
  FORECAST_KV: KVNamespace
  BACKUP_SECRET: string
}

type TodoState = 'offen' | 'inProgress' | 'zurFreigabe' | 'erledigt'

type WeekTodo = {
  id: string
  text: string
  state: TodoState
  days?: number[]
  progress?: number
  rejectReason?: string
  carriedOver?: boolean
  carriedFrom?: { week: number; empIndex: number; todoId: string }
  carriedCount?: number
}

type QuartalPlan = {
  year: number
  employees: unknown[]
  cells: Record<string, unknown>
  todos?: Record<string, WeekTodo[]>
  pool?: unknown[]
  dismissedRosterEmployeeIds?: string[]
}

const MAX_CARRY = 3

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const provided = request.headers.get('x-backup-secret') ?? ''
  if (!env.BACKUP_SECRET) return json({ error: 'not configured' }, 503)
  if (provided !== env.BACKUP_SECRET) return json({ error: 'unauthorized' }, 401)

  const url = new URL(request.url)
  // Operator override: `?now=YYYY-MM-DD` lets you dry-run against a different
  // date. Default = current UTC time shifted +12h to land safely in Monday
  // local time regardless of DST.
  const nowParam = url.searchParams.get('now')
  const baseNow = nowParam ? new Date(`${nowParam}T12:00:00Z`) : new Date(Date.now() + 12 * 60 * 60 * 1000)

  const { year: currentYear, week: currentWeek } = isoWeek(baseNow)
  const prevDate = new Date(baseNow.getTime() - 7 * 24 * 60 * 60 * 1000)
  const { year: previousYear, week: previousWeek } = isoWeek(prevDate)

  const affectedYears = Array.from(new Set([previousYear, currentYear]))
  const summary: Array<{
    year: number
    rolled: number
    skippedAlreadyCarried: number
    skippedMaxReached: number
    skippedFinished: number
  }> = []

  // When previous and current year differ, duplicates belong to current-year
  // plan while originals are in previous-year plan. We may need to load both.
  for (const year of affectedYears) {
    const key = `plan-${year}`
    const raw = await env.FORECAST_KV.get(key)
    if (!raw) {
      summary.push({ year, rolled: 0, skippedAlreadyCarried: 0, skippedMaxReached: 0, skippedFinished: 0 })
      continue
    }
    let plan: QuartalPlan
    try {
      plan = JSON.parse(raw) as QuartalPlan
    } catch {
      summary.push({ year, rolled: 0, skippedAlreadyCarried: 0, skippedMaxReached: 0, skippedFinished: 0 })
      continue
    }
    const todos = plan.todos ?? {}
    let rolled = 0
    let skippedAlreadyCarried = 0
    let skippedMaxReached = 0
    let skippedFinished = 0

    const currentYearPlanKey = `plan-${currentYear}`
    let currentYearPlan: QuartalPlan | null = null
    if (year === currentYear) {
      currentYearPlan = plan
    } else {
      // Previous-year plan only matters if the previous week lives there.
      if (previousYear !== year) continue
      const otherRaw = await env.FORECAST_KV.get(currentYearPlanKey)
      if (!otherRaw) {
        summary.push({ year, rolled: 0, skippedAlreadyCarried: 0, skippedMaxReached: 0, skippedFinished: 0 })
        continue
      }
      try {
        currentYearPlan = JSON.parse(otherRaw) as QuartalPlan
      } catch {
        summary.push({ year, rolled: 0, skippedAlreadyCarried: 0, skippedMaxReached: 0, skippedFinished: 0 })
        continue
      }
    }

    // Scan todos from this year for cells whose week == previousWeek (if we
    // are iterating the previous year) or whose week == previousWeek (when
    // iterating current year and previous week falls in same year).
    // Simpler: scan every cell; filter by week number.
    const scanWeek = year === previousYear ? previousWeek : previousWeek
    for (const [k, list] of Object.entries(todos)) {
      const [eStr, wStr] = k.split(':')
      const empIndex = Number(eStr)
      const week = Number(wStr)
      if (!Number.isFinite(empIndex) || week !== scanWeek) continue
      for (const todo of list) {
        if (todo.carriedOver) {
          skippedAlreadyCarried++
          continue
        }
        const progress = todo.progress ?? 0
        if (todo.state === 'erledigt' || progress >= 100) {
          skippedFinished++
          continue
        }
        const nextCount = (todo.carriedCount ?? 0) + 1
        if (nextCount > MAX_CARRY) {
          skippedMaxReached++
          continue
        }
        // Mark original read-only.
        todo.carriedOver = true

        // Build duplicate in current week of current year plan.
        const newTodo: WeekTodo = {
          id: randomId(),
          text: todo.text,
          state: todo.state === 'offen' ? 'inProgress' : todo.state,
          progress,
          days: todo.days ? [...todo.days] : undefined,
          carriedFrom: { week, empIndex, todoId: todo.id },
          carriedCount: nextCount,
        }
        if (!currentYearPlan!.todos) currentYearPlan!.todos = {}
        const destKey = `${empIndex}:${currentWeek}`
        const existing = currentYearPlan!.todos[destKey] ?? []
        currentYearPlan!.todos[destKey] = [...existing, newTodo]
        rolled++
      }
    }

    // Persist both docs if any rolls happened.
    if (rolled > 0) {
      await env.FORECAST_KV.put(key, JSON.stringify(plan))
      if (year !== currentYear) {
        await env.FORECAST_KV.put(currentYearPlanKey, JSON.stringify(currentYearPlan!))
      }
    }

    summary.push({ year, rolled, skippedAlreadyCarried, skippedMaxReached, skippedFinished })
  }

  return json({
    ok: true,
    at: baseNow.toISOString(),
    currentYear,
    currentWeek,
    previousYear,
    previousWeek,
    maxCarry: MAX_CARRY,
    summary,
  })
}

export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  return json({
    ok: true,
    configured: Boolean(env.BACKUP_SECRET),
    maxCarry: MAX_CARRY,
    hint: 'POST with X-Backup-Secret header to run. Optional ?now=YYYY-MM-DD for dry-run.',
  })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// ISO-8601 week number, UTC-based.
function isoWeek(d: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (target.getUTCDay() + 6) % 7 // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604_800_000)
  const year = new Date(firstThursday).getUTCFullYear()
  return { year, week }
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
