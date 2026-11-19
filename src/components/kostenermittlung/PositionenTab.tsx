import { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { useKostenermittlung } from '@/kostenermittlung-store'
import {
  HAUPTGRUPPEN,
  findEbene2,
  validateKgk,
} from '@/features/kostenermittlung/lib/kgk'
import { positionKosten } from '@/features/kostenermittlung/lib/rollup'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { NumCell } from '@/components/NumCell'
import { TextCell } from '@/components/TextCell'
import { cn } from '@/lib/utils'
import type { Position } from '@/features/kostenermittlung/types'
import { KatalogDialog, pickToPatch, type KatalogPick } from './KatalogDialog'

const fmtEUR2 = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

export function PositionenTab() {
  const doc = useKostenermittlung((s) => s.doc)
  const addPosition = useKostenermittlung((s) => s.addPosition)
  const updatePosition = useKostenermittlung((s) => s.updatePosition)
  const [open, setOpen] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {}
    for (const h of HAUPTGRUPPEN) init[h.nummer] = true
    return init
  })
  // Picker target: either an existing position (patch it) or a Hauptgruppe
  // (create a new position from the pick). null = closed.
  const [pickerTarget, setPickerTarget] = useState<
    | { kind: 'row'; id: string; hauptgruppe: Position['hauptgruppe'] }
    | { kind: 'new'; hauptgruppe: Position['hauptgruppe'] }
    | null
  >(null)

  const handlePick = (pick: KatalogPick) => {
    if (!pickerTarget) return
    const patch = pickToPatch(pick)
    if (pickerTarget.kind === 'row') {
      updatePosition(pickerTarget.id, patch)
    } else {
      addPosition(pickerTarget.hauptgruppe, patch)
    }
    setPickerTarget(null)
  }

  const grouped = useMemo(() => {
    const map = new Map<number, Position[]>()
    HAUPTGRUPPEN.forEach((h) => map.set(h.nummer, []))
    for (const p of doc?.positionen ?? []) {
      const list = map.get(p.hauptgruppe)
      if (list) list.push(p)
    }
    return map
  }, [doc?.positionen])

  const total = useMemo(
    () => (doc?.positionen ?? []).reduce((a, p) => a + positionKosten(p), 0),
    [doc?.positionen],
  )

  if (!doc) return null

  return (
    <div className="space-y-4">
      <Section
        padded={false}
        contentClassName="flex items-center gap-3 px-4 py-3"
        className="bg-card"
      >
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Positionen gesamt
        </div>
        <div className="font-mono tabular-nums text-lg font-semibold">
          {fmtEUR2(total)} €
        </div>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">
          {doc.positionen.length} Position
          {doc.positionen.length === 1 ? '' : 'en'}
        </div>
      </Section>

      {HAUPTGRUPPEN.map((h) => {
        const items = grouped.get(h.nummer) ?? []
        const sum = items.reduce((a, p) => a + positionKosten(p), 0)
        const expanded = open[h.nummer] ?? true
        return (
          <section key={h.code} className="rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [h.nummer]: !expanded }))}
              className="flex w-full items-center gap-2 border-b px-4 py-3 text-left"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {h.code}
              </span>
              <span className="text-sm font-semibold">{h.name}</span>
              <span className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {items.length} Pos.
              </span>
              <span className="font-mono tabular-nums text-sm font-semibold">
                {fmtEUR2(sum)} €
              </span>
            </button>
            {expanded && (
              <div className="p-3">
                <PositionsTable
                  positions={items}
                  hauptgruppe={h.nummer}
                  onOpenPicker={(id) =>
                    setPickerTarget({ kind: 'row', id, hauptgruppe: h.nummer })
                  }
                />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addPosition(h.nummer)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Position
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setPickerTarget({ kind: 'new', hauptgruppe: h.nummer })
                    }
                  >
                    <BookOpen className="mr-1 h-3.5 w-3.5" /> Aus Katalog
                  </Button>
                </div>
              </div>
            )}
          </section>
        )
      })}

      <KatalogDialog
        open={pickerTarget !== null}
        onOpenChange={(v) => {
          if (!v) setPickerTarget(null)
        }}
        hauptgruppe={pickerTarget?.hauptgruppe}
        onPick={handlePick}
      />
    </div>
  )
}

