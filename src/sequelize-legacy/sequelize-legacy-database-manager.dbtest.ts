import { DataTypes, Sequelize } from 'sequelize'
import {
  IdTokenValidationMethod,
  LtiMessageType,
  type IdTokenClaims,
  type Logger,
  type PlatformAttributes,
} from 'ltijs'
import { encryptAes256 } from './crypto/aes-encryption'
import { SequelizeLegacyDatabaseManager } from './sequelize-legacy-database-manager.service'

function createLogger(): Logger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

function createManager(encryptionKey?: string): SequelizeLegacyDatabaseManager {
  return new SequelizeLegacyDatabaseManager(
    createLogger(),
    { database: 'ltijs_test', options: { dialect: 'sqlite', storage: ':memory:', logging: false } },
    encryptionKey,
  )
}

const platformAttrs: PlatformAttributes = {
  url: 'https://platform.example',
  clientId: 'client-1',
  name: 'Test Platform',
  authenticationEndpoint: 'https://platform.example/auth',
  accessTokenEndpoint: 'https://platform.example/token',
  authorizationServer: 'https://platform.example/as',
  idTokenValidation: { method: IdTokenValidationMethod.RsaKey, key: 'public-key-pem' },
  active: true,
  keys: { public: 'public-key-pem', private: 'private-key-pem' },
}

const idTokenClaims: IdTokenClaims = {
  iss: 'https://platform.example',
  sub: 'user-1',
  client_id: 'client-1',
  platform_id: 'platform-1',
  given_name: 'Ada',
  family_name: 'Lovelace',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'deployment-1',
  'https://purl.imsglobal.org/spec/lti/claim/message_type': LtiMessageType.ResourceLinkRequest,
  'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
  'https://purl.imsglobal.org/spec/lti/claim/roles': ['Learner'],
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': 'https://tool.example/launch',
}

describe.each([
  ['without encryption', undefined],
  ['with encryption', 'super-secret-key'],
])('SequelizeLegacyDatabaseManager (sqlite, %s)', (_label, encryptionKey) => {
  let manager: SequelizeLegacyDatabaseManager

  beforeEach(async () => {
    manager = createManager(encryptionKey)
    await manager.listen()
  })

  afterEach(async () => {
    await manager.close()
  })

  it('saves and retrieves a platform, including its keys, by id, by url+clientId, and by filter', async () => {
    const id = await manager.savePlatform(platformAttrs)
    expect(id).toEqual(expect.any(String))

    const byId = await manager.getPlatformById(id)
    expect(byId).toMatchObject({
      id,
      url: platformAttrs.url,
      clientId: platformAttrs.clientId,
      authorizationServer: platformAttrs.authorizationServer,
      active: true,
      keys: platformAttrs.keys,
    })

    const byUrlAndClientId = await manager.getPlatformByUrlAndClientId(platformAttrs.url, platformAttrs.clientId)
    expect(byUrlAndClientId?.id).toBe(id)

    const filtered = await manager.getPlatforms({ clientId: [platformAttrs.clientId, 'other-client'] })
    expect(filtered).toHaveLength(1)

    expect(await manager.getPlatformById('does-not-exist')).toBeUndefined()
  })

  it('updates a platform, its keys, and its status', async () => {
    const id = await manager.savePlatform(platformAttrs)
    await manager.updatePlatformById(id, {
      name: 'Renamed',
      active: false,
      keys: { public: 'new-public', private: 'new-private' },
    })
    const updated = await manager.getPlatformById(id)
    expect(updated?.name).toBe('Renamed')
    expect(updated?.active).toBe(false)
    expect(updated?.keys).toEqual({ public: 'new-public', private: 'new-private' })
  })

  it('deletes a platform and its associated status/keys', async () => {
    const id = await manager.savePlatform(platformAttrs)
    await manager.deletePlatformById(id)
    expect(await manager.getPlatformById(id)).toBeUndefined()
  })

  it('round-trips an access token', async () => {
    const token = { access_token: 'abc', token_type: 'Bearer', expires_in: 3600, createdAt: Date.now() }
    await manager.saveAccessToken('https://platform.example', 'client-1', 'scope-a', token)
    const fetched = await manager.getAccessToken('https://platform.example', 'client-1', 'scope-a')
    expect(fetched).toMatchObject({ access_token: 'abc', token_type: 'Bearer', expires_in: 3600 })

    await manager.saveAccessToken('https://platform.example', 'client-1', 'scope-a', {
      ...token,
      access_token: 'replaced',
    })
    const replaced = await manager.getAccessToken('https://platform.example', 'client-1', 'scope-a')
    expect(replaced?.access_token).toBe('replaced')
  })

  it('round-trips an id token across the idtoken/contexttoken tables', async () => {
    const id = await manager.saveIdToken(idTokenClaims)
    expect(id).toEqual(expect.any(String))

    const fetched = await manager.getIdToken(id)
    expect(fetched).toMatchObject({
      id,
      iss: idTokenClaims.iss,
      sub: idTokenClaims.sub,
      given_name: 'Ada',
      family_name: 'Lovelace',
      'https://purl.imsglobal.org/spec/lti/claim/roles': ['Learner'],
      'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': 'https://tool.example/launch',
    })

    expect(await manager.getIdToken('does-not-exist')).toBeUndefined()
  })

  it('saves and consumes a nonce, rejecting replay', async () => {
    const nonce = 'nonce-1'
    const savedId = await manager.saveNonce(nonce)
    expect(savedId).toBe(nonce)

    expect(await manager.consumeNonce(nonce)).toBe(true)
    expect(await manager.consumeNonce(nonce)).toBe(false)
  })
})

