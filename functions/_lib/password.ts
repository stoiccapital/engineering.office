// Password hashing + verification for the Pages Functions auth layer.
//
// We can't ship bcrypt/argon2 natively on Workers, so we use PBKDF2-SHA-256
// from the Web Crypto API that's built into the runtime. 210k iterations
// matches OWASP's 2024 recommendation for PBKDF2-SHA256.
//
// Encoded hash format: `$pbkdf2-sha256$<iterations>$<base64-salt>$<base64-hash>`
// Self-upgrading: existing plaintext passwords in KV still verify (bytewise
// equality) but the caller receives an upgrade hash to re-store. Over time
// plaintext disappears from the store.

const SCHEME = 'pbkdf2-sha256'
const ITERATIONS = 210_000
const SALT_BYTES = 16
const HASH_BYTES = 32

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const raw = atob(s)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function pbkdf2(password: string, salt: Uint8Array, iters: number): Promise<Uint8Array> {
  const enc = new TextEncoder().encode(password)
  const key = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
    key,
    HASH_BYTES * 8,
  )
  return new Uint8Array(bits)
}

export function isHashed(stored: string | undefined | null): boolean {
  return typeof stored === 'string' && stored.startsWith(`$${SCHEME}$`)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(salt)
  const hash = await pbkdf2(password, salt, ITERATIONS)
  return `$${SCHEME}$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`
}

// Constant-time equality for two same-length byte arrays. Falls back to
// unequal on a length mismatch (no early exit).
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Constant-time string equality — used for the legacy plaintext path so we
// still don't leak timing info while that path exists.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const av = enc.encode(a)
  const bv = enc.encode(b)
  // Pad shorter one so the comparison length doesn't leak.
  const n = Math.max(av.length, bv.length)
  const ap = new Uint8Array(n)
  const bp = new Uint8Array(n)
  ap.set(av)
  bp.set(bv)
  const equal = timingSafeEqual(ap, bp)
  return equal && av.length === bv.length
}

export type VerifyResult =
  | { ok: false }
  | { ok: true; upgradeTo?: string } // upgradeTo set when a stored plaintext
  // password just verified and the caller should re-persist the new hash.

export async function verifyPassword(stored: string, provided: string): Promise<VerifyResult> {
  if (isHashed(stored)) {
    const parts = stored.split('$')
    // ["", "pbkdf2-sha256", iters, salt, hash]
    if (parts.length !== 5) return { ok: false }
    const iters = Number(parts[2])
    if (!Number.isFinite(iters) || iters < 1000) return { ok: false }
    const salt = fromB64(parts[3])
    const expected = fromB64(parts[4])
    try {
      const got = await pbkdf2(provided, salt, iters)
      return timingSafeEqual(got, expected) ? { ok: true } : { ok: false }
    } catch {
      return { ok: false }
    }
  }
  // Legacy plaintext path. Verify in constant time, then signal that the
  // caller should upgrade the stored copy on this successful login.
  if (timingSafeStringEqual(stored, provided)) {
    const upgradeTo = await hashPassword(provided)
    return { ok: true, upgradeTo }
  }
  return { ok: false }
}
