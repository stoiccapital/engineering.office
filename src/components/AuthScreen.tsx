import { useEffect, useRef, useState } from 'react'
import { useAccess } from '@/access-store'
import { ApiError, auth, type SessionUser } from '@/api'

type Mode =
  | 'login'
  | 'register'
  | 'registered'
  | 'unverified'
  | 'forgot'
  | 'forgot-sent'
  | 'reset'
  | 'verify'
  | 'legacy'
  | 'claim'

const inputCls =
  'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring'
const labelCls = 'text-[11px] font-medium uppercase tracking-wider text-muted-foreground'
const primaryBtn =
  'w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50'
const linkBtn = 'text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline'

function messageOf(e: unknown): string {
  if (e instanceof ApiError) return e.message
  return 'Verbindung fehlgeschlagen. Bitte erneut versuchen.'
}

// Reads ?verify=… / ?reset=… from the emailed links once, then cleans the URL.
function takeUrlToken(): { kind: 'verify' | 'reset'; token: string } | null {
  const params = new URLSearchParams(window.location.search)
  const verify = params.get('verify')
  const reset = params.get('reset')
  if (!verify && !reset) return null
  params.delete('verify')
  params.delete('reset')
  const qs = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
  return verify ? { kind: 'verify', token: verify } : { kind: 'reset', token: reset! }
}