// Recreates the exact table shape the real v2.4.4 `src/DB.js` created via its own `sequelize.sync()` --
// notably missing `authorizationServer` (added in v2.4.0's migration) and `launchId` (new in v3, added by
// `01_addLaunchIdColumns`) -- so `listen()`'s sync()+migrations sequence can be proven to bring an actual
// upgrade forward correctly, not just be exercised against a table this same code already created fresh.
async function createLegacyV2Tables(qi: ReturnType<Sequelize['getQueryInterface']>): Promise<void> {
  await qi.createTable('platforms', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    platformName: DataTypes.TEXT,
    platformUrl: DataTypes.TEXT,
    clientId: DataTypes.TEXT,
    authEndpoint: DataTypes.TEXT,
    accesstokenEndpoint: DataTypes.TEXT,
    kid: DataTypes.STRING,
    authConfig: DataTypes.JSON,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  })
  await qi.createTable('platformstatuses', {
    id: { type: DataTypes.STRING, primaryKey: true },
    active: DataTypes.BOOLEAN,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  })
  await qi.createTable('publickeys', {
    kid: { type: DataTypes.STRING, primaryKey: true },
    platformUrl: DataTypes.TEXT,
    clientId: DataTypes.TEXT,
    iv: DataTypes.TEXT,
    data: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  })
  await qi.createTable('privatekeys', {
    kid: { type: DataTypes.STRING, primaryKey: true },
    platformUrl: DataTypes.TEXT,
    clientId: DataTypes.TEXT,
    iv: DataTypes.TEXT,
    data: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  })
  await qi.createTable('idtokens', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    iss: DataTypes.TEXT,
    platformId: DataTypes.TEXT,
    clientId: DataTypes.TEXT,
    deploymentId: DataTypes.TEXT,
    user: DataTypes.TEXT,
    userInfo: DataTypes.JSON,
    platformInfo: DataTypes.JSON,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  })
  await qi.createTable('contexttokens', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    contextId: DataTypes.TEXT,
    user: DataTypes.TEXT,
    roles: DataTypes.TEXT,
    targetLinkUri: DataTypes.TEXT,
    context: DataTypes.JSON,
    resource: DataTypes.JSON,
    custom: DataTypes.JSON,
    endpoint: DataTypes.JSON,
    namesRoles: DataTypes.JSON,
    lis: DataTypes.JSON,
    launchPresentation: DataTypes.JSON,
    deepLinkingSettings: DataTypes.JSON,
    messageType: DataTypes.TEXT,
    version: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  })
}

interface SeedKeyPayload {
  publicKeyData: string
  publicKeyIv: string | null
  privateKeyData: string
  privateKeyIv: string | null
}

