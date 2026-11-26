import { useEffect, useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Crop, Eye, Image, ImagePlus, LogOut, Moon, Replace, Sun, Trash2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { useLogo } from '@/logo-store'
import { useAccess, isAdmin } from '@/access-store'
import { LogoEditor } from '@/components/ui/logo-editor'
import { cn } from '@/lib/utils'

const MAX_BYTES = 500 * 1024

const KEY = 'eo:theme'
type Theme = 'light' | 'dark'

const ACCENT_KEY = 'eo:accent'
type Accent = 'indigo' | 'blue' | 'teal' | 'amber' | 'rose' | 'violet'
const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: 'indigo', label: 'Indigo', swatch: 'hsl(233 55% 60%)' },
  { id: 'blue',   label: 'Blau',   swatch: 'hsl(210 80% 48%)' },
  { id: 'teal',   label: 'Teal',   swatch: 'hsl(175 62% 36%)' },
  { id: 'amber',  label: 'Amber',  swatch: 'hsl(32 90% 42%)' },
  { id: 'rose',   label: 'Rose',   swatch: 'hsl(345 75% 50%)' },
  { id: 'violet', label: 'Violett',swatch: 'hsl(270 60% 55%)' },
]
const ACCENT_CLASSES: Record<Accent, string> = {
  indigo: '',
  blue: 'theme-blue',
  teal: 'theme-teal',
  amber: 'theme-amber',
  rose: 'theme-rose',
  violet: 'theme-violet',
}

