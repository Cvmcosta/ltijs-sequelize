import {
  IdTokenValidationMethod,
  LtiMessageType,
  type IdTokenClaims,
  type Logger,
  type PlatformAttributes,
} from 'ltijs'
import { SequelizeDatabaseManager } from './sequelize-database-manager.service'

function createLogger(): Logger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

function createManager(): SequelizeDatabaseManager {
  return new SequelizeDatabaseManager(createLogger(), {
    database: 'ltijs_test',
    options: { dialect: 'sqlite', storage: ':memory:', logging: false },
  })
}

const platformAttrs: PlatformAttributes = {
  url: 'https://platform.example',
  clientId: 'client-1',
  name: 'Test Platform',
  authenticationEndpoint: 'https://platform.example/auth',
  accessTokenEndpoint: 'https://platform.example/token',
  idTokenValidation: { method: IdTokenValidationMethod.RsaKey, key: 'public-key-pem' },
  active: true,
  keys: { public: 'public-key-pem', private: 'private-key-pem' },
}

const idTokenClaims: IdTokenClaims = {
  iss: 'https://platform.example',
  sub: 'user-1',
  client_id: 'client-1',
  platform_id: 'platform-1',
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'deployment-1',
  'https://purl.imsglobal.org/spec/lti/claim/message_type': LtiMessageType.ResourceLinkRequest,
  'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
  'https://purl.imsglobal.org/spec/lti/claim/roles': ['Learner'],
}

describe('SequelizeDatabaseManager (sqlite)', () => {
  let manager: SequelizeDatabaseManager

  beforeEach(async () => {
    manager = createManager()
    await manager.listen()
  })

  afterEach(async () => {
    await manager.close()
  })

  it('saves and retrieves a platform by id, by url+clientId, and by filter', async () => {
    const id = await manager.savePlatform(platformAttrs)
    expect(id).toEqual(expect.any(String))

    const byId = await manager.getPlatformById(id)
    expect(byId).toMatchObject({ id, url: platformAttrs.url, clientId: platformAttrs.clientId, active: true })

    const byUrlAndClientId = await manager.getPlatformByUrlAndClientId(platformAttrs.url, platformAttrs.clientId)
    expect(byUrlAndClientId?.id).toBe(id)

    const filtered = await manager.getPlatforms({ clientId: [platformAttrs.clientId, 'other-client'] })
    expect(filtered).toHaveLength(1)

    const none = await manager.getPlatforms({ url: 'https://nowhere.example' })
    expect(none).toHaveLength(0)

    expect(await manager.getPlatformById('00000000-0000-0000-0000-000000000000')).toBeUndefined()
  })

  it('updates and deletes a platform', async () => {
    const id = await manager.savePlatform(platformAttrs)
    await manager.updatePlatformById(id, { name: 'Renamed', active: false })
    const updated = await manager.getPlatformById(id)
    expect(updated?.name).toBe('Renamed')
    expect(updated?.active).toBe(false)

    await manager.deletePlatformById(id)
    expect(await manager.getPlatformById(id)).toBeUndefined()
  })

  it('round-trips an access token', async () => {
    const token = { access_token: 'abc', token_type: 'Bearer', expires_in: 3600, createdAt: Date.now() }
    await manager.saveAccessToken('https://platform.example', 'client-1', 'scope-a', token)
    const fetched = await manager.getAccessToken('https://platform.example', 'client-1', 'scope-a')
    expect(fetched).toMatchObject({ access_token: 'abc', token_type: 'Bearer', expires_in: 3600 })

    // Saving again for the same key replaces the previous token rather than duplicating it.
    await manager.saveAccessToken('https://platform.example', 'client-1', 'scope-a', {
      ...token,
      access_token: 'replaced',
    })
    const replaced = await manager.getAccessToken('https://platform.example', 'client-1', 'scope-a')
    expect(replaced?.access_token).toBe('replaced')

    expect(await manager.getAccessToken('https://platform.example', 'client-1', 'missing-scope')).toBeUndefined()
  })

  it('round-trips an id token', async () => {
    const id = await manager.saveIdToken(idTokenClaims)
    expect(id).toEqual(expect.any(String))

    const fetched = await manager.getIdToken(id)
    expect(fetched).toMatchObject({ id, iss: idTokenClaims.iss, sub: idTokenClaims.sub })

    expect(await manager.getIdToken('00000000-0000-0000-0000-000000000000')).toBeUndefined()
  })

  it('saves and consumes a nonce, rejecting replay', async () => {
    const nonce = 'nonce-1'
    const savedId = await manager.saveNonce(nonce)
    expect(savedId).toBe(nonce)

    expect(await manager.consumeNonce(nonce)).toBe(true)
    expect(await manager.consumeNonce(nonce)).toBe(false)
    expect(await manager.consumeNonce('never-saved')).toBe(false)
  })
})
