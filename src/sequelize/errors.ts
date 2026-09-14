import { LtijsSequelizeError } from '../shared/errors'

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
