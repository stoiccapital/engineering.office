# Principles

A child or a 70-year-old should be able to use this software. Every design and
engineering decision ladders to that bar. If a rule in this doc conflicts with
that bar, the bar wins.

**Efficiency = the fewest clicks and the fewest decisions between landing on
the app and having done the thing you came to do.**

This doc is the north star for product and engineering choices. `design.md`
covers visual grammar; this covers behavior.

## The six

### 1. One source of truth per entity

A project, an employee, an address, an invoice — each exists **once** in the
system. Everything else is a view on that one record.

Today a "project" exists three times (`Projektliste`, `Forecast`, `Rechnungen`)
with no link. Changing the name in one doesn't update the others. Any new
feature that creates a parallel copy of an existing entity is a bug in design,
not a feature.

**How to apply:** Before adding a field to a store, check if the entity already
exists elsewhere. If it does, link to it (`projectId`), never duplicate it.

### 2. Infer everything inferrable

The computer knows the current date, the current user, the current team, this
quarter, the Projektleiter of the project you're touching. **It should never
ask.**

Every input the user doesn't fill is a click saved and an error avoided. If a
field has a 90% correct default, pre-fill it; let the user override.

**How to apply:** For every form field, ask "could the system have known this?"
If yes, default it. Don't add a required field without proving it can't be
derived.

### 3. Inline over modal

Modals are for consequences (delete, approve-over-threshold, destructive
GoBD lock). **Creation is always inline**, in the context where it belongs.

`+ Aufgabe` in Quartalsplanung works because it drops you into the textarea.
A modal flow would break that. Follow the same pattern elsewhere: inline
composer, not modal form.

**How to apply:** If you catch yourself writing `<Dialog.Root>` for "new X",
stop. Build an inline composer instead.

### 4. Undo beats confirm

Never ask "Are you sure?" for anything reversible. Autosave + a 5-second
toast with `Rückgängig` beats a confirmation dialog every time. Most users
click through confirmations without reading.

Confirmations only for: destructive and irreversible (hard delete of a
Mandant, GoBD seal, Jahresabschluss lock, mass data import that overwrites).

**How to apply:** For every existing `AlertDialog` or "Sicher?"-style step,
check if the operation is reversible. If yes, swap for undo.

### 5. Verbs, not navigation

`⌘K` should contain the verbs people actually say: "Rechnung erstellen",
"Abwesenheit beantragen", "Projekt anlegen", "Mitarbeiter einstellen". Not
just destinations. A verb is one keystroke; the equivalent navigation is
three or four clicks.

**How to apply:** For every action that appears in more than one place in
the UI, add it to `⌘K` as a verb. Gate by role so people don't see what
they can't do.

### 6. Role-based landing

A PM lands on their projects. A Mitarbeiter lands on this week's tasks and
vacation balance. Geschäftsführung lands on money + Zielkontrolle. Today
everyone sees the same sidebar and has to find their thing.

**How to apply:** `/` should resolve based on role, not to a hardcoded
Dashboard. Each role has one primary view that answers "what should I do
right now?"

## Checklist when adding a feature

Before you merge, your change answers **yes** to all of these:

- [ ] Does any existing entity already model this? If yes, extend it.
- [ ] Is every required field one the system can't infer?
- [ ] Is creation inline (textarea, row insert, chip), not modal?
- [ ] Does destructive action use undo, or is it truly irreversible?
- [ ] Is the primary action one keystroke away via `⌘K`?
- [ ] Would a 70-year-old PM find this on their landing screen?
- [ ] Autosaves? Lifecycle flush? Status indicator honest (not a lie)?
- [ ] German, imperative, lead with the fact?

If you answered no to any, stop and fix before merging.

## Anti-patterns we have and want to kill

- **Parallel "project" records in three stores.** → Collapse to one; link via `projectId`.
- **Status filter reimplemented three times on three pages.** → One `<StatusFilter>` primitive.
- **"Are you sure?" dialogs for reversible actions.** → Autosave + undo toast.
- **`⌘K` as navigation-only.** → Verb-first with role gating.
- **Dashboard that shows everything to everyone.** → Role-based home.
- **Modal for every "+ New X".** → Inline composer where the context lives.
- **Required fields the system could have inferred.** → Default and let the user override.

## Engineering rules (not visual, but non-negotiable)

- **Never return a fresh object, array, or array-method result from a Zustand
  selector.** `useStore(s => ({ status, error }))` or `useStore(s => s.rows.filter(...))`
  creates a new reference on every call. Zustand compares with `Object.is` and
  will infinite-render. Return primitives from each selector, or pull the
  raw slice and `useMemo` the derivation in the consumer.
- **Autosave status must be honest.** `"Gespeichert"` only when nothing is
  scheduled, nothing is in flight, and the last save succeeded. If a
  keystroke happened mid-save, the indicator should stay at `"Speichert …"`
  until the follow-up save confirms.
- **Lifecycle flush on every autosave store.** `beforeunload`, `pagehide`,
  `visibilitychange=hidden`. See `src/lib/autosave.ts`. New stores wire
  through `createAutosave`; no hand-rolled `setTimeout` debounces.

## When to break the rules

The rules are breakable **if** the break is cheaper for the user than
following the rule.

Examples where breaking is correct:

- **Confirm a GoBD-relevant lock.** Not reversible by design. Confirmation
  with explicit text is right.
- **Modal for an Angebot preview.** The user needs focus to read a document;
  inline inside a table row would be worse.
- **Non-default field on a Honorar calculation.** Legally, some parameters
  (Umbauzuschlag, Zone) have no sensible default. Ask explicitly.

If you break a rule, add a one-line comment pointing at this doc and saying
why. Rules without visible exceptions become superstitions over time; visible
exceptions keep the rules honest.

## Related

- `design.md` — visual grammar (palette, type, spacing, radii, chips)
- `docs/audits/` — per-review snapshots of where we are vs these rules
