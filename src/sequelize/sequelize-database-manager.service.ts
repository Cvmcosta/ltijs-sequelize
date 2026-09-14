import cron, { type ScheduledTask } from 'node-cron'
import { Op, Sequelize, type WhereOptions } from 'sequelize'
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
import {
  AccessTokenRecordSchema,
  IdTokenRecordSchema,
  PlatformRecordSchema,
} from './sequelize-database-manager.schemas'
import { defineModels, type PlatformModel, type PlatformRow, type SequelizeModels } from './database-schemas'
import { MissingDatabaseConfigError, ProviderNotDeployedError } from './errors'
import type { SequelizeConnectionConfig } from './sequelize-database-manager.types'

/** How long a row may sit unconsumed before the periodic cleanup sweep removes it -- there's no native
 * TTL index in SQL the way there is in Mongo, so this is enforced by `cleanupExpiredRecords` alone. */
const EXPIRE_MS = {
  idtoken: 3600 * 24 * 1000,
  accesstoken: 3600 * 1000,
  nonce: 600 * 1000,
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
 * A fresh `DatabaseManager` implementation designed directly around `ltijs` v7's interface -- one
 * `platform` row per platform (keys/active embedded, no separate status/key tables) and one `idtoken` row
 * per launch (the whole claim set stored as JSON), mirroring how `ltijs`'s own default
 * `MongoDatabaseManager` was redesigned fresh for v7. Stores everything in plaintext, matching v7's own
 * stated trust model ("the database is the trust boundary now") -- see `SequelizeLegacyDatabaseManager`
 * for optional at-rest encryption.
 */
export class SequelizeDatabaseManager implements DatabaseManager {
  private readonly LOG_COMPONENT = 'database'

  public readonly sequelize: Sequelize
  private readonly logger: Logger
  private readonly models: SequelizeModels
  private cleanupJob: ScheduledTask | undefined
  private deployed = false

  constructor(logger: Logger, config: SequelizeConnectionConfig) {
    this.sequelize = buildSequelize(config)
    this.logger = logger
    this.models = defineModels(this.sequelize)
  }

  public async listen(): Promise<void> {
    await this.sequelize.authenticate()
    await this.sequelize.sync()
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
    return rows.map(row => this.toPlatformRecord(row))
  }

  public async getPlatformById(id: string): Promise<PlatformRecord | undefined> {
    this.ensureDeployed()
    const row = await this.models.Platform.findByPk(id)
    return row === null ? undefined : this.toPlatformRecord(row)
  }

  public async getPlatformByUrlAndClientId(url: string, clientId: string): Promise<PlatformRecord | undefined> {
    this.ensureDeployed()
    const row = await this.models.Platform.findOne({ where: { url, clientId } })
    return row === null ? undefined : this.toPlatformRecord(row)
  }

  public async savePlatform(platform: PlatformAttributes): Promise<string> {
    this.ensureDeployed()
    const row = await this.models.Platform.create({
      url: platform.url,
      clientId: platform.clientId,
      name: platform.name,
      authenticationEndpoint: platform.authenticationEndpoint,
      accessTokenEndpoint: platform.accessTokenEndpoint,
      authorizationServer: platform.authorizationServer ?? null,
      idTokenValidation: platform.idTokenValidation,
      active: platform.active,
      keys: platform.keys,
    })
    return row.id
  }

  public async updatePlatformById(id: string, fields: Partial<PlatformAttributes>): Promise<void> {
    this.ensureDeployed()
    const update: Partial<PlatformRow> = {}
    if (fields.url !== undefined) update.url = fields.url
    if (fields.clientId !== undefined) update.clientId = fields.clientId
    if (fields.name !== undefined) update.name = fields.name
    if (fields.authenticationEndpoint !== undefined) update.authenticationEndpoint = fields.authenticationEndpoint
    if (fields.accessTokenEndpoint !== undefined) update.accessTokenEndpoint = fields.accessTokenEndpoint
    if (fields.authorizationServer !== undefined) update.authorizationServer = fields.authorizationServer
    if (fields.idTokenValidation !== undefined) update.idTokenValidation = fields.idTokenValidation
    if (fields.active !== undefined) update.active = fields.active
    if (fields.keys !== undefined) update.keys = fields.keys
    if (Object.keys(update).length === 0) return
    await this.models.Platform.update(update, { where: { id } })
  }

  public async deletePlatformById(id: string): Promise<void> {
    this.ensureDeployed()
    await this.models.Platform.destroy({ where: { id } })
  }

  public async getAccessToken(
    platformUrl: string,
    clientId: string,
    scopes: string,
  ): Promise<AccessTokenRecord | undefined> {
    this.ensureDeployed()
    const row = await this.models.AccessToken.findOne({ where: { platformUrl, clientId, scopes } })
    if (row === null) return undefined
    const merged = { ...row.token, createdAt: row.createdAt.getTime() }
    return validate<AccessTokenRecord>(AccessTokenRecordSchema, merged)
  }

  public async saveAccessToken(
    platformUrl: string,
    clientId: string,
    scopes: string,
    token: AccessTokenRecord,
  ): Promise<string> {
    this.ensureDeployed()
    const { createdAt: _createdAt, ...value } = token
    await this.models.AccessToken.destroy({ where: { platformUrl, clientId, scopes } })
    const row = await this.models.AccessToken.create({ platformUrl, clientId, scopes, token: value })
    return row.id
  }

  public async getIdToken(id: string): Promise<IdTokenRecord | undefined> {
    this.ensureDeployed()
    const row = await this.models.IdToken.findByPk(id)
    if (row === null) return undefined
    return validate<IdTokenRecord>(IdTokenRecordSchema, { ...row.claims, id: row.id })
  }

  public async saveIdToken(token: IdTokenClaims): Promise<string> {
    this.ensureDeployed()
    const row = await this.models.IdToken.create({ claims: token })
    return row.id
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
    if (filter.url !== undefined) query.url = filter.url
    if (filter.name !== undefined) query.name = filter.name
    if (filter.clientId !== undefined) {
      query.clientId = Array.isArray(filter.clientId) ? { [Op.in]: filter.clientId } : filter.clientId
    }
    return query
  }

  private toPlatformRecord(row: PlatformModel): PlatformRecord {
    return validate<PlatformRecord>(PlatformRecordSchema, {
      id: row.id,
      url: row.url,
      clientId: row.clientId,
      name: row.name,
      authenticationEndpoint: row.authenticationEndpoint,
      accessTokenEndpoint: row.accessTokenEndpoint,
      authorizationServer: row.authorizationServer ?? undefined,
      idTokenValidation: row.idTokenValidation,
      active: row.active,
      keys: row.keys,
    })
  }

  private async cleanupExpiredRecords(): Promise<void> {
    const now = Date.now()
    const idtokenDeleted = await this.models.IdToken.destroy({
      where: { createdAt: { [Op.lte]: new Date(now - EXPIRE_MS.idtoken) } },
    })
    const accesstokenDeleted = await this.models.AccessToken.destroy({
      where: { createdAt: { [Op.lte]: new Date(now - EXPIRE_MS.accesstoken) } },
    })
    const nonceDeleted = await this.models.Nonce.destroy({
      where: { createdAt: { [Op.lte]: new Date(now - EXPIRE_MS.nonce) } },
    })
    this.logger.debug(
      this.LOG_COMPONENT,
      `Cleaned up expired records (idtoken: ${String(idtokenDeleted)}, accesstoken: ${String(accesstokenDeleted)}, nonce: ${String(nonceDeleted)})`,
    )
  }
}

export default SequelizeDatabaseManager
