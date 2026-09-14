import type { Logger } from 'ltijs'
import { SequelizeDatabaseManager } from './sequelize-database-manager.service'

function createLogger(): Logger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}

describe('SequelizeDatabaseManager', () => {
  it('throws MissingDatabaseConfigError without a database or sequelize instance', () => {
    expect(() => new SequelizeDatabaseManager(createLogger(), {})).toThrow('MISSING_DATABASE_CONFIG')
  })

  it('throws ProviderNotDeployedError when a data method is called before listen()', async () => {
    const manager = new SequelizeDatabaseManager(createLogger(), {
      database: 'ltijs_test',
      options: { dialect: 'sqlite', storage: ':memory:', logging: false },
    })
    await expect(manager.getPlatforms()).rejects.toThrow('PROVIDER_NOT_DEPLOYED')
    await expect(manager.saveNonce('n')).rejects.toThrow('PROVIDER_NOT_DEPLOYED')
  })
})