function initialTheme(): Theme {
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function initialAccent(): Accent {
  const stored = localStorage.getItem(ACCENT_KEY)
  if (stored && (stored === 'indigo' || stored === 'blue' || stored === 'teal' || stored === 'amber' || stored === 'rose' || stored === 'violet')) {
    return stored
  }
  return 'indigo'
}

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [accent, setAccent] = useState<Accent>(initialAccent)
  const dataUrl = useLogo((s) => s.dataUrl)
  const uploadLogo = useLogo((s) => s.upload)
  const removeLogo = useLogo((s) => s.remove)
  const logoStatus = useLogo((s) => s.status)
  const currentRole = useAccess((s) => s.currentRole)
  const realRole = useAccess((s) => s.realRole)
  const viewAsRoleId = useAccess((s) => s.viewAsRoleId)
  const setViewAsRole = useAccess((s) => s.setViewAsRole)
  const roles = useAccess((s) => s.config.roles)
  const currentUser = useAccess((s) => s.currentUser)
  const signOut = useAccess((s) => s.signOut)
  // Admin check must be against the REAL role, not currentRole — otherwise
  // an admin viewing as a non-admin role would lose access to the submenu.
  const admin = isAdmin(realRole)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSrc, setEditorSrc] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(KEY, theme)
  }, [theme])

  function applyAccentClass(id: Accent) {
    const html = document.documentElement
    for (const key of Object.keys(ACCENT_CLASSES) as Accent[]) {
      const cls = ACCENT_CLASSES[key]
      if (cls) html.classList.remove(cls)
    }
    const next = ACCENT_CLASSES[id]
    if (next) html.classList.add(next)
  }

  useEffect(() => {
    applyAccentClass(accent)
    localStorage.setItem(ACCENT_KEY, accent)
  }, [accent])

  // Hover-preview: while the pointer sits on a swatch, the accent class
  // flips without persisting. Leaving the row (or dropdown close) reverts
  // to the committed accent.
  const [previewAccent, setPreviewAccent] = useState<Accent | null>(null)
  useEffect(() => {
    applyAccentClass(previewAccent ?? accent)
  }, [previewAccent, accent])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  const logout = async () => {
    await signOut()
    location.reload()
  }

  const openFilePicker = () => fileInputRef.current?.click()

  const openEditor = (src: string) => {
    setEditorSrc(src)
    setEditorOpen(true)
  }

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Nur Bilddateien (PNG, JPG, SVG, WEBP) sind erlaubt.')
      return
    }
    if (file.size > MAX_BYTES) {
      alert(`Datei zu groß — max. ${Math.round(MAX_BYTES / 1024)} KB.`)
      return
    }
    const url: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
      reader.readAsDataURL(file)
    })
    openEditor(url)
  }

  const handleCropSave = async (croppedDataUrl: string) => {
    await uploadLogo(croppedDataUrl)
    setEditorOpen(false)
    setEditorSrc(null)
  }

  return (
    <>
      <DropdownMenu.Root onOpenChange={(open) => { if (!open) setPreviewAccent(null) }}>
        <DropdownMenu.Trigger asChild>
          <button
            className={cn(
              'flex items-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              collapsed ? 'justify-center p-2' : 'w-full gap-2 px-2 py-2',
            )}
            title={collapsed ? 'Merkin & Völker' : undefined}
          >
            <LogoMark />
            {!collapsed && (
              <span className="truncate text-sm font-medium">Merkin &amp; Völker</span>
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 w-56 rounded-md border bg-card p-1 text-sm shadow-md focus:outline-none"
          >
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger
                className="flex cursor-default items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent data-[state=open]:bg-accent"
              >
                <Image className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Logo</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={4}
                  className="z-50 w-48 rounded-md border bg-card p-1 text-sm shadow-md focus:outline-none"
                >
                  <DropdownMenu.Item
                    onSelect={openFilePicker}
                    disabled={logoStatus === 'uploading'}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                  >
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">Hochladen</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={openFilePicker}
                    disabled={!dataUrl || logoStatus === 'uploading'}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                  >
                    <Replace className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">Ersetzen</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => dataUrl && openEditor(dataUrl)}
                    disabled={!dataUrl}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                  >
                    <Crop className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">Anpassen</span>
                  </DropdownMenu.Item>
                  {dataUrl && (
                    <>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        onSelect={() => void removeLogo()}
                        className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="flex-1">Entfernen</span>
                      </DropdownMenu.Item>
                    </>
                  )}
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            {(currentUser || currentRole) && (
              <div className="px-2 py-1.5">
                <div className="truncate text-sm font-medium">
                  {currentUser ? currentUser.displayName : currentRole?.name}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {currentUser ? currentRole?.name : admin ? 'Admin' : ''}
                  {currentUser && admin ? ' · Admin' : ''}
                </div>
                {currentUser && (
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {currentUser.kuerzel ? `${currentUser.kuerzel} · ` : ''}
                    {currentUser.email}
                  </div>
                )}
              </div>
            )}
            <DropdownMenu.Item
              onSelect={toggleTheme}
              className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex-1">{theme === 'dark' ? 'Hell' : 'Dunkel'}</span>
            </DropdownMenu.Item>
            <div
              className="flex items-center gap-1.5 px-2 py-1.5"
              onMouseLeave={() => setPreviewAccent(null)}
            >
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setAccent(a.id)
                    setPreviewAccent(null)
                  }}
                  onMouseEnter={() => setPreviewAccent(a.id)}
                  onFocus={() => setPreviewAccent(a.id)}
                  onBlur={() => setPreviewAccent(null)}
                  aria-label={`Akzent · ${a.label}`}
                  aria-pressed={accent === a.id}
                  title={a.label}
                  className={cn(
                    'h-4 w-4 rounded-full ring-offset-1 ring-offset-card transition-shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    accent === a.id && 'ring-1 ring-foreground',
                  )}
                  style={{ backgroundColor: a.swatch }}
                />
              ))}
            </div>
            {admin && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className="flex cursor-default items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent data-[state=open]:bg-accent">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">Ansicht als Rolle</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      sideOffset={4}
                      className="z-50 w-56 rounded-md border bg-card p-1 text-sm shadow-md focus:outline-none"
                    >
                      <DropdownMenu.Item
                        onSelect={() => setViewAsRole(null)}
                        className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
                      >
                        {viewAsRoleId === null ? (
                          <Check className="h-4 w-4 text-foreground" />
                        ) : (
                          <span className="h-4 w-4" />
                        )}
                        <span className="flex-1">Eigene Rolle ({realRole?.name})</span>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      {roles.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Keine Rollen konfiguriert.
                        </div>
                      ) : (
                        roles
                          .filter((r) => r.id !== realRole?.id)
                          .map((r) => (
                            <DropdownMenu.Item
                              key={r.id}
                              onSelect={() => setViewAsRole(r.id)}
                              className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
                            >
                              {viewAsRoleId === r.id ? (
                                <Check className="h-4 w-4 text-foreground" />
                              ) : (
                                <span className="h-4 w-4" />
                              )}
                              <span className="flex-1 truncate">{r.name}</span>
                            </DropdownMenu.Item>
                          ))
                      )}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              </>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              onSelect={logout}
              className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="flex-1">Abmelden</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
      <LogoEditor
        src={editorSrc}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={handleCropSave}
        busy={logoStatus === 'uploading'}
      />
    </>
  )
}
