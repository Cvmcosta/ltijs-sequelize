import { DataTypes, type Model, type ModelStatic, type Optional, type Sequelize } from 'sequelize'

// The existing (v2) ltijs-sequelize table layout, ported as-is, plus two additions needed to satisfy
// `ltijs` v7's single-id `DatabaseManager` contract: a `launchId` correlation key on `idtoken`/
// `contexttoken` (there was no single id shared between them before -- `SequelizeLegacyDatabaseManager`
// generates and returns it from `saveIdToken`), and the `authorizationServer` column real v2 deployments
// only have via the ported `00_addAuthorizationServer` migration, not always via `sync()` (see the
// migrations directory). Independent of `../sequelize/database-schemas.ts` by design; see that module's
// own isolation note.

export interface IdTokenRow {
  id: number
  launchId: string | null
  iss: string
  platformId: string
  clientId: string
  deploymentId: string
  user: string
  userInfo: Record<string, unknown>
  platformInfo: Record<string, unknown>
  createdAt: Date
}
type IdTokenCreationRow = Optional<IdTokenRow, 'id' | 'launchId' | 'createdAt'>
export type IdTokenModel = Model<IdTokenRow, IdTokenCreationRow> & IdTokenRow

export interface ContextTokenRow {
  id: number
  launchId: string | null
  contextId: string
  user: string
  roles: string[] | null
  targetLinkUri: string | null
  context: Record<string, unknown> | null
  resource: Record<string, unknown> | null
  custom: Record<string, unknown> | null
  endpoint: Record<string, unknown> | null
  namesRoles: Record<string, unknown> | null
  lis: Record<string, unknown> | null
  launchPresentation: Record<string, unknown> | null
  deepLinkingSettings: Record<string, unknown> | null
  messageType: string | null
  version: string | null
  createdAt: Date
}
type ContextTokenCreationRow = Optional<ContextTokenRow, 'id' | 'launchId' | 'createdAt'>
export type ContextTokenModel = Model<ContextTokenRow, ContextTokenCreationRow> & ContextTokenRow

export interface PlatformRow {
  kid: string
  platformName: string
  platformUrl: string
  clientId: string
  authEndpoint: string
  accesstokenEndpoint: string
  authorizationServer: string | null
  authConfig: { method: string; key: string }
}
type PlatformCreationRow = Optional<PlatformRow, 'authorizationServer'>
export type PlatformModel = Model<PlatformRow, PlatformCreationRow> & PlatformRow

export interface PlatformStatusRow {
  id: string
  active: boolean
}
export type PlatformStatusModel = Model<PlatformStatusRow, PlatformStatusRow> & PlatformStatusRow

export interface KeyRow {
  kid: string
  platformUrl: string
  clientId: string
  iv: string | null
  data: string
}
export type KeyModel = Model<KeyRow, KeyRow> & KeyRow

export interface AccessTokenRow {
  id: number
  platformUrl: string
  clientId: string
  scopes: string
  iv: string | null
  data: string
  createdAt: Date
}
type AccessTokenCreationRow = Optional<AccessTokenRow, 'id' | 'createdAt'>
export type AccessTokenModel = Model<AccessTokenRow, AccessTokenCreationRow> & AccessTokenRow

export interface NonceRow {
  nonce: string
  createdAt: Date
}
type NonceCreationRow = Optional<NonceRow, 'createdAt'>
export type NonceModel = Model<NonceRow, NonceCreationRow> & NonceRow

export interface LegacySequelizeModels {
  IdToken: ModelStatic<IdTokenModel>
  ContextToken: ModelStatic<ContextTokenModel>
  Platform: ModelStatic<PlatformModel>
  PlatformStatus: ModelStatic<PlatformStatusModel>
  PublicKey: ModelStatic<KeyModel>
  PrivateKey: ModelStatic<KeyModel>
  AccessToken: ModelStatic<AccessTokenModel>
  Nonce: ModelStatic<NonceModel>
}

/** Models are defined per-`Sequelize`-instance (`sequelize.define`, not a module-level `Model.init()`
 * class), same reasoning as `../sequelize/database-schemas.ts`. */
