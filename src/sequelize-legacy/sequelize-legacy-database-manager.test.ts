import type { Logger } from 'ltijs'
import { SequelizeLegacyDatabaseManager } from './sequelize-legacy-database-manager.service'

function createLogger(): Logger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

describe('SequelizeLegacyDatabaseManager', () => {
  it('throws MissingDatabaseConfigError without a database or sequelize instance', () => {
    expect(() => new SequelizeLegacyDatabaseManager(createLogger(), {})).toThrow('MISSING_DATABASE_CONFIG')
  })

  it('throws ProviderNotDeployedError when a data method is called before listen()', async () => {
    const manager = new SequelizeLegacyDatabaseManager(createLogger(), {
      database: 'ltijs_test',
      options: { dialect: 'sqlite', storage: ':memory:', logging: false },
    })
    await expect(manager.getPlatforms()).rejects.toThrow('PROVIDER_NOT_DEPLOYED')
    await expect(manager.saveNonce('n')).rejects.toThrow('PROVIDER_NOT_DEPLOYED')
  })

  it('accepts an optional encryptionKey without requiring one', () => {
    expect(
      () =>
        new SequelizeLegacyDatabaseManager(createLogger(), {
          database: 'ltijs_test',
          options: { dialect: 'sqlite', storage: ':memory:', logging: false },
        }),
    ).not.toThrow()
  })
})
