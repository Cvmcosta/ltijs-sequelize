import crypto from 'node:crypto'
import type { EncryptedPayload } from './aes-encryption.types'

// Ported as-is from the current (v2) ltijs-sequelize's own `Encrypt`/`Decrypt` methods, since
// `SequelizeLegacyDatabaseManager` must keep decrypting data written by existing v2 deployments.

export function encryptAes256(data: string, secret: string): EncryptedPayload {
  const key = crypto.createHash('sha256').update(secret).digest().subarray(0, 32)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  return { iv: iv.toString('hex'), data: encrypted.toString('hex') }
}

export function decryptAes256(data: string, iv: string, secret: string): string {
  const key = crypto.createHash('sha256').update(secret).digest().subarray(0, 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()])
  return decrypted.toString()
}
