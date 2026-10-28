import { useEffect } from 'react'
import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { KPIStrip } from '@/components/KPIStrip'
import { ForecastTable } from '@/components/ForecastTable'
import { AuthGate } from '@/components/AuthGate'
import { SaveStatus } from '@/components/SaveStatus'
import { useForecast } from '@/store'
import { clearToken } from '@/api'

export default function App() {
  return (
    <AuthGate>
      <Shell />
    </AuthGate>
  )
}

function Shell() {
  const load = useForecast((s) => s.load)
  const period = useForecast((s) => s.period)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-6 py-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ingenieurbüro
            </div>
            <h1 className="text-lg font-semibold">Forecast</h1>
          </div>
          <div className="flex items-center gap-4">
            <SaveStatus />
            <PeriodSwitcher />
            <button
              onClick={() => {
                clearToken()
                location.reload()
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
              title="Abmelden"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] space-y-6 px-6 py-6">
        {period ? (
          <>
            <KPIStrip />
            <ForecastTable />
            <Legend />
          </>
        ) : (
          <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
            Lade Forecast…
          </div>
        )}
      </main>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="font-mono font-semibold">Legende</span>
      <span>
        <span className="mr-1 inline-block rounded bg-destructive/10 px-1.5 py-0.5 font-mono font-semibold text-destructive">
          k
        </span>
        kritisch
      </span>
      <span>
        <span className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono font-semibold">w</span>
        wahrscheinlich
      </span>
      <span className="ml-auto">
        Werte in €. Änderungen werden automatisch gespeichert.
      </span>
    </div>
  )
}
