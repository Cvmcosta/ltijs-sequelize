import { DataTypes } from 'sequelize'
import type { MigrationFn } from 'umzug'
import type { QueryInterface } from 'sequelize'

// `ltijs` v7's `DatabaseManager` interface identifies a stored id_token by a single opaque `id`, but the
// old `idtoken`/`contexttoken` tables never shared one -- `SequelizeLegacyDatabaseManager` generates a
// `launchId` on `saveIdToken` and writes it to both tables to correlate them, so this adds the column to
// each. The column-add is idempotent for the same reason as `00_addAuthorizationServer`: a fresh install's
// `sync()` already created it. The index is owned entirely by this migration, not by `defineLegacyModels`'s
// own `indexes` option, on purpose: `sync()` unconditionally tries to (re)create every index a model
// declares, even against a table that already existed before this migration ever ran -- which would try to
// index a `launchId` column that doesn't exist yet on a real, pre-existing v2 database and throw, since
// `sync()` always runs before migrations do.

const addLaunchIdColumn = async (queryInterface: QueryInterface, tableName: string): Promise<void> => {
  const table = await queryInterface.describeTable(tableName)
  if (table.launchId === undefined) {
    await queryInterface.addColumn(tableName, 'launchId', { type: DataTypes.STRING, allowNull: true })
  }
}

export const up: MigrationFn<QueryInterface> = async ({ context: queryInterface }) => {
  await addLaunchIdColumn(queryInterface, 'idtokens')
  await addLaunchIdColumn(queryInterface, 'contexttokens')
  await queryInterface.addIndex('idtokens', ['launchId'])
  await queryInterface.addIndex('contexttokens', ['launchId'])
}

export const down: MigrationFn<QueryInterface> = async ({ context: queryInterface }) => {
  await queryInterface.removeIndex('idtokens', ['launchId'])
  await queryInterface.removeIndex('contexttokens', ['launchId'])
  await queryInterface.removeColumn('idtokens', 'launchId')
  await queryInterface.removeColumn('contexttokens', 'launchId')
}
