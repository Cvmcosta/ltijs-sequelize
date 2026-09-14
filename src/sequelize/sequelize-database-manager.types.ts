import type { Options as SequelizeOptions, Sequelize } from 'sequelize'

/**
 * Connection configuration for `SequelizeDatabaseManager`/`SequelizeLegacyDatabaseManager`. Either pass an
 * already-constructed `sequelize` instance, or the same `(database, username, password, options)` shape
 * `new Sequelize(...)` itself takes and one will be built internally.
 */
export interface SequelizeConnectionConfig {
  sequelize?: Sequelize
  database?: string
  username?: string
  password?: string
  options?: SequelizeOptions
  debug?: boolean
}
