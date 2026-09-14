import { decryptAes256, encryptAes256 } from './aes-encryption'

describe('AES-256 encryption', () => {
  it('round-trips data encrypted with the same secret', () => {
    const { iv, data } = encryptAes256('hello world', 'my-secret')
    expect(decryptAes256(data, iv, 'my-secret')).toBe('hello world')
  })

  it('produces a different iv (and ciphertext) on each call', () => {
    const first = encryptAes256('hello world', 'my-secret')
    const second = encryptAes256('hello world', 'my-secret')
    expect(first.iv).not.toBe(second.iv)
    expect(first.data).not.toBe(second.data)
  })

  it('fails to decrypt with the wrong secret', () => {
    const { iv, data } = encryptAes256('hello world', 'my-secret')
    expect(() => decryptAes256(data, iv, 'wrong-secret')).toThrow()
  })
})
