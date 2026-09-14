import { DataTypes, Op, UUIDV4, type Model, type ModelStatic, type Optional, type Sequelize } from 'sequelize'

// Fresh, normalized schema designed directly around `ltijs`'s new `DatabaseManager` interface -- one row
// per platform (keys/active embedded, no separate status/key tables) and one row per id_token (the whole
// claim set stored together as JSON, not split across tables) -- mirroring how `ltijs`'s own fresh
// `MongoDatabaseManager` embeds everything into a single document per entity. Independent of
// `../sequelize-legacy/database-schemas.ts` by design; see that module's own isolation note.

export interface PlatformRow {
  id: string
  url: string
  clientId: string
  name: string
  authenticationEndpoint: string
  accessTokenEndpoint: string
  authorizationServer: string | null
  idTokenValidation: { method: string; key: string }
  active: boolean
  keys: { public: string; private: string }
}
type PlatformCreationRow = Optional<PlatformRow, 'id' | 'authorizationServer' | 'active'>
export type PlatformModel = Model<PlatformRow, PlatformCreationRow> & PlatformRow

export interface IdTokenRow {
  id: string
  claims: Record<string, unknown>
  createdAt: Date
}
type IdTokenCreationRow = Optional<IdTokenRow, 'id' | 'createdAt'>
export type IdTokenModel = Model<IdTokenRow, IdTokenCreationRow> & IdTokenRow

export interface AccessTokenRow {
  id: string
  platformUrl: string
  clientId: string
  scopes: string
  token: Record<string, unknown>
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

export interface SequelizeModels {
  Platform: ModelStatic<PlatformModel>
  IdToken: ModelStatic<IdTokenModel>
  AccessToken: ModelStatic<AccessTokenModel>
  Nonce: ModelStatic<NonceModel>
}

/** Models are defined per-`Sequelize`-instance (`sequelize.define`, not a module-level `Model.init()`
 * class) so that two `SequelizeDatabaseManager`s constructed against two different connections (e.g. in a
 * test suite) never collide on a shared model registry. */
export function defineModels(sequelize: Sequelize): SequelizeModels {
  const Platform = sequelize.define<PlatformModel>(
    'platform',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: UUIDV4 },
      url: { type: DataTypes.TEXT, allowNull: false },
      clientId: { type: DataTypes.TEXT, allowNull: false },
      name: { type: DataTypes.TEXT, allowNull: false },
      authenticationEndpoint: { type: DataTypes.TEXT, allowNull: false },
      accessTokenEndpoint: { type: DataTypes.TEXT, allowNull: false },
      authorizationServer: { type: DataTypes.TEXT, allowNull: true },
      idTokenValidation: { type: DataTypes.JSON, allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      keys: { type: DataTypes.JSON, allowNull: false },
    },
    {
      indexes: [
        {
          unique: true,
          fields: [
            { name: 'url', length: 191 },
            { name: 'clientId', length: 191 },
          ],
        },
        { fields: [{ name: 'url', length: 191 }] },
      ],
    },
  )

  const IdToken = sequelize.define<IdTokenModel>(
    'idtoken',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: UUIDV4 },
      claims: { type: DataTypes.JSON, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { updatedAt: false, indexes: [{ fields: ['createdAt'] }] },
  )

  const AccessToken = sequelize.define<AccessTokenModel>(
    'accesstoken',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: UUIDV4 },
      platformUrl: { type: DataTypes.TEXT, allowNull: false },
      clientId: { type: DataTypes.TEXT, allowNull: false },
      scopes: { type: DataTypes.TEXT, allowNull: false },
      token: { type: DataTypes.JSON, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      updatedAt: false,
      indexes: [
        {
          unique: true,
          fields: [
            { name: 'platformUrl', length: 191 },
            { name: 'clientId', length: 191 },
            { name: 'scopes', length: 191 },
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
    { updatedAt: false, indexes: [{ fields: ['createdAt'] }] },
  )

  return { Platform, IdToken, AccessToken, Nonce }
}

export { Op }
