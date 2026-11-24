// Node twin of server/crypto.ts hashPassword — same PBKDF2 format, so hashes
// written by the KV import verify in the Workers runtime.
import crypto from 'node:crypto'

const ITERATIONS = 100_000

export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')
  return `pbkdf2-sha256$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password, stored) {
  const [algo, iter, saltB64, hashB64] = String(stored ?? '').split('$')
  if (algo !== 'pbkdf2-sha256') return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = crypto.pbkdf2Sync(password, Buffer.from(saltB64, 'base64'), Number(iter), expected.length, 'sha256')
  return crypto.timingSafeEqual(actual, expected)
}
