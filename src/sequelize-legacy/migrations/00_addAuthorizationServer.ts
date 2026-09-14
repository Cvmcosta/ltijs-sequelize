import { DataTypes } from 'sequelize'
import type { MigrationFn } from 'umzug'
import type { QueryInterface } from 'sequelize'

// Ported from the current (v2) ltijs-sequelize's own migration of the same name. Guarded with a
// `describeTable` check (idempotent) because `defineLegacyModels` now declares `authorizationServer`
// directly on the `platform` model -- a brand-new install's `sequelize.sync()` already creates the column
// before this migration ever runs, whereas a real upgrading v2 deployment's existing `platforms` table
// does not have it yet and needs this `addColumn` to actually run.

export const up: MigrationFn<QueryInterface> = async ({ context: queryInterface }) => {
  const table = await queryInterface.describeTable('platforms')
  if (table.authorizationServer === undefined) {
    await queryInterface.addColumn('platforms', 'authorizationServer', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    })
  }
}

export const down: MigrationFn<QueryInterface> = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('platforms', 'authorizationServer')
}
