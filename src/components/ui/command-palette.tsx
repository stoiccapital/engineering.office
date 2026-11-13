import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Building2, Calculator, CalendarDays, CheckSquare, ClipboardList, Database, FolderKanban, Gauge, LayoutDashboard, LogOut, Moon, Sun, Table2, Users } from 'lucide-react'
import { clearToken } from '@/api'
import { cn } from '@/lib/utils'

type View =
  | 'forecast'
  | 'plan'
  | 'freigaben'
  | 'dashboard'
  | 'ziele_dashboard'
  | 'ziele_teams'
  | 'ziele_kontrolle'
  | 'ks_bauwerke'
  | 'ks_hoai'
  | 'ks_katalog'
  | 'projekte'
  | 'projektliste'

type Props = {
  onNavigate: (view: View) => void
}

const ITEMS: { view: View; label: string; keywords: string; icon: typeof Table2 }[] = [
  { view: 'ziele_dashboard', label: 'Ziele · Dashboard', keywords: 'ziele dashboard fte pools teams teilungsschlüssel übersicht', icon: LayoutDashboard },
  { view: 'ziele_teams', label: 'Ziele · Teams', keywords: 'ziele teams mitarbeiter fte umsatz akquise bearbeiten', icon: Users },
  { view: 'ziele_kontrolle', label: 'Ziele · Zielkontrolle', keywords: 'zielkontrolle umsatz rechnungen puffer monatlich', icon: Gauge },
  { view: 'dashboard', label: 'Dashboard', keywords: 'dashboard kpi forecast überblick', icon: LayoutDashboard },
  { view: 'forecast', label: 'Forecast', keywords: 'forecast projekte abgerechnet quartal', icon: Table2 },
  { view: 'plan', label: 'Quartalsplanung', keywords: 'plan quartalsplanung aufgaben mitarbeiter kw', icon: CalendarDays },
  { view: 'freigaben', label: 'Freigaben', keywords: 'freigaben validierung erledigt aufgaben pm', icon: CheckSquare },
  { view: 'ks_bauwerke', label: 'Kostenschätzung · Bauwerke', keywords: 'kosten schätzung bauwerk position abschnitt menge einheitspreis', icon: Building2 },
  { view: 'ks_hoai', label: 'Kostenschätzung · HOAI-Honorar', keywords: 'hoai honorar objektplanung tragwerksplanung leistungsphase', icon: Calculator },
  { view: 'ks_katalog', label: 'Kostenschätzung · Datenbank Ril 808', keywords: 'katalog ril 808 db baupreise datenbank suche', icon: Database },
  { view: 'projekte', label: 'Projekte', keywords: 'projekte todo todos frist notizen schreibfläche', icon: ClipboardList },
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

  const logout = () => {
    clearToken()
    location.reload()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 p-4 pt-24 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border bg-card shadow-xl"
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
          <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ navigieren · ↵ auswählen · esc schließen</span>
            <span className="font-mono">⌘ K</span>
          </div>
        </Command>
      </div>
    </div>
  )
}

const groupCls = cn(
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted-foreground',
)

const itemCls = cn(
  'flex cursor-pointer items-center gap-2.5 rounded px-2 py-2 text-sm outline-none',
  'aria-selected:bg-accent aria-selected:text-foreground',
)
