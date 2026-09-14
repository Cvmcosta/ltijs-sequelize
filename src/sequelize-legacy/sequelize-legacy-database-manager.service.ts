import path from 'node:path'
import { randomBytes } from 'node:crypto'
import cron, { type ScheduledTask } from 'node-cron'
import { Umzug, SequelizeStorage } from 'umzug'
import { Op, Sequelize, type ModelStatic, type WhereOptions } from 'sequelize'
import type {
  AccessTokenRecord,
  DatabaseManager,
  IdTokenClaims,
  IdTokenRecord,
  Logger,
  PlatformAttributes,
  PlatformFilter,
  PlatformRecord,
} from 'ltijs'
import { validate } from '../shared/validation'
import { IdTokenClaim } from '../shared/id-token-claim.constants'
import { decryptAes256, encryptAes256 } from './crypto/aes-encryption'
import {
  AccessTokenRecordSchema,
  IdTokenRecordSchema,
  PlatformRecordSchema,
} from './sequelize-legacy-database-manager.schemas'
import {
  defineLegacyModels,
  type ContextTokenModel,
  type IdTokenModel,
  type KeyModel,
  type KeyRow,
  type LegacySequelizeModels,
  type PlatformModel,
  type PlatformRow,
} from './database-schemas'
import { MissingDatabaseConfigError, ProviderNotDeployedError } from './errors'
import type { SequelizeConnectionConfig } from './sequelize-legacy-database-manager.types'

/** Preserved as-is from the current (v2) ltijs-sequelize -- these TTLs are part of that plugin's existing,
 * observable behavior, not changed to match the fresh `SequelizeDatabaseManager`'s newer defaults. */
const EXPIRE_MS = {
  idtoken: 3600 * 24 * 1000,
  contexttoken: 3600 * 24 * 1000,
  accesstoken: 3600 * 1000,
  nonce: 10 * 1000,
}

const CLEANUP_CRON_SCHEDULE = '0 * * * *'

function buildSequelize(config: SequelizeConnectionConfig): Sequelize {
  if (config.sequelize !== undefined) return config.sequelize
  if (config.database === undefined) throw new MissingDatabaseConfigError()
  const options = { ...config.options }
  if (config.debug === true && options.logging === undefined) options.logging = console.log
  return new Sequelize(config.database, config.username ?? '', config.password ?? '', options)
}

/**
 * Adapts the existing (v2) ltijs-sequelize table layout -- `idtoken`/`contexttoken`, `platform`/
 * `platformStatus`/`publickey`/`privatekey`, `accesstoken`, `nonce` -- to `ltijs` v7's `DatabaseManager`
 * interface, the SQL analogue of `ltijs`'s own `MongoLegacyDatabaseManager`. Unlike that class's mandatory
 * `encryptionKey`, encryption here is optional (a constructor parameter, default `undefined`), matching
 * how the v2 plugin's own encryption was itself opt-in per deployment: when provided, `publickey`/
 * `privatekey`/`accesstoken` rows are encrypted through their existing `iv`/`data` columns; when omitted,
 * those same columns hold plain JSON with `iv` left `null`.
 */
export class SequelizeLegacyDatabaseManager implements DatabaseManager {
  private readonly LOG_COMPONENT = 'database'

  public readonly sequelize: Sequelize
  private readonly logger: Logger
  private readonly models: LegacySequelizeModels
  private readonly encryptionKey: string | undefined
  private cleanupJob: ScheduledTask | undefined
  private deployed = false

  constructor(logger: Logger, config: SequelizeConnectionConfig, encryptionKey?: string) {
    this.sequelize = buildSequelize(config)
    this.logger = logger
    this.models = defineLegacyModels(this.sequelize)
    this.encryptionKey = encryptionKey
  }

