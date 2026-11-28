import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { CalendarDays, CheckSquare, FilePlus, FolderKanban, FolderPlus, Gauge, LayoutDashboard, LogOut, Moon, Receipt, Sun, Table2, UserPlus, Users } from 'lucide-react'
import { useAccess } from '@/access-store'
import { useProjektliste } from '@/projektliste-store'
import { useRechnungen } from '@/rechnungen-store'
import { useRoster } from '@/roster-store'
import { cn } from '@/lib/utils'

type View =
  | 'forecast'
  | 'plan'
  | 'freigaben'
  | 'dashboard'
  | 'ziele_dashboard'
  | 'ziele_teams'
  | 'ziele_kontrolle'
  | 'projektliste'
  | 'rechnungen'
  | 'mitarbeiter'

type Props = {
  onNavigate: (view: View) => void
}

type Verb = {
  id: string
  label: string
  keywords: string
  icon: typeof Table2
  run: (ctx: { navigate: (v: View) => void }) => void
}

// Verbs = the things people actually do. Each either mutates a store
// directly (addRow-style) or navigates + schedules a next-microtask action.
// Role-filtering is deliberately NOT applied here: the destination view is
// already role-gated at the App level — a user who can't access a view can't
// land on it, so triggering the verb is a no-op for them. Keeps the palette
// simple and discoverable.
const VERBS: Verb[] = [
  {
    id: 'project.create',
    label: 'Projekt anlegen',
    keywords: 'projekt anlegen neu projektliste',
    icon: FolderPlus,
    run: ({ navigate }) => {
      navigate('projektliste')
      queueMicrotask(() => {
        try { useProjektliste.getState().addRow() } catch { /* doc not loaded yet */ }
      })
    },
  },
  {
    id: 'invoice.create',
    label: 'Rechnung erstellen',
    keywords: 'rechnung erstellen neu invoice',
    icon: Receipt,
    run: ({ navigate }) => {
      navigate('rechnungen')
      queueMicrotask(() => {
        try { useRechnungen.getState().addRow() } catch { /* data not loaded yet */ }
      })
    },
  },
  {
    id: 'employee.create',
    label: 'Mitarbeiter anlegen',
    keywords: 'mitarbeiter anlegen neu einstellen roster',
    icon: UserPlus,
    run: ({ navigate }) => {
      navigate('mitarbeiter')
      queueMicrotask(() => {
        try { useRoster.getState().addEmployee() } catch { /* roster not loaded */ }
      })
    },
  },
  {
    id: 'forecast.add-row',
    label: 'Forecast-Zeile anlegen',
    keywords: 'forecast zeile anlegen projekt neu',
    icon: FilePlus,
    run: ({ navigate }) => {
      navigate('forecast')
      // Forecast is in src/store.ts (useForecast); its addRow lives there.
      // Lazy-import to avoid cyclic imports in this UI module.
      void import('@/store').then((m) => {
        try { m.useForecast.getState().addRow() } catch { /* not loaded */ }
      })
    },
  },
]

const ITEMS: { view: View; label: string; keywords: string; icon: typeof Table2 }[] = [
  { view: 'ziele_dashboard', label: 'Ziele · Dashboard', keywords: 'ziele dashboard fte pools teams teilungsschlüssel übersicht', icon: LayoutDashboard },
  { view: 'ziele_teams', label: 'Ziele · Teams', keywords: 'ziele teams mitarbeiter fte umsatz akquise bearbeiten', icon: Users },
  { view: 'ziele_kontrolle', label: 'Ziele · Zielkontrolle', keywords: 'zielkontrolle umsatz rechnungen puffer monatlich', icon: Gauge },
  { view: 'dashboard', label: 'Dashboard', keywords: 'dashboard kpi forecast überblick', icon: LayoutDashboard },
  { view: 'forecast', label: 'Forecast', keywords: 'forecast projekte abgerechnet quartal', icon: Table2 },
  { view: 'plan', label: 'Quartalsplanung', keywords: 'plan quartalsplanung aufgaben mitarbeiter kw', icon: CalendarDays },
  { view: 'freigaben', label: 'Freigaben', keywords: 'freigaben validierung erledigt aufgaben pm', icon: CheckSquare },
  { view: 'projektliste', label: 'Projektliste', keywords: 'projektliste controlling kosten forecast abrechnung portfolio excel import', icon: FolderKanban },
]

export function CommandPalette({ onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('eo:theme', isDark ? 'dark' : 'light')
    close()
  }

  const logout = async () => {
    await useAccess.getState().signOut()
    location.reload()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 p-4 pt-24"
      onClick={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-md border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          loop
          className="flex flex-col"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Escape') close()
          }}
        >
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Suche Modul oder Aktion…"
            className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
              Keine Treffer.
            </Command.Empty>

            <Command.Group heading="Aktionen" className={groupCls}>
              {VERBS.map((verb) => {
                const Icon = verb.icon
                return (
                  <Command.Item
                    key={verb.id}
                    value={`${verb.label} ${verb.keywords}`}
                    onSelect={() => {
                      verb.run({ navigate: onNavigate })
                      close()
                    }}
                    className={itemCls}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{verb.label}</span>
                  </Command.Item>
                )
              })}
            </Command.Group>

            <Command.Group heading="Navigation" className={groupCls}>
              {ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <Command.Item
                    key={item.view}
                    value={`${item.label} ${item.keywords}`}
                    onSelect={() => {
                      onNavigate(item.view)
                      close()
                    }}
                    className={itemCls}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{item.label}</span>
                  </Command.Item>
                )
              })}
            </Command.Group>

            <Command.Group heading="Darstellung" className={groupCls}>
              <Command.Item value="theme dark light hell dunkel" onSelect={toggleTheme} className={itemCls}>
                <Sun className="h-4 w-4 text-muted-foreground dark:hidden" />
                <Moon className="hidden h-4 w-4 text-muted-foreground dark:block" />
                <span className="flex-1">Theme umschalten</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Konto" className={groupCls}>
              <Command.Item value="logout abmelden" onSelect={logout} className={itemCls}>
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Abmelden</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>↑↓ navigieren · ↵ auswählen · esc schließen</span>
            <span className="font-mono">⌘ K</span>
          </div>
        </Command>
      </div>
    </div>
  )
}

const groupCls = cn(
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground',
)

const itemCls = cn(
  'flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 text-sm outline-none',
  'aria-selected:bg-accent aria-selected:text-foreground',
)
