import { LtijsSequelizeError } from '../shared/errors'

// Independent of `../sequelize/errors.ts` by design -- `sequelize/` and `sequelize-legacy/` are fully
// isolated implementations, so no class is shared between them even though these error message strings
// are identical.

export class MissingDatabaseConfigError extends LtijsSequelizeError {
  constructor() {
    super('MISSING_DATABASE_CONFIG')
  }
}

export class ProviderNotDeployedError extends LtijsSequelizeError {
  constructor() {
    super('PROVIDER_NOT_DEPLOYED')
  }
}