  public async listen(): Promise<void> {
    await this.sequelize.authenticate()
    await this.sequelize.sync()
    this.logger.debug(this.LOG_COMPONENT, 'Performing migrations')
    const umzug = new Umzug({
      // Matches `.js` (the compiled package a consumer actually installs) and `.ts` (this package's own
      // dev/test run, which executes `src/` directly with no build step) alike, `.d.ts` excluded --
      // without this, a glob of `*.js` alone silently matches nothing at all under ts-jest, since no
      // compiled output exists next to `src/` there, and Umzug treats an empty match as "no migrations to
      // run" rather than an error.
      migrations: { glob: [path.join(__dirname, 'migrations', '*.{js,ts}'), { ignore: '**/*.d.ts' }] },
      context: this.sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize: this.sequelize }),
      logger: undefined,
    })
    await umzug.up()
    this.logger.debug(this.LOG_COMPONENT, 'Database connected')
    await this.cleanupExpiredRecords()
    this.cleanupJob = cron.schedule(CLEANUP_CRON_SCHEDULE, () => {
      this.cleanupExpiredRecords().catch((err: unknown) => {
        this.logger.error(this.LOG_COMPONENT, `Error cleaning up expired records: ${String(err)}`)
      })
    })
    this.deployed = true
  }

  public async close(): Promise<void> {
    this.cleanupJob?.stop()
    this.cleanupJob = undefined
    await this.sequelize.close()
    this.deployed = false
    this.logger.debug(this.LOG_COMPONENT, 'Database disconnected')
  }

  public async getPlatforms(filter: PlatformFilter = {}): Promise<PlatformRecord[]> {
    this.ensureDeployed()
    const rows = await this.models.Platform.findAll({ where: this.buildPlatformQuery(filter) })
    return await Promise.all(rows.map(async row => await this.toPlatformRecord(row)))
  }

  public async getPlatformById(id: string): Promise<PlatformRecord | undefined> {
    this.ensureDeployed()
    const row = await this.models.Platform.findOne({ where: { kid: id } })
    return row === null ? undefined : await this.toPlatformRecord(row)
  }

  public async getPlatformByUrlAndClientId(url: string, clientId: string): Promise<PlatformRecord | undefined> {
    this.ensureDeployed()
    const row = await this.models.Platform.findOne({ where: { platformUrl: url, clientId } })
    return row === null ? undefined : await this.toPlatformRecord(row)
  }

  public async savePlatform(platform: PlatformAttributes): Promise<string> {
    this.ensureDeployed()
    const kid = await this.generateUniqueKid()
    await this.models.Platform.create({
      kid,
      platformUrl: platform.url,
      platformName: platform.name,
      clientId: platform.clientId,
      authEndpoint: platform.authenticationEndpoint,
      accesstokenEndpoint: platform.accessTokenEndpoint,
      authorizationServer: platform.authorizationServer ?? null,
      authConfig: platform.idTokenValidation,
    })
    await this.models.PlatformStatus.create({ id: kid, active: platform.active })
    await this.saveKey(
      this.models.PublicKey,
      { kid, platformUrl: platform.url, clientId: platform.clientId },
      platform.keys.public,
    )
    await this.saveKey(
      this.models.PrivateKey,
      { kid, platformUrl: platform.url, clientId: platform.clientId },
      platform.keys.private,
    )
    return kid
  }

  public async updatePlatformById(id: string, fields: Partial<PlatformAttributes>): Promise<void> {
    this.ensureDeployed()
    const {
      active,
      keys,
      url,
      clientId,
      name,
      authenticationEndpoint,
      accessTokenEndpoint,
      idTokenValidation,
      authorizationServer,
    } = fields
    const update: Partial<Omit<PlatformRow, 'kid'>> = {}
    if (url !== undefined) update.platformUrl = url
    if (clientId !== undefined) update.clientId = clientId
    if (name !== undefined) update.platformName = name
    if (authenticationEndpoint !== undefined) update.authEndpoint = authenticationEndpoint
    if (accessTokenEndpoint !== undefined) update.accesstokenEndpoint = accessTokenEndpoint
    if (authorizationServer !== undefined) update.authorizationServer = authorizationServer
    if (idTokenValidation !== undefined) update.authConfig = idTokenValidation
    if (Object.keys(update).length > 0) await this.models.Platform.update(update, { where: { kid: id } })
    if (active !== undefined) await this.models.PlatformStatus.upsert({ id, active })

    if (url !== undefined || clientId !== undefined) {
      const keyUpdate: Partial<Pick<KeyRow, 'platformUrl' | 'clientId'>> = {}
      if (url !== undefined) keyUpdate.platformUrl = url
      if (clientId !== undefined) keyUpdate.clientId = clientId
      await this.models.PublicKey.update(keyUpdate, { where: { kid: id } })
      await this.models.PrivateKey.update(keyUpdate, { where: { kid: id } })
    }

    if (keys !== undefined) {
      const platform = await this.models.Platform.findOne({ where: { kid: id } })
      const platformUrl = url ?? platform?.platformUrl ?? ''
      const platformClientId = clientId ?? platform?.clientId ?? ''
      await this.saveKey(this.models.PublicKey, { kid: id, platformUrl, clientId: platformClientId }, keys.public)
      await this.saveKey(this.models.PrivateKey, { kid: id, platformUrl, clientId: platformClientId }, keys.private)
    }
  }

  public async deletePlatformById(id: string): Promise<void> {
    this.ensureDeployed()
    await Promise.all([
      this.models.Platform.destroy({ where: { kid: id } }),
      this.models.PlatformStatus.destroy({ where: { id } }),
      this.models.PublicKey.destroy({ where: { kid: id } }),
      this.models.PrivateKey.destroy({ where: { kid: id } }),
    ])
  }

  public async getAccessToken(
    platformUrl: string,
    clientId: string,
    scopes: string,
  ): Promise<AccessTokenRecord | undefined> {
    this.ensureDeployed()
    const row = await this.models.AccessToken.findOne({ where: { platformUrl, clientId, scopes } })
    if (row === null) return undefined
    const decoded = this.decodePayload(row.data, row.iv)
    const { token } = JSON.parse(decoded) as { token: Record<string, unknown> }
    return validate<AccessTokenRecord>(AccessTokenRecordSchema, { ...token, createdAt: row.createdAt.getTime() })
  }

  public async saveAccessToken(
    platformUrl: string,
    clientId: string,
    scopes: string,
    token: AccessTokenRecord,
  ): Promise<string> {
    this.ensureDeployed()
    const { createdAt: _createdAt, ...value } = token
    const encoded = this.encodePayload(JSON.stringify({ token: value }))
    await this.models.AccessToken.destroy({ where: { platformUrl, clientId, scopes } })
    const row = await this.models.AccessToken.create({ platformUrl, clientId, scopes, ...encoded })
    return String(row.id)
  }

  public async getIdToken(id: string): Promise<IdTokenRecord | undefined> {
    this.ensureDeployed()
    const [idTokenRow, contextTokenRow] = await Promise.all([
      this.models.IdToken.findOne({ where: { launchId: id } }),
      this.models.ContextToken.findOne({ where: { launchId: id } }),
    ])
    if (idTokenRow === null || contextTokenRow === null) return undefined
    return validate<IdTokenRecord>(IdTokenRecordSchema, this.toIdTokenRecord(idTokenRow, contextTokenRow))
  }

  public async saveIdToken(token: IdTokenClaims): Promise<string> {
    this.ensureDeployed()
    const launchId = await this.generateUniqueLaunchId()
    await this.models.IdToken.create({
      launchId,
      iss: token.iss,
      user: token.sub,
      clientId: token[IdTokenClaim.ClientId],
      deploymentId: token[IdTokenClaim.DeploymentId],
      userInfo: {
        given_name: token.given_name,
        family_name: token.family_name,
        name: token.name,
        email: token.email,
      },
      platformInfo: token[IdTokenClaim.ToolPlatform] ?? {},
      platformId: token[IdTokenClaim.PlatformId],
    })
    await this.models.ContextToken.create({
      launchId,
      contextId: launchId,
      user: token.sub,
      context: token[IdTokenClaim.Context] ?? null,
      resource: token[IdTokenClaim.ResourceLink] ?? null,
      messageType: token[IdTokenClaim.MessageType] ?? null,
      version: token[IdTokenClaim.Version] ?? null,
      deepLinkingSettings: token[IdTokenClaim.DeepLinkingSettings] ?? null,
      lis: token[IdTokenClaim.Lis] ?? null,
      roles: token[IdTokenClaim.Roles] ?? null,
      targetLinkUri: token[IdTokenClaim.TargetLinkUri] ?? null,
      custom: token[IdTokenClaim.Custom] ?? null,
      launchPresentation: token[IdTokenClaim.LaunchPresentation] ?? null,
      endpoint: token[IdTokenClaim.Endpoint] ?? null,
      namesRoles: token[IdTokenClaim.NamesRoleService] ?? null,
    })
    return launchId
  }

  public async saveNonce(nonce: string): Promise<string> {
    this.ensureDeployed()
    await this.models.Nonce.create({ nonce })
    return nonce
  }

  public async consumeNonce(nonce: string): Promise<boolean> {
    this.ensureDeployed()
    const destroyed = await this.models.Nonce.destroy({ where: { nonce } })
    return destroyed > 0
  }

  private ensureDeployed(): void {
    if (!this.deployed) throw new ProviderNotDeployedError()
  }

  private buildPlatformQuery(filter: PlatformFilter): WhereOptions<PlatformRow> {
    const query: WhereOptions<PlatformRow> = {}
    if (filter.url !== undefined) query.platformUrl = filter.url
    if (filter.name !== undefined) query.platformName = filter.name
    if (filter.clientId !== undefined) {
      query.clientId = Array.isArray(filter.clientId) ? { [Op.in]: filter.clientId } : filter.clientId
    }
    return query
  }

  private async toPlatformRecord(row: PlatformModel): Promise<PlatformRecord> {
    const [status, publicKey, privateKey] = await Promise.all([
      this.models.PlatformStatus.findOne({ where: { id: row.kid } }),
      this.getKey(this.models.PublicKey, row.kid),
      this.getKey(this.models.PrivateKey, row.kid),
    ])
    return validate<PlatformRecord>(PlatformRecordSchema, {
      id: row.kid,
      url: row.platformUrl,
      clientId: row.clientId,
      name: row.platformName,
      authenticationEndpoint: row.authEndpoint,
      accessTokenEndpoint: row.accesstokenEndpoint,
      authorizationServer: row.authorizationServer ?? undefined,
      idTokenValidation: row.authConfig,
      // Matches real legacy's `Platform.platformActive()`: a missing status row defaults to active.
      active: status?.active ?? true,
      keys: { public: publicKey ?? '', private: privateKey ?? '' },
    })
  }

  // Real legacy `contexttoken` rows don't reliably have every field set (pre-migration data never wrote
  // `launchId`, and this table's own fields were always loosely optional) -- returns a plain object, not
  // `IdTokenRecord`; whether the required LTI claims actually ended up present is `validate()`'s job.
  private toIdTokenRecord(idTokenRow: IdTokenModel, contextTokenRow: ContextTokenModel): Record<string, unknown> {
    const userInfo = idTokenRow.userInfo
    return {
      id: idTokenRow.launchId,
      iss: idTokenRow.iss,
      sub: idTokenRow.user,
      [IdTokenClaim.ClientId]: idTokenRow.clientId,
      [IdTokenClaim.PlatformId]: idTokenRow.platformId,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name,
      name: userInfo.name,
      email: userInfo.email,
      [IdTokenClaim.DeploymentId]: idTokenRow.deploymentId,
      [IdTokenClaim.ToolPlatform]: idTokenRow.platformInfo,
      [IdTokenClaim.MessageType]: contextTokenRow.messageType ?? undefined,
      [IdTokenClaim.Version]: contextTokenRow.version ?? undefined,
      [IdTokenClaim.Roles]: contextTokenRow.roles ?? undefined,
      [IdTokenClaim.TargetLinkUri]: contextTokenRow.targetLinkUri ?? undefined,
      [IdTokenClaim.Context]: contextTokenRow.context ?? undefined,
      [IdTokenClaim.ResourceLink]: contextTokenRow.resource ?? undefined,
      [IdTokenClaim.LaunchPresentation]: contextTokenRow.launchPresentation ?? undefined,
      [IdTokenClaim.Custom]: contextTokenRow.custom ?? undefined,
      [IdTokenClaim.Lis]: contextTokenRow.lis ?? undefined,
      [IdTokenClaim.Endpoint]: contextTokenRow.endpoint ?? undefined,
      [IdTokenClaim.NamesRoleService]: contextTokenRow.namesRoles ?? undefined,
      [IdTokenClaim.DeepLinkingSettings]: contextTokenRow.deepLinkingSettings ?? undefined,
    }
  }

  private async generateUniqueKid(): Promise<string> {
    let kid = randomBytes(16).toString('hex')
    while ((await this.models.Platform.findOne({ where: { kid } })) !== null) {
      kid = randomBytes(16).toString('hex')
    }
    return kid
  }

  private async generateUniqueLaunchId(): Promise<string> {
    let launchId = randomBytes(16).toString('hex')
    while ((await this.models.IdToken.findOne({ where: { launchId } })) !== null) {
      launchId = randomBytes(16).toString('hex')
    }
    return launchId
  }

  private async saveKey(
    model: ModelStatic<KeyModel>,
    identity: { kid: string; platformUrl: string; clientId: string },
    key: string,
  ): Promise<void> {
    const { kid, platformUrl, clientId } = identity
    const encoded = this.encodePayload(JSON.stringify({ key }))
    await model.destroy({ where: { kid } })
    await model.create({ kid, platformUrl, clientId, ...encoded })
  }

  private async getKey(model: ModelStatic<KeyModel>, kid: string): Promise<string | undefined> {
    const row = await model.findOne({ where: { kid } })
    if (row === null) return undefined
    const decoded = this.decodePayload(row.data, row.iv)
    const { key } = JSON.parse(decoded) as { key: string }
    return key
  }

  private encodePayload(data: string): { iv: string | null; data: string } {
    if (this.encryptionKey === undefined) return { iv: null, data }
    return encryptAes256(data, this.encryptionKey)
  }

  private decodePayload(data: string, iv: string | null): string {
    if (this.encryptionKey === undefined || iv === null) return data
    return decryptAes256(data, iv, this.encryptionKey)
  }

  private async cleanupExpiredRecords(): Promise<void> {
    const now = Date.now()
    const [idtokenDeleted, contexttokenDeleted, accesstokenDeleted, nonceDeleted] = await Promise.all([
      this.models.IdToken.destroy({ where: { createdAt: { [Op.lte]: new Date(now - EXPIRE_MS.idtoken) } } }),
      this.models.ContextToken.destroy({
        where: { createdAt: { [Op.lte]: new Date(now - EXPIRE_MS.contexttoken) } },
      }),
      this.models.AccessToken.destroy({
        where: { createdAt: { [Op.lte]: new Date(now - EXPIRE_MS.accesstoken) } },
      }),
      this.models.Nonce.destroy({ where: { createdAt: { [Op.lte]: new Date(now - EXPIRE_MS.nonce) } } }),
    ])
    this.logger.debug(
      this.LOG_COMPONENT,
      `Cleaned up expired records (idtoken: ${String(idtokenDeleted)}, contexttoken: ${String(contexttokenDeleted)}, accesstoken: ${String(accesstokenDeleted)}, nonce: ${String(nonceDeleted)})`,
    )
  }
}

export default SequelizeLegacyDatabaseManager
