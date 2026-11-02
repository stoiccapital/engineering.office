import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONTAINER_PX = 240
const OUTPUT_PX = 512
const MIN_ZOOM = 0.3
const MAX_ZOOM = 10

type Props = {
  src: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (croppedDataUrl: string) => void
  busy?: boolean
}

export function LogoEditor({ src, open, onOpenChange, onSave, busy }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  useEffect(() => {
    if (open) {
      setZoom(1)
      setTx(0)
      setTy(0)
    }
  }, [open, src])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!src) return
    setDragging(true)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragStart.current = { x: e.clientX, y: e.clientY, tx, ty }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setTx(dragStart.current.tx + dx)
    setTy(dragStart.current.ty + dy)
  }
  const onPointerUp = () => {
    setDragging(false)
    dragStart.current = null
  }

  const reset = () => {
    setZoom(1)
    setTx(0)
    setTy(0)
  }

  const save = async () => {
    if (!src) return
    const img = imgRef.current
    if (!img) return

    // Compute the same object-contain fit the preview uses.
    const fit = Math.min(CONTAINER_PX / img.naturalWidth, CONTAINER_PX / img.naturalHeight)
    const effectiveScale = fit * zoom
    const scaleToOutput = OUTPUT_PX / CONTAINER_PX

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_PX
    canvas.height = OUTPUT_PX
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'

    ctx.save()
    ctx.translate(OUTPUT_PX / 2 + tx * scaleToOutput, OUTPUT_PX / 2 + ty * scaleToOutput)
    ctx.scale(effectiveScale * scaleToOutput, effectiveScale * scaleToOutput)
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
    ctx.restore()

    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-5 shadow-xl focus:outline-none">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <Dialog.Title className="text-base font-semibold">Logo anpassen</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                Ziehen zum Verschieben · Scrollen oder Slider zum Zoomen
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={(e) => {
                e.preventDefault()
                const delta = -e.deltaY * 0.002
                setZoom((z) => clamp(z + delta * z, MIN_ZOOM, MAX_ZOOM))
              }}
              className={cn(
                'relative overflow-hidden rounded-md border bg-muted',
                dragging ? 'cursor-grabbing' : 'cursor-grab',
              )}
              style={{ width: CONTAINER_PX, height: CONTAINER_PX, touchAction: 'none' }}
            >
              {src && (
                <img
                  ref={imgRef}
                  src={src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-h-full max-w-full select-none"
                  style={{
                    transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${zoom})`,
                    transformOrigin: 'center',
                  }}
                />
              )}
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/5" />
            </div>

            <div className="flex w-full items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z / 1.15, MIN_ZOOM, MAX_ZOOM))}
                className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Zoom raus"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-foreground"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(z * 1.15, MIN_ZOOM, MAX_ZOOM))}
                className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Zoom rein"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Zurücksetzen"
                title="Zurücksetzen"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Abbrechen
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={!src || busy}
              onClick={save}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Lädt hoch…' : 'Übernehmen'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}
