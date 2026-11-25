import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { useKostenermittlung } from '@/kostenermittlung-store'
import { useAccess } from '@/access-store'
import { useLogo } from '@/logo-store'
import {
  HAUPTGRUPPEN,
  findEbene2,
  validateKgk,
} from '@/features/kostenermittlung/lib/kgk'
import { positionKosten } from '@/features/kostenermittlung/lib/rollup'
import { loadKatalog, type KatalogMeta } from '@/features/kostenermittlung/lib/katalog'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { NumCell } from '@/components/NumCell'
import { TextCell } from '@/components/TextCell'
import { cn } from '@/lib/utils'
import type { Position } from '@/features/kostenermittlung/types'
import { KatalogDialog, pickToPatch, type KatalogPick } from './KatalogDialog'
import { ExportMenu, type ExportChoice } from './ExportMenu'
import { useColumnResize, useColumnWidths } from './useColumnWidths'
import { useFullscreen } from '@/components/ui/use-fullscreen'
import { FullscreenToggle } from '@/components/ui/fullscreen-toggle'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const ARTEN = ['Kostenschätzung', 'Kostenberechnung', 'Kostenanschlag'] as const

const fmtEUR2 = (v: number): string =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

export function PositionenTab() {
  const { ref: containerRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()
  const doc = useKostenermittlung((s) => s.doc)
  const addPosition = useKostenermittlung((s) => s.addPosition)
  const updatePosition = useKostenermittlung((s) => s.updatePosition)
  const reorderInHauptgruppe = useKostenermittlung((s) => s.reorderInHauptgruppe)
  const setKopf = useKostenermittlung((s) => s.setKopf)
  const currentUser = useAccess((s) => s.currentUser)
  const logoUrl = useLogo((s) => s.dataUrl)
  const logoStatus = useLogo((s) => s.status)
  const loadLogo = useLogo((s) => s.load)
  const [meta, setMeta] = useState<KatalogMeta | null>(null)

  // Prefetch the logo so the first PDF click is instant.
  useEffect(() => {
    if (logoStatus === 'idle') void loadLogo()
  }, [logoStatus, loadLogo])

  const handleExport = async (choice: ExportChoice) => {
    if (!doc) return
    // Lazy — pull jsPDF / xlsx only when the user actually exports.
    if (choice === 'pdf') {
      const { exportPositionenPdf } = await import(
        '@/features/kostenermittlung/lib/pdfPositionen'
      )
      exportPositionenPdf(doc, { logoDataUrl: logoUrl })
    } else if (choice === 'xlsx') {
      const { exportPositionenXlsx } = await import(
        '@/features/kostenermittlung/lib/excel'
      )
      exportPositionenXlsx(doc)
    } else {
      const { exportPositionenCsv } = await import(
        '@/features/kostenermittlung/lib/csv'
      )
      exportPositionenCsv(doc)
    }
  }

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

  // Default "Bearbeitet von" to the signed-in user once, if the field is blank.
  useEffect(() => {
    if (!doc) return
    if (!doc.kopf.bearbeitetVon && currentUser?.displayName) {
      setKopf({ bearbeitetVon: currentUser.displayName })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.kopf.bearbeitetVon, currentUser?.displayName])

  useEffect(() => {
    let cancelled = false
    void loadKatalog().then((k) => {
      if (!cancelled) setMeta(k.meta)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  const sensors = useSensors(
    // 6-px activation distance prevents an accidental drag from a cell click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const hauptgruppe = active.data.current?.hauptgruppe as Position['hauptgruppe'] | undefined
    const overHg = over.data.current?.hauptgruppe as Position['hauptgruppe'] | undefined
    // Cross-Hauptgruppe moves are intentionally not supported.
    if (!hauptgruppe || hauptgruppe !== overHg) return
    const list = grouped.get(hauptgruppe) ?? []
    const from = list.findIndex((p) => p.id === active.id)
    const to = list.findIndex((p) => p.id === over.id)
    if (from === -1 || to === -1) return
    const next = [...list]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    reorderInHauptgruppe(
      hauptgruppe,
      next.map((p) => p.id),
    )
  }

  if (!doc) return null
  const k = doc.kopf
  const preisstandMatch = meta ? normalizeQuartal(k.projektpreisstand) === meta.quartal : null

  return (
    <div
      ref={containerRef}
      className={cn(
        'space-y-4',
        isFullscreen && 'h-screen w-screen overflow-auto bg-background p-4',
      )}
    >
      <Section
        title="Projektkopf"
        action={
          <div className="flex items-center gap-1">
            <ExportMenu onSelect={handleExport} />
            <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
          </div>
        }
      >
        <div className="grid grid-cols-[180px_1fr] gap-x-6 gap-y-3 text-sm">
          <Label>Projekt</Label>
          <TextCell value={k.projekt} onChange={(v) => setKopf({ projekt: v })} multiline />

          <Label>Projektnummer</Label>
          <TextCell
            value={k.projektnummer}
            onChange={(v) => setKopf({ projektnummer: v })}
            multiline
          />

          <Label>Auftraggeber</Label>
          <TextCell
            value={k.auftraggeber}
            onChange={(v) => setKopf({ auftraggeber: v })}
            multiline
          />

          <Label>Ermittlungsart</Label>
          <select
            value={k.ermittlungsart}
            onChange={(e) =>
              setKopf({ ermittlungsart: e.target.value as (typeof ARTEN)[number] })
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {ARTEN.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <Label>Bearbeitet von</Label>
          <TextCell
            value={k.bearbeitetVon}
            onChange={(v) => setKopf({ bearbeitetVon: v })}
            multiline
          />

          <Label>Datum</Label>
          <input
            type="date"
            value={k.datum}
            onChange={(e) => setKopf({ datum: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          />

          <Label>Projektpreisstand</Label>
          <div className="space-y-1">
            <TextCell
              value={k.projektpreisstand}
              onChange={(v) => setKopf({ projektpreisstand: v })}
              placeholder="z.B. Q3/2026"
              multiline
            />
            {meta && (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]',
                  preisstandMatch
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    preisstandMatch ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                />
                Katalog: {meta.quartal}
                {preisstandMatch
                  ? ' · stimmt überein'
                  : ` · weicht ab (Positionen stammen aus ${meta.quartal})`}
              </div>
            )}
          </div>

          <Label>USt-Satz</Label>
          <div className="flex items-center gap-2">
            <div className="w-32">
              <NumCell
                value={k.umsatzsteuer}
                onChange={(v) => setKopf({ umsatzsteuer: v })}
                pct
              />
            </div>
            <button
              type="button"
              onClick={() => setKopf({ umsatzsteuer: null })}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              leer
            </button>
          </div>
        </div>
      </Section>

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

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
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
                <span className="text-xs text-muted-foreground">{items.length} Pos.</span>
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
      </DndContext>

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

// Columns the user can resize. Drag handle + actions columns stay fixed.
const RESIZABLE_COLUMNS = [
  'kgk',
  'text',
  'anmerkung',
  'menge',
  'einheit',
  'einheitspreis',
  'kosten',
  'erlaeuterung',
] as const
type ResizableCol = (typeof RESIZABLE_COLUMNS)[number]

const DEFAULT_WIDTHS: Record<ResizableCol, number> = {
  kgk: 110,
  text: 220,
  anmerkung: 360,
  menge: 90,
  einheit: 80,
  einheitspreis: 120,
  kosten: 120,
  erlaeuterung: 320,
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
  const { getWidth, setWidth, resetWidth } = useColumnWidths(
    'ke.positionen',
    DEFAULT_WIDTHS,
  )
  if (positions.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        Noch keine Positionen in dieser Hauptgruppe.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table
        className="border-separate border-spacing-0 text-sm"
        style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
      >
        <colgroup>
          <col style={{ width: 28 }} />
          <col style={{ width: getWidth('kgk') }} />
          <col style={{ width: getWidth('text') }} />
          <col style={{ width: getWidth('anmerkung') }} />
          <col style={{ width: getWidth('menge') }} />
          <col style={{ width: getWidth('einheit') }} />
          <col style={{ width: getWidth('einheitspreis') }} />
          <col style={{ width: getWidth('kosten') }} />
          <col style={{ width: getWidth('erlaeuterung') }} />
          <col style={{ width: 80 }} />
        </colgroup>
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
            <Th></Th>
            <ResizableTh col="kgk" getWidth={getWidth} setWidth={setWidth} resetWidth={resetWidth}>
              KGK
            </ResizableTh>
            <ResizableTh col="text" getWidth={getWidth} setWidth={setWidth} resetWidth={resetWidth}>
              Text
            </ResizableTh>
            <ResizableTh col="anmerkung" getWidth={getWidth} setWidth={setWidth} resetWidth={resetWidth}>
              Anmerkung
            </ResizableTh>
            <ResizableTh col="menge" getWidth={getWidth} setWidth={setWidth} resetWidth={resetWidth} className="text-right">
              Menge
            </ResizableTh>
            <ResizableTh col="einheit" getWidth={getWidth} setWidth={setWidth} resetWidth={resetWidth}>
              Einheit
            </ResizableTh>
            <ResizableTh col="einheitspreis" getWidth={getWidth} setWidth={setWidth} resetWidth={resetWidth} className="text-right">
              Einheitspreis
            </ResizableTh>
            <ResizableTh col="kosten" getWidth={getWidth} setWidth={setWidth} resetWidth={resetWidth} className="text-right">
              Kosten
            </ResizableTh>
            <ResizableTh col="erlaeuterung" getWidth={getWidth} setWidth={setWidth} resetWidth={resetWidth}>
              Erläuterung
            </ResizableTh>
            <Th></Th>
          </tr>
        </thead>
        <SortableContext
          items={positions.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
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
        </SortableContext>
      </table>
    </div>
  )
}

function ResizableTh({
  col,
  children,
  className,
  getWidth,
  setWidth,
  resetWidth,
}: {
  col: ResizableCol
  children?: React.ReactNode
  className?: string
  getWidth: (id: string) => number
  setWidth: (id: string, px: number) => void
  resetWidth: (id: string) => void
}) {
  const { onPointerDown } = useColumnResize(col, getWidth, setWidth)
  return (
    <th
      className={cn(
        'relative border-b px-2 pb-2 text-left font-medium',
        className,
      )}
    >
      {children}
      <div
        role="separator"
        aria-label="Spaltenbreite ändern"
        title="Ziehen zum Ändern der Spaltenbreite · Doppelklick zum Zurücksetzen"
        onPointerDown={onPointerDown}
        onDoubleClick={() => resetWidth(col)}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-foreground/20"
      />
    </th>
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

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: p.id, data: { hauptgruppe } })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }

  const check = validateKgk(p.kgk, hauptgruppe)
  const ebene2 = findEbene2(p.kgk)
  const kosten = positionKosten(p)

  return (
    <tr ref={setNodeRef} style={style} className="group">
      <Td>
        <button
          type="button"
          title="Ziehen, um die Reihenfolge zu ändern"
          className="flex h-full cursor-grab items-center justify-center p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </Td>
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
          placeholder="Anmerkung"
          multiline
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
          placeholder="Erläuterung"
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

// Normalize user input like "Q3 2026", "q3/2026" → "Q3/2026" for the match check.
function normalizeQuartal(v: string): string {
  const m = v.trim().match(/^q?\s*([1-4])[\s/\-.]*([0-9]{2,4})$/i)
  if (!m) return v.trim()
  const q = m[1]
  const y = m[2].length === 2 ? '20' + m[2] : m[2]
  return `Q${q}/${y}`
}
