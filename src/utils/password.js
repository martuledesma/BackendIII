// Hash de contraseñas con el módulo nativo crypto (scrypt), sin dependencias extra.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const KEY_LENGTH = 64

export const hashPassword = async (plain) => {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(plain, salt, KEY_LENGTH)
  return `${salt}:${derived.toString('hex')}`
}

export const verifyPassword = async (plain, stored) => {
  const [salt, key] = stored.split(':')
  const derived = await scrypt(plain, salt, KEY_LENGTH)
  return timingSafeEqual(Buffer.from(key, 'hex'), derived)
}
