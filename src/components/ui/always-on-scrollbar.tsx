import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Custom horizontal scrollbar that's always visible — unlike native macOS
// scrollbars which auto-hide on trackpads regardless of CSS. Rendered as a
// DOM strip the user can drag or click to scroll a target element.
export function AlwaysOnScrollbar({
  targetRef,
  className,
}: {
  targetRef: React.RefObject<HTMLElement | null>
  className?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState({
    widthPct: 100, // thumb width as % of track
    leftPct: 0, // thumb offset as % of track
    hasOverflow: false,
  })

  useLayoutEffect(() => {
    const el = targetRef.current
    if (!el) return

    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el
      if (scrollWidth <= clientWidth + 1) {
        setState({ widthPct: 100, leftPct: 0, hasOverflow: false })
        return
      }
      const widthPct = (clientWidth / scrollWidth) * 100
      const maxScrollLeft = scrollWidth - clientWidth
      const leftPct = maxScrollLeft > 0
        ? (scrollLeft / maxScrollLeft) * (100 - widthPct)
        : 0
      setState({ widthPct, leftPct, hasOverflow: true })
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // Also observe the first child (typically the table) because its intrinsic
    // width can change when rows/columns are added without the container
    // itself resizing.
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [targetRef])

  const onThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    const startX = e.clientX
    const startScrollLeft = el.scrollLeft
    const trackWidth = track.clientWidth
    const thumbPxWidth = (state.widthPct / 100) * trackWidth
    const travel = trackWidth - thumbPxWidth
    const scrollable = el.scrollWidth - el.clientWidth
    if (travel <= 0 || scrollable <= 0) return
    const ratio = scrollable / travel

    const onMove = (ev: MouseEvent) => {
      el.scrollLeft = startScrollLeft + (ev.clientX - startX) * ratio
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const onTrackMouseDown = (e: React.MouseEvent) => {
    // Click on track = jump-scroll so the thumb centers on the click point.
    const el = targetRef.current
    const track = trackRef.current
    if (!el || !track) return
    const rect = track.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const trackWidth = rect.width
    const thumbPxWidth = (state.widthPct / 100) * trackWidth
    const newLeft = Math.max(0, Math.min(trackWidth - thumbPxWidth, clickX - thumbPxWidth / 2))
    const travel = trackWidth - thumbPxWidth
    const scrollable = el.scrollWidth - el.clientWidth
    if (travel <= 0 || scrollable <= 0) return
    el.scrollLeft = (newLeft / travel) * scrollable
  }

  return (
    <div
      ref={trackRef}
      onMouseDown={onTrackMouseDown}
      className={cn(
        'relative h-1.5 w-full cursor-pointer select-none rounded bg-foreground/5',
        !state.hasOverflow && 'opacity-50',
        className,
      )}
    >
      <div
        onMouseDown={onThumbMouseDown}
        className="absolute inset-y-0 cursor-grab rounded bg-foreground/15 transition-colors hover:bg-foreground/40 active:cursor-grabbing active:bg-foreground/60"
        style={{ width: `${state.widthPct}%`, left: `${state.leftPct}%` }}
      />
    </div>
  )
}
