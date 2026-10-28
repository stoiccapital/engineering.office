import { PeriodSwitcher } from '@/components/PeriodSwitcher'
import { KPIStrip } from '@/components/KPIStrip'
import { ForecastTable } from '@/components/ForecastTable'

export default function App() {
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
          <PeriodSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] space-y-6 px-6 py-6">
        <KPIStrip />
        <ForecastTable />
        <Legend />
      </main>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="font-mono font-semibold">Legende</span>
      <span>
        <span className="mr-1 inline-block rounded bg-destructive/10 px-1.5 py-0.5 font-mono font-semibold text-destructive">k</span>
        kritisch
      </span>
      <span>
        <span className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono font-semibold">w</span>
        wahrscheinlich
      </span>
      <span className="ml-auto">
        Werte in €. Daten werden lokal im Browser gespeichert.
      </span>
    </div>
  )
}
