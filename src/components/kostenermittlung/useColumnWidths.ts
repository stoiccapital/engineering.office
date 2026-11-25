import { useCallback, useEffect, useRef, useState } from 'react'

// Per-user, per-table column-width persistence. Keyed by tableId so different
// tables can coexist in localStorage. Widths are in px.
export type ColumnWidths = Record<string, number>

function storageKey(tableId: string): string {
  return `eo:colwidths:${tableId}`
}

function readStored(tableId: string): ColumnWidths {
  try {
    const raw = localStorage.getItem(storageKey(tableId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: ColumnWidths = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
      }
      return out
    }
    return {}
  } catch {
    return {}
  }
}

// Minimum column width in px — smaller and the cell content becomes unusable
// and the resize handle is hard to grab back.
const MIN_WIDTH = 40

export function useColumnWidths(tableId: string, defaults: ColumnWidths) {
  const [widths, setWidths] = useState<ColumnWidths>(() => ({
    ...defaults,
    ...readStored(tableId),
  }))

  // Persist whenever widths change — but only user overrides, not the defaults
  // merged on top. We detect overrides by diffing against defaults.
  useEffect(() => {
    const overrides: ColumnWidths = {}
    for (const k of Object.keys(widths)) {
      if (widths[k] !== defaults[k]) overrides[k] = widths[k]
    }
    try {
      if (Object.keys(overrides).length === 0) {
        localStorage.removeItem(storageKey(tableId))
      } else {
        localStorage.setItem(storageKey(tableId), JSON.stringify(overrides))
      }
    } catch {
      // Storage quota / private mode — just skip persisting.
    }
  }, [widths, defaults, tableId])

  const getWidth = useCallback(
    (colId: string): number => widths[colId] ?? defaults[colId] ?? 120,
    [widths, defaults],
  )

  const setWidth = useCallback((colId: string, px: number) => {
    setWidths((prev) => ({
      ...prev,
      [colId]: Math.max(MIN_WIDTH, Math.round(px)),
    }))
  }, [])

  const resetWidth = useCallback((colId: string) => {
    setWidths((prev) => {
      const next = { ...prev }
      delete next[colId]
      return next
    })
  }, [])

  return { getWidth, setWidth, resetWidth }
}

// Draggable handle wired to `useColumnWidths`. Call this inside a <th>. It
// positions itself on the right edge and tracks mouse to resize.
export function useColumnResize(
  colId: string,
  getWidth: (id: string) => number,
  setWidth: (id: string, px: number) => void,
) {
  const startX = useRef(0)
  const startW = useRef(0)
  const dragging = useRef(false)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      startX.current = e.clientX
      startW.current = getWidth(colId)
      dragging.current = true

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current) return
        const dx = ev.clientX - startX.current
        setWidth(colId, startW.current + dx)
      }
      const onUp = () => {
        dragging.current = false
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [colId, getWidth, setWidth],
  )

  return { onPointerDown }
}