export function AuthScreen() {
  const setSession = useAccess((s) => s.setSession)
  const [urlToken] = useState(takeUrlToken)
  const [mode, setMode] = useState<Mode>(urlToken?.kind ?? 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [kuerzel, setKuerzel] = useState('')
  const [claimToken, setClaimToken] = useState('')
  const [claimWho, setClaimWho] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const verifyStarted = useRef(false)

  function go(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
    setPassword('')
    setPassword2('')
  }

  async function run(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }

  async function signedIn(user: SessionUser) {
    await setSession(user)
  }

  useEffect(() => {
    if (urlToken?.kind !== 'verify' || verifyStarted.current) return
    verifyStarted.current = true
    void run(async () => {
      const { user } = await auth.verifyEmail(urlToken.token)
      await signedIn(user)
    })
  }, [])

  const login = () =>
    run(async () => {
      try {
        const { user } = await auth.login(email, password)
        await signedIn(user)
      } catch (e) {
        if (e instanceof ApiError && e.code === 'email_unverified') {
          setMode('unverified')
          return
        }
        throw e
      }
    })

  const register = () =>
    run(async () => {
      if (password !== password2) throw new ApiError(400, 'mismatch', 'Passwörter stimmen nicht überein')
      const res = await auth.register(email, password, displayName)
      go(res.verificationRequired ? 'registered' : 'login')
      if (!res.verificationRequired) setInfo('Konto angelegt. Du kannst dich jetzt anmelden.')
    })

  const resend = () =>
    run(async () => {
      await auth.resendVerification(email)
      setInfo('Wir haben dir einen neuen Bestätigungslink geschickt.')
    })

  const forgot = () =>
    run(async () => {
      await auth.forgotPassword(email)
      go('forgot-sent')
    })

  const reset = () =>
    run(async () => {
      if (password !== password2) throw new ApiError(400, 'mismatch', 'Passwörter stimmen nicht überein')
      const { user } = await auth.resetPassword(urlToken?.token ?? '', password)
      await signedIn(user)
    })

  const legacy = () =>
    run(async () => {
      const res = await auth.legacyLogin(kuerzel, password)
      setClaimToken(res.claimToken)
      setClaimWho(res.kuerzel ? `${res.kuerzel}${res.displayName ? ` · ${res.displayName}` : ''}` : (res.roleName ?? ''))
      setDisplayName(res.displayName)
      go('claim')
    })

  const claim = () =>
    run(async () => {
      if (password !== password2) throw new ApiError(400, 'mismatch', 'Passwörter stimmen nicht überein')
      const { user } = await auth.claim(claimToken, email, password, displayName)
      await signedIn(user)
    })

  const titles: Record<Mode, [string, string]> = {
    login: ['Anmelden', 'Mit E-Mail anmelden'],
    register: ['Registrieren', 'Konto anlegen'],
    registered: ['Registrieren', 'Bitte E-Mail bestätigen'],
    unverified: ['Anmelden', 'E-Mail noch nicht bestätigt'],
    forgot: ['Passwort vergessen', 'Link anfordern'],
    'forgot-sent': ['Passwort vergessen', 'E-Mail unterwegs'],
    reset: ['Passwort zurücksetzen', 'Neues Passwort festlegen'],
    verify: ['E-Mail bestätigen', busy ? 'Prüfe Link…' : error ? 'Link ungültig' : 'Bestätigt'],
    legacy: ['Bisheriger Zugang', 'Mit Kürzel anmelden'],
    claim: ['Konto umstellen', 'E-Mail-Konto einrichten'],
  }
  const [kicker, title] = titles[mode]

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { type?: string; placeholder?: string; autoFocus?: boolean; onEnter?: () => void; autoComplete?: string } = {},
  ) => (
    <div className="space-y-1.5">
      <label className={labelCls}>{label}</label>
      <input
        type={opts.type ?? 'text'}
        value={value}
        autoFocus={opts.autoFocus}
        autoComplete={opts.autoComplete}
        placeholder={opts.placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => e.key === 'Enter' && opts.onEnter?.()}
        className={inputCls}
      />
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{kicker}</div>
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>

        {info && <div className="rounded-md border bg-accent/40 px-3 py-2 text-xs">{info}</div>}

        {mode === 'login' && (
          <>
            {field('E-Mail', email, setEmail, { type: 'email', autoFocus: true, autoComplete: 'email', placeholder: 'name@firma.de' })}
            {field('Passwort', password, setPassword, { type: 'password', autoComplete: 'current-password', placeholder: '•••••••••', onEnter: login })}
            {error && <div className="text-xs text-destructive">{error}</div>}
            <button onClick={login} disabled={!email || !password || busy} className={primaryBtn}>
              {busy ? 'Prüfe…' : 'Anmelden'}
            </button>
            <div className="flex items-center justify-between">
              <button className={linkBtn} onClick={() => go('register')}>Konto anlegen</button>
              <button className={linkBtn} onClick={() => go('forgot')}>Passwort vergessen?</button>
            </div>
            <div className="border-t pt-3 text-center">
              <button className={linkBtn} onClick={() => go('legacy')}>
                Bisher mit Kürzel angemeldet? Konto umstellen
              </button>
            </div>
          </>
        )}

        {mode === 'register' && (
          <>
            {field('Name', displayName, setDisplayName, { autoFocus: true, autoComplete: 'name', placeholder: 'Vorname Nachname' })}
            {field('E-Mail', email, setEmail, { type: 'email', autoComplete: 'email', placeholder: 'name@firma.de' })}
            {field('Passwort', password, setPassword, { type: 'password', autoComplete: 'new-password', placeholder: 'mindestens 8 Zeichen' })}
            {field('Passwort wiederholen', password2, setPassword2, { type: 'password', autoComplete: 'new-password', onEnter: register })}
            {error && <div className="text-xs text-destructive">{error}</div>}
            <button onClick={register} disabled={!email || !password || !password2 || busy} className={primaryBtn}>
              {busy ? 'Lege an…' : 'Konto anlegen'}
            </button>
            <p className="text-xs text-muted-foreground">
              Nach der Bestätigung deiner E-Mail-Adresse schaltet ein Administrator die passenden Module für dich frei.
            </p>
            <button className={linkBtn} onClick={() => go('login')}>Zurück zur Anmeldung</button>
          </>
        )}

        {mode === 'registered' && (
          <>
            <p className="text-sm">
              Wir haben einen Bestätigungslink an <strong className="font-medium">{email}</strong> geschickt. Bitte
              öffne ihn, um dein Konto zu aktivieren.
            </p>
            {error && <div className="text-xs text-destructive">{error}</div>}
            <div className="flex items-center justify-between">
              <button className={linkBtn} onClick={resend} disabled={busy}>Link erneut senden</button>
              <button className={linkBtn} onClick={() => go('login')}>Zur Anmeldung</button>
            </div>
          </>
        )}

        {mode === 'unverified' && (
          <>
            <p className="text-sm">
              Bitte bestätige zuerst deine E-Mail-Adresse <strong className="font-medium">{email}</strong> über den
              Link, den wir dir geschickt haben.
            </p>
            {error && <div className="text-xs text-destructive">{error}</div>}
            <button onClick={resend} disabled={busy} className={primaryBtn}>
              {busy ? 'Sende…' : 'Bestätigungslink erneut senden'}
            </button>
            <button className={linkBtn} onClick={() => go('login')}>Zurück zur Anmeldung</button>
          </>
        )}

        {mode === 'forgot' && (
          <>
            {field('E-Mail', email, setEmail, { type: 'email', autoFocus: true, autoComplete: 'email', onEnter: forgot })}
            {error && <div className="text-xs text-destructive">{error}</div>}
            <button onClick={forgot} disabled={!email || busy} className={primaryBtn}>
              {busy ? 'Sende…' : 'Link zum Zurücksetzen senden'}
            </button>
            <button className={linkBtn} onClick={() => go('login')}>Zurück zur Anmeldung</button>
          </>
        )}

        {mode === 'forgot-sent' && (
          <>
            <p className="text-sm">
              Falls ein Konto für <strong className="font-medium">{email}</strong> existiert, haben wir einen Link zum
              Zurücksetzen geschickt. Er ist 60 Minuten gültig.
            </p>
            <button className={linkBtn} onClick={() => go('login')}>Zurück zur Anmeldung</button>
          </>
        )}

        {mode === 'reset' && (
          <>
            {field('Neues Passwort', password, setPassword, { type: 'password', autoFocus: true, autoComplete: 'new-password', placeholder: 'mindestens 8 Zeichen' })}
            {field('Passwort wiederholen', password2, setPassword2, { type: 'password', autoComplete: 'new-password', onEnter: reset })}
            {error && <div className="text-xs text-destructive">{error}</div>}
            <button onClick={reset} disabled={!password || !password2 || busy} className={primaryBtn}>
              {busy ? 'Speichere…' : 'Passwort speichern'}
            </button>
            <button className={linkBtn} onClick={() => go('forgot')}>Neuen Link anfordern</button>
          </>
        )}

        {mode === 'verify' && (
          <>
            {busy && <p className="text-sm text-muted-foreground">Einen Moment…</p>}
            {error && (
              <>
                <div className="text-xs text-destructive">{error}</div>
                <button className={linkBtn} onClick={() => go('login')}>Zur Anmeldung</button>
              </>
            )}
          </>
        )}

        {mode === 'legacy' && (
          <>
            <p className="text-xs text-muted-foreground">
              Melde dich einmalig mit deinem bisherigen Kürzel und Passwort an. Danach richtest du dein E-Mail-Konto
              ein — deine Rolle und Zuordnung bleiben erhalten.
            </p>
            {field('Kürzel', kuerzel, setKuerzel, { autoFocus: true, autoComplete: 'username', placeholder: 'MuA' })}
            {field('Bisheriges Passwort', password, setPassword, { type: 'password', autoComplete: 'current-password', onEnter: legacy })}
            {error && <div className="text-xs text-destructive">{error}</div>}
            <button onClick={legacy} disabled={!kuerzel || !password || busy} className={primaryBtn}>
              {busy ? 'Prüfe…' : 'Weiter'}
            </button>
            <button className={linkBtn} onClick={() => go('login')}>Zurück zur Anmeldung</button>
          </>
        )}

        {mode === 'claim' && (
          <>
            <p className="text-xs text-muted-foreground">
              Bisheriger Zugang: <strong className="font-medium text-foreground">{claimWho}</strong>. Künftig meldest
              du dich mit E-Mail und neuem Passwort an.
            </p>
            {field('Name', displayName, setDisplayName, { autoComplete: 'name' })}
            {field('E-Mail', email, setEmail, { type: 'email', autoFocus: true, autoComplete: 'email', placeholder: 'name@firma.de' })}
            {field('Neues Passwort', password, setPassword, { type: 'password', autoComplete: 'new-password', placeholder: 'mindestens 8 Zeichen' })}
            {field('Passwort wiederholen', password2, setPassword2, { type: 'password', autoComplete: 'new-password', onEnter: claim })}
            {error && <div className="text-xs text-destructive">{error}</div>}
            <button onClick={claim} disabled={!email || !password || !password2 || busy} className={primaryBtn}>
              {busy ? 'Richte ein…' : 'Konto einrichten'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// Signed in, email confirmed, but no role yet.
export function AwaitingApproval() {
  const user = useAccess((s) => s.awaitingRole)
  const signOut = useAccess((s) => s.signOut)
  const load = useAccess((s) => s.load)
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Angemeldet als {user?.email}</div>
          <h1 className="text-lg font-semibold">Warte auf Freigabe</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Dein Konto ist eingerichtet. Ein Administrator muss dir noch eine Rolle zuweisen (Einstellungen → Rollen →
          Konten), bevor du Module sehen kannst.
        </p>
        <button onClick={() => void load()} className={primaryBtn}>
          Erneut prüfen
        </button>
        <button className={linkBtn} onClick={() => void signOut()}>
          Abmelden
        </button>
      </div>
    </div>
  )
}