export function defineLegacyModels(sequelize: Sequelize): LegacySequelizeModels {
  const dialect = sequelize.getDialect()

  const IdToken = sequelize.define<IdTokenModel>(
    'idtoken',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      launchId: { type: DataTypes.STRING, allowNull: true },
      iss: { type: DataTypes.TEXT },
      platformId: { type: DataTypes.TEXT },
      clientId: { type: DataTypes.TEXT },
      deploymentId: { type: DataTypes.TEXT },
      user: { type: DataTypes.TEXT },
      userInfo: { type: DataTypes.JSON },
      platformInfo: { type: DataTypes.JSON },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      indexes: [
        {
          fields: [
            { name: 'iss', length: 50 },
            { name: 'clientId', length: 50 },
            { name: 'deploymentId', length: 50 },
            { name: 'user', length: 50 },
          ],
        },
        { fields: ['createdAt'] },
        // No index on `launchId` here -- see the `01_addLaunchIdColumns` migration, which owns it instead.
      ],
    },
  )

  const ContextToken = sequelize.define<ContextTokenModel>(
    'contexttoken',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      launchId: { type: DataTypes.STRING, allowNull: true },
      contextId: { type: DataTypes.TEXT },
      user: { type: DataTypes.TEXT },
      roles:
        dialect === 'postgres'
          ? { type: DataTypes.ARRAY(DataTypes.TEXT) }
          : {
              type: DataTypes.TEXT,
              get(this: ContextTokenModel): string[] | null {
                const raw = this.getDataValue('roles') as unknown as string | null
                return raw !== null && raw !== '' ? raw.split(';') : null
              },
              set(this: ContextTokenModel, value: string[] | null) {
                this.setDataValue('roles', (value !== null ? value.join(';') : null) as unknown as string[])
              },
            },
      targetLinkUri: { type: DataTypes.TEXT },
      context: { type: DataTypes.JSON },
      resource: { type: DataTypes.JSON },
      custom: { type: DataTypes.JSON },
      endpoint: { type: DataTypes.JSON },
      namesRoles: { type: DataTypes.JSON },
      lis: { type: DataTypes.JSON },
      launchPresentation: { type: DataTypes.JSON },
      deepLinkingSettings: { type: DataTypes.JSON },
      messageType: { type: DataTypes.TEXT },
      version: { type: DataTypes.TEXT },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      indexes: [
        {
          fields: [
            { name: 'contextId', length: 50 },
            { name: 'user', length: 50 },
          ],
        },
        { fields: ['createdAt'] },
        // No index on `launchId` here -- see the `01_addLaunchIdColumns` migration, which owns it instead.
      ],
    },
  )

  const Platform = sequelize.define<PlatformModel>(
    'platform',
    {
      kid: { type: DataTypes.STRING, primaryKey: true },
      platformName: { type: DataTypes.TEXT },
      platformUrl: { type: DataTypes.TEXT },
      clientId: { type: DataTypes.TEXT },
      authEndpoint: { type: DataTypes.TEXT },
      accesstokenEndpoint: { type: DataTypes.TEXT },
      authorizationServer: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
      authConfig: { type: DataTypes.JSON },
    },
    {
      indexes: [
        {
          unique: true,
          fields: [
            { name: 'platformUrl', length: 50 },
            { name: 'clientId', length: 50 },
          ],
        },
        { fields: [{ name: 'platformUrl', length: 50 }] },
      ],
    },
  )

  const PlatformStatus = sequelize.define<PlatformStatusModel>(
    'platformStatus',
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      active: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { indexes: [{ fields: ['id'], unique: true }] },
  )

  const keyAttributes = {
    kid: { type: DataTypes.STRING, primaryKey: true },
    platformUrl: { type: DataTypes.TEXT },
    clientId: { type: DataTypes.TEXT },
    iv: { type: DataTypes.TEXT, allowNull: true },
    data: { type: DataTypes.TEXT },
  } as const
  const PublicKey = sequelize.define<KeyModel>('publickey', keyAttributes, {
    indexes: [{ fields: [{ name: 'kid', length: 50 }], unique: true }],
  })
  const PrivateKey = sequelize.define<KeyModel>('privatekey', keyAttributes, {
    indexes: [{ fields: [{ name: 'kid', length: 50 }], unique: true }],
  })

  const AccessToken = sequelize.define<AccessTokenModel>(
    'accesstoken',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      platformUrl: { type: DataTypes.TEXT },
      clientId: { type: DataTypes.TEXT },
      scopes: { type: DataTypes.TEXT },
      iv: { type: DataTypes.TEXT, allowNull: true },
      data: { type: DataTypes.TEXT },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      indexes: [
        {
          unique: true,
          fields: [
            { name: 'platformUrl', length: 50 },
            { name: 'clientId', length: 50 },
            { name: 'scopes', length: 50 },
          ],
        },
        { fields: ['createdAt'] },
      ],
    },
  )

  const Nonce = sequelize.define<NonceModel>(
    'nonce',
    {
      nonce: { type: DataTypes.STRING, primaryKey: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { indexes: [{ fields: [{ name: 'nonce', length: 50 }], unique: true }, { fields: ['createdAt'] }] },
  )

  return { IdToken, ContextToken, Platform, PlatformStatus, PublicKey, PrivateKey, AccessToken, Nonce }
}