function PositionsTable({
  positions,
  hauptgruppe,
  onOpenPicker,
}: {
  positions: Position[]
  hauptgruppe: Position['hauptgruppe']
  onOpenPicker: (id: string) => void
}) {
  if (positions.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        Noch keine Positionen in dieser Hauptgruppe.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
            <Th className="w-[110px]">KGK</Th>
            <Th>Text</Th>
            <Th className="w-[160px]">Anmerkung</Th>
            <Th className="w-[90px] text-right">Menge</Th>
            <Th className="w-[80px]">Einheit</Th>
            <Th className="w-[110px] text-right">Einheitspreis</Th>
            <Th className="w-[120px] text-right">Kosten</Th>
            <Th className="w-[200px]">Erläuterung</Th>
            <Th className="w-[80px]"></Th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <PositionRow
              key={p.id}
              p={p}
              hauptgruppe={hauptgruppe}
              onOpenPicker={() => onOpenPicker(p.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PositionRow({
  p,
  hauptgruppe,
  onOpenPicker,
}: {
  p: Position
  hauptgruppe: Position['hauptgruppe']
  onOpenPicker: () => void
}) {
  const update = useKostenermittlung((s) => s.updatePosition)
  const remove = useKostenermittlung((s) => s.removePosition)
  const duplicate = useKostenermittlung((s) => s.duplicatePosition)

  const check = validateKgk(p.kgk, hauptgruppe)
  const ebene2 = findEbene2(p.kgk)
  const kosten = positionKosten(p)

  return (
    <tr className="group">
      <Td>
        <div className="space-y-0.5">
          <input
            value={p.kgk ?? ''}
            onChange={(e) => update(p.id, { kgk: e.target.value || null })}
            placeholder="z.B. 3330000"
            inputMode="numeric"
            className={cn(
              'w-full rounded-sm bg-foreground/[0.03] px-2 py-1.5 font-mono tabular-nums text-sm outline-none transition-colors hover:bg-foreground/[0.06] focus:bg-foreground/[0.1]',
              !check.ok && 'ring-1 ring-destructive/50',
            )}
          />
          {ebene2 ? (
            <div className="truncate text-[10px] text-muted-foreground" title={ebene2.name}>
              {ebene2.name}
            </div>
          ) : !check.ok ? (
            <div className="text-[10px] text-destructive">{check.reason}</div>
          ) : null}
        </div>
      </Td>
      <Td>
        <TextCell
          value={p.text}
          onChange={(v) => update(p.id, { text: v })}
          placeholder="Text zur KGK-Nummer"
          multiline
        />
      </Td>
      <Td>
        <TextCell
          value={p.anmerkung ?? ''}
          onChange={(v) => update(p.id, { anmerkung: v || null })}
        />
      </Td>
      <Td className="text-right">
        <NumCell
          value={p.menge}
          onChange={(v) => update(p.id, { menge: v ?? 0 })}
          decimals={2}
        />
      </Td>
      <Td>
        <TextCell
          value={p.einheit}
          onChange={(v) => update(p.id, { einheit: v })}
          placeholder="z.B. m³"
        />
      </Td>
      <Td className="text-right">
        <NumCell
          value={p.einheitspreis}
          onChange={(v) => update(p.id, { einheitspreis: v ?? 0 })}
          decimals={2}
        />
      </Td>
      <Td className="text-right">
        <div className="px-2 py-1.5 font-mono tabular-nums text-sm">
          {kosten ? fmtEUR2(kosten) : ''}
        </div>
      </Td>
      <Td>
        <TextCell
          value={p.erlaeuterung ?? ''}
          onChange={(v) => update(p.id, { erlaeuterung: v || null })}
          multiline
        />
      </Td>
      <Td>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="Aus Katalog wählen"
            onClick={onOpenPicker}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <BookOpen className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Duplizieren"
            onClick={() => duplicate(p.id)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Löschen"
            onClick={() => remove(p.id)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </Td>
    </tr>
  )
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b px-2 pb-2 text-left font-medium',
        className,
      )}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('align-top py-1', className)}>{children}</td>
}