async function seedLegacyV2Platform(
  qi: ReturnType<Sequelize['getQueryInterface']>,
  seed: SeedKeyPayload,
): Promise<void> {
  const now = new Date()
  await qi.bulkInsert('platforms', [
    {
      platformName: 'Old Platform',
      platformUrl: 'https://old-platform.example',
      clientId: 'old-client',
      authEndpoint: 'https://old-platform.example/auth',
      accesstokenEndpoint: 'https://old-platform.example/token',
      kid: 'existing-kid-1234',
      authConfig: JSON.stringify({ method: 'JWK_SET', key: 'https://old-platform.example/keys' }),
      createdAt: now,
      updatedAt: now,
    },
  ])
  await qi.bulkInsert('platformstatuses', [{ id: 'existing-kid-1234', active: true, createdAt: now, updatedAt: now }])
  await qi.bulkInsert('publickeys', [
    {
      kid: 'existing-kid-1234',
      platformUrl: 'https://old-platform.example',
      clientId: 'old-client',
      iv: seed.publicKeyIv,
      data: seed.publicKeyData,
      createdAt: now,
      updatedAt: now,
    },
  ])
  await qi.bulkInsert('privatekeys', [
    {
      kid: 'existing-kid-1234',
      platformUrl: 'https://old-platform.example',
      clientId: 'old-client',
      iv: seed.privateKeyIv,
      data: seed.privateKeyData,
      createdAt: now,
      updatedAt: now,
    },
  ])
}

describe('SequelizeLegacyDatabaseManager (upgrading a pre-existing v2 database)', () => {
  it('adds the missing columns via migration and keeps pre-existing plain-JSON key data readable', async () => {
    const sequelize = new Sequelize('ltijs_test_upgrade', '', '', {
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })
    const qi = sequelize.getQueryInterface()
    await createLegacyV2Tables(qi)
    // `data` holds the plain `{ key }` JSON envelope `saveKey`/`getKey` read/write when no encryptionKey
    // is configured -- see the encrypted variant below for the shape every *real* v2 deployment actually
    // used (encryption was mandatory in ltijs v5's `Provider.setup`).
    await seedLegacyV2Platform(qi, {
      publicKeyData: JSON.stringify({ key: 'existing-public-key' }),
      publicKeyIv: null,
      privateKeyData: JSON.stringify({ key: 'existing-private-key' }),
      privateKeyIv: null,
    })

    const manager = new SequelizeLegacyDatabaseManager(createLogger(), { sequelize })
    await manager.listen()

    try {
      const existing = await manager.getPlatformByUrlAndClientId('https://old-platform.example', 'old-client')
      expect(existing).toMatchObject({
        id: 'existing-kid-1234',
        url: 'https://old-platform.example',
        clientId: 'old-client',
        active: true,
        keys: { public: 'existing-public-key', private: 'existing-private-key' },
      })
      expect(existing?.authorizationServer).toBeUndefined()

      const newId = await manager.saveIdToken(idTokenClaims)
      const fetched = await manager.getIdToken(newId)
      expect(fetched).toMatchObject({ id: newId, iss: idTokenClaims.iss })
    } finally {
      await manager.close()
    }
  })

  // Real ltijs v5 required `Provider.setup(encryptionkey, ...)`'s key unconditionally (throwing
  // `MISSING_ENCRYPTION_KEY` otherwise), and that same key doubled as this plugin's own `ENCRYPTIONKEY` --
  // so *every* real v2 production database has its `publickey`/`privatekey`/`accesstoken` rows AES-256-CBC
  // encrypted, never plain JSON. This is the scenario an actual production upgrade hits.
  it('decrypts pre-existing AES-encrypted key data with the matching encryptionKey', async () => {
    const encryptionKey = 'the-real-old-LTIKEY-value'
    const publicKey = encryptAes256(JSON.stringify({ key: 'existing-public-key' }), encryptionKey)
    const privateKey = encryptAes256(JSON.stringify({ key: 'existing-private-key' }), encryptionKey)

    const sequelize = new Sequelize('ltijs_test_upgrade_encrypted', '', '', {
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })
    const qi = sequelize.getQueryInterface()
    await createLegacyV2Tables(qi)
    await seedLegacyV2Platform(qi, {
      publicKeyData: publicKey.data,
      publicKeyIv: publicKey.iv,
      privateKeyData: privateKey.data,
      privateKeyIv: privateKey.iv,
    })

    const manager = new SequelizeLegacyDatabaseManager(createLogger(), { sequelize }, encryptionKey)
    await manager.listen()

    try {
      const existing = await manager.getPlatformByUrlAndClientId('https://old-platform.example', 'old-client')
      expect(existing?.keys).toEqual({ public: 'existing-public-key', private: 'existing-private-key' })
    } finally {
      await manager.close()
    }
  })
})
