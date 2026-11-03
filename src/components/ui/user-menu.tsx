import { useEffect, useRef, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronRight, Crop, Image, ImagePlus, LogOut, Moon, Replace, Sun, Trash2, UserCog } from 'lucide-react'
import { clearToken } from '@/api'
import { LogoMark } from '@/components/Logo'
import { useLogo } from '@/logo-store'
import { useAccess, isAdmin } from '@/access-store'
import { LogoEditor } from '@/components/ui/logo-editor'
import { cn } from '@/lib/utils'

const MAX_BYTES = 500 * 1024

const KEY = 'eo:theme'
type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const stored = localStorage.getItem(KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const dataUrl = useLogo((s) => s.dataUrl)
  const uploadLogo = useLogo((s) => s.upload)
  const removeLogo = useLogo((s) => s.remove)
  const logoStatus = useLogo((s) => s.status)
  const currentRole = useAccess((s) => s.currentRole)
  const signOut = useAccess((s) => s.signOut)
  const admin = isAdmin(currentRole)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSrc, setEditorSrc] = useState<string | null>(null)

  const switchRole = () => signOut()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  const logout = () => {
    clearToken()
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
      <DropdownMenu.Root>
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
            {currentRole && (
              <div className="px-2 py-1.5">
                <div className="truncate text-sm font-medium">{currentRole.name}</div>
                {admin && (
                  <div className="truncate text-[11px] text-muted-foreground">Admin</div>
                )}
              </div>
            )}
            <DropdownMenu.Item
              onSelect={switchRole}
              className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
            >
              <UserCog className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Rolle wechseln</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
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
