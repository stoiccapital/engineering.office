import { useEffect, useRef } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useLogo } from '@/logo-store'

const MAX_BYTES = 500 * 1024

export function Logo() {
  const dataUrl = useLogo((s) => s.dataUrl)
  const status = useLogo((s) => s.status)
  const error = useLogo((s) => s.error)
  const load = useLogo((s) => s.load)
  const upload = useLogo((s) => s.upload)
  const remove = useLogo((s) => s.remove)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'idle') void load()
  }, [status, load])

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('Nur Bilddateien (PNG, JPG, SVG) sind erlaubt.')
      return
    }
    if (file.size > MAX_BYTES) {
      alert(`Datei zu groß — max. ${Math.round(MAX_BYTES / 1024)} KB.`)
      return
    }
    const url = await readDataUrl(file)
    await upload(url)
  }

  return (
    <div className="space-y-2">
      {dataUrl ? (
        <div className="group relative overflow-hidden rounded-md border bg-background">
          <img
            src={dataUrl}
            alt="Logo"
            className="h-20 w-full object-contain p-2"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={status === 'uploading'}
              className="rounded-md border bg-card px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
              title="Logo ersetzen"
            >
              Ersetzen
            </button>
            <button
              onClick={() => remove()}
              disabled={status === 'uploading'}
              className="rounded-md border bg-card p-1 text-destructive hover:bg-accent disabled:opacity-50"
              title="Logo entfernen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={status === 'uploading' || status === 'loading'}
          className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-accent/50 disabled:opacity-50"
        >
          <ImagePlus className="h-5 w-5" />
          {status === 'uploading' ? 'Lädt hoch…' : 'Logo hochladen'}
        </button>
      )}
      {error && <div className="text-[11px] text-destructive">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsDataURL(file)
  })
}
