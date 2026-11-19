import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HAUPTGRUPPEN } from '@/features/kostenermittlung/lib/kgk'
import type { FreiEntry, Katalog, KgkEntry } from '@/features/kostenermittlung/lib/katalog'
import {
  validateNewKgkCode,
  type KatalogOverrides,
} from '@/features/kostenermittlung/lib/katalogOverrides'

export type EntryEditorTarget =
  | { kind: 'addKgk' }
  | { kind: 'editKgk'; entry: KgkEntry; isAdded: boolean }
  | { kind: 'addFrei' }
  | { kind: 'editFrei'; entry: FreiEntry; isAdded: boolean }

export function EntryEditor({
  target,
  katalog,
  overrides,
  onClose,
  onSaveKgk,
  onSaveFrei,
  onDelete,
  onHide,
}: {
  target: EntryEditorTarget | null
  katalog: Katalog | null
  overrides: KatalogOverrides | null
  onClose: () => void
  // KGK: when editing an existing row, `code` remains the row's code and the
  // caller patches that code; when adding, `code` is the fresh code.
  onSaveKgk: (entry: KgkEntry, mode: 'add' | 'edit') => void
  onSaveFrei: (entry: FreiEntry, mode: 'add' | 'edit') => void
  onDelete: () => void
  onHide: () => void
}) {
  if (!target) return null
  const open = target !== null
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-0 shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <Dialog.Title className="text-sm font-semibold">
                {target.kind === 'addKgk' && 'KGK-Eintrag hinzufügen'}
                {target.kind === 'editKgk' && 'KGK-Eintrag bearbeiten'}
                {target.kind === 'addFrei' && 'Freien Eintrag hinzufügen'}
                {target.kind === 'editFrei' && 'Freien Eintrag bearbeiten'}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {target.kind === 'editKgk' && target.isAdded
                  ? 'Benutzer-Eintrag'
                  : target.kind === 'editFrei' && target.isAdded
                    ? 'Benutzer-Eintrag'
                    : target.kind.startsWith('edit')
                      ? 'Basiseintrag — Ergänzungen überschreiben die Datenbank beim Laden.'
                      : 'Neuer Eintrag'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Schließen">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="p-4">
            {(target.kind === 'addKgk' || target.kind === 'editKgk') && (
              <KgkForm
                target={target}
                katalog={katalog}
                overrides={overrides}
                onSave={onSaveKgk}
                onClose={onClose}
                onDelete={onDelete}
                onHide={onHide}
              />
            )}
            {(target.kind === 'addFrei' || target.kind === 'editFrei') && (
              <FreiForm
                target={target}
                onSave={onSaveFrei}
                onClose={onClose}
                onDelete={onDelete}
                onHide={onHide}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function KgkForm({
  target,
  katalog,
  overrides,
  onSave,
  onClose,
  onDelete,
  onHide,
}: {
  target: Extract<EntryEditorTarget, { kind: 'addKgk' | 'editKgk' }>
  katalog: Katalog | null
  overrides: KatalogOverrides | null
  onSave: (entry: KgkEntry, mode: 'add' | 'edit') => void
  onClose: () => void
  onDelete: () => void
  onHide: () => void
}) {
  const isEdit = target.kind === 'editKgk'
  const initial: KgkEntry =
    target.kind === 'editKgk'
      ? target.entry
      : {
          code: '',
          ebene: 2,
          bezeichnung: '',
          einheit: '',
          anmerkung: '',
          parent: null,
          pfad: null,
          epVon: null,
          epBis: null,
          epEinheit: '',
        }

  const [form, setForm] = useState<KgkEntry>(initial)
  useEffect(() => setForm(initial), [target])

  const codeCheck =
    isEdit || !katalog || !overrides
      ? { ok: true as const }
      : validateNewKgkCode(form.code, katalog, overrides)

  const canSave =
    form.bezeichnung.trim().length > 0 &&
    (isEdit || codeCheck.ok)

  const submit = () => {
    if (!canSave) return
    onSave({ ...form, bezeichnung: form.bezeichnung.trim() }, isEdit ? 'edit' : 'add')
    onClose()
  }

  return (
    <div className="space-y-3 text-sm">
      {!isEdit && (
        <Row label="KGK-Code">
          <div className="space-y-1">
            <input
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.toUpperCase() })
              }
              inputMode="numeric"
              maxLength={7}
              placeholder="z.B. 3335000"
              className="h-9 w-40 rounded-md border border-input bg-background px-2 font-mono tabular-nums text-sm outline-none"
            />
            {!codeCheck.ok && (
              <div className="text-[11px] text-destructive">{codeCheck.reason}</div>
            )}
          </div>
        </Row>
      )}
      {!isEdit && (
        <Row label="Hauptgruppe">
          <div className="text-xs text-muted-foreground">
            {form.code
              ? HAUPTGRUPPEN.find((h) => h.nummer === Number(form.code[0]))?.name ??
                '—'
              : '—'}
          </div>
        </Row>
      )}
      {!isEdit && (
        <Row label="Ebene">
          <select
            value={form.ebene}
            onChange={(e) => setForm({ ...form, ebene: Number(e.target.value) })}
            className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Row>
      )}
      {!isEdit && (
        <Row label="Übergeordneter Code">
          <input
            value={form.parent ?? ''}
            onChange={(e) => setForm({ ...form, parent: e.target.value || null })}
            placeholder="optional, z.B. 3330000"
            className="h-9 w-40 rounded-md border border-input bg-background px-2 font-mono tabular-nums text-sm outline-none"
          />
        </Row>
      )}
      <Row label="Bezeichnung">
        <input
          autoFocus={isEdit}
          value={form.bezeichnung}
          onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none"
        />
      </Row>
      <Row label="Einheit">
        <input
          value={form.einheit ?? ''}
          onChange={(e) => setForm({ ...form, einheit: e.target.value || null })}
          className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm outline-none"
          placeholder="z.B. m²"
        />
      </Row>
      <Row label="EP von [EUR]">
        <input
          type="number"
          step="0.01"
          value={form.epVon ?? ''}
          onChange={(e) =>
            setForm({
              ...form,
              epVon: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm outline-none"
        />
      </Row>
      <Row label="EP bis [EUR]">
        <input
          type="number"
          step="0.01"
          value={form.epBis ?? ''}
          onChange={(e) =>
            setForm({
              ...form,
              epBis: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm outline-none"
        />
      </Row>
      <Row label="Anmerkung">
        <textarea
          rows={3}
          value={form.anmerkung ?? ''}
          onChange={(e) => setForm({ ...form, anmerkung: e.target.value || null })}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
        />
      </Row>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        {isEdit ? (
          <div className="flex items-center gap-2">
            {target.kind === 'editKgk' && target.isAdded ? (
              <Button variant="ghost" onClick={() => { onDelete(); onClose() }}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                Löschen
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => { onHide(); onClose() }}>
                Ausblenden
              </Button>
            )}
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={submit} disabled={!canSave}>Speichern</Button>
        </div>
      </div>
    </div>
  )
}

function FreiForm({
  target,
  onSave,
  onClose,
  onDelete,
  onHide,
}: {
  target: Extract<EntryEditorTarget, { kind: 'addFrei' | 'editFrei' }>
  onSave: (entry: FreiEntry, mode: 'add' | 'edit') => void
  onClose: () => void
  onDelete: () => void
  onHide: () => void
}) {
  const isEdit = target.kind === 'editFrei'
  const initial: FreiEntry =
    target.kind === 'editFrei'
      ? target.entry
      : {
          id: -1, // will be replaced by caller with nextAddedFreiId
          bezeichnung: '',
          anmerkung: null,
          betrag: null,
          einheit: '',
        }
  const [form, setForm] = useState<FreiEntry>(initial)
  useEffect(() => setForm(initial), [target])

  const canSave = form.bezeichnung.trim().length > 0
  const submit = () => {
    if (!canSave) return
    onSave({ ...form, bezeichnung: form.bezeichnung.trim() }, isEdit ? 'edit' : 'add')
    onClose()
  }

  return (
    <div className="space-y-3 text-sm">
      <Row label="Bezeichnung">
        <input
          autoFocus
          value={form.bezeichnung}
          onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none"
        />
      </Row>
      <Row label="Anmerkung">
        <textarea
          rows={3}
          value={form.anmerkung ?? ''}
          onChange={(e) => setForm({ ...form, anmerkung: e.target.value || null })}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
        />
      </Row>
      <Row label="Betrag [EUR]">
        <input
          type="number"
          step="0.01"
          value={form.betrag ?? ''}
          onChange={(e) =>
            setForm({
              ...form,
              betrag: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm outline-none"
        />
      </Row>
      <Row label="Einheit">
        <input
          value={form.einheit ?? ''}
          onChange={(e) => setForm({ ...form, einheit: e.target.value || null })}
          className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm outline-none"
          placeholder="z.B. m²"
        />
      </Row>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        {isEdit ? (
          <div className="flex items-center gap-2">
            {target.isAdded ? (
              <Button variant="ghost" onClick={() => { onDelete(); onClose() }}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                Löschen
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => { onHide(); onClose() }}>
                Ausblenden
              </Button>
            )}
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={submit} disabled={!canSave}>Speichern</Button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-[160px_1fr] items-start gap-3')}>
      <div className="pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
