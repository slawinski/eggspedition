import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'

// Minimal CBOR writer for the none-attestation fixture and its ES256 COSE key.
function cbor(value: number | string | Buffer | Map<unknown, unknown>): Buffer {
  function length(major: number, n: number) {
    return n < 24 ? Buffer.from([major * 32 + n]) : n < 256 ? Buffer.from([major * 32 + 24, n]) : Buffer.from([major * 32 + 25, n >> 8, n & 255])
  }
  if (typeof value === 'number') return value >= 0 ? length(0, value) : length(1, -1 - value)
  if (typeof value === 'string') { const bytes = Buffer.from(value); return Buffer.concat([length(3, bytes.length), bytes]) }
  if (Buffer.isBuffer(value)) return Buffer.concat([length(2, value.length), value])
  return Buffer.concat([length(5, value.size), ...Array.from(value).flatMap(([k, v]) => [cbor(k as Parameters<typeof cbor>[0]), cbor(v as Parameters<typeof cbor>[0])])])
}

/** Fresh disposable keypair: no canned verification results, no live credentials. */
export function webauthnFixture() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = publicKey.export({ format: 'jwk' })
  const id = randomBytes(32)
  const encodedId = id.toString('base64url')
  const coseKey = cbor(new Map<number, number | Buffer>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, 'base64url')], [-3, Buffer.from(jwk.y!, 'base64url')]]))
  function authData(rpID: string, flags: number, counter: number) {
    const count = Buffer.alloc(4); count.writeUInt32BE(counter)
    return Buffer.concat([createHash('sha256').update(rpID).digest(), Buffer.from([flags]), count])
  }
  function client(type: string, challenge: string, origin: string) { return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false })) }
  return {
    id: encodedId, publicKey: coseKey.toString('base64url'),
    registration(challenge: string, origin: string, rpID: string, flags = 0x5d): RegistrationResponseJSON {
      const size = Buffer.alloc(2); size.writeUInt16BE(id.length)
      const data = Buffer.concat([authData(rpID, flags, 0), Buffer.alloc(16), size, id, coseKey])
      const attestation = cbor(new Map<string, string | Buffer | Map<unknown, unknown>>([['fmt', 'none'], ['attStmt', new Map()], ['authData', data]]))
      return { id: encodedId, rawId: encodedId, type: 'public-key', clientExtensionResults: { credProps: { rk: true } },
        response: { clientDataJSON: client('webauthn.create', challenge, origin).toString('base64url'), attestationObject: attestation.toString('base64url'), transports: ['internal'] } }
    },
    assertion(challenge: string, origin: string, rpID: string, userId: string, counter = 0, flags = 0x1d): AuthenticationResponseJSON {
      const data = authData(rpID, flags, counter)
      const json = client('webauthn.get', challenge, origin)
      const signature = sign('sha256', Buffer.concat([data, createHash('sha256').update(json).digest()]), privateKey)
      return { id: encodedId, rawId: encodedId, type: 'public-key', clientExtensionResults: {}, response: {
        authenticatorData: data.toString('base64url'), clientDataJSON: json.toString('base64url'), signature: signature.toString('base64url'), userHandle: Buffer.from(userId).toString('base64url'),
      } }
    },
  }
}
