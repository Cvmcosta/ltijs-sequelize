import { z } from 'zod'
import { IdTokenClaim } from '../shared/id-token-claim.constants'

// `SequelizeLegacyDatabaseManager`'s own validation of what it reads back out of the database, against
// the public `PlatformRecord`/`AccessTokenRecord`/`IdTokenRecord` shapes `ltijs` itself exports.
// Independent of `../sequelize/sequelize-database-manager.schemas.ts` by design (see the isolation note in
// `database-schemas.ts`). `idTokenValidation.method` stays a plain string here, not the stricter
// `IdTokenValidationMethod` enum the fresh manager validates against -- real v2 data predates that enum
// and isn't guaranteed to match its casing/values exactly.

export const IdTokenValidationSchema = z.object({
  method: z.string(),
  key: z.string(),
})

export const PlatformKeysSchema = z.object({
  public: z.string(),
  private: z.string(),
})

export const PlatformRecordSchema = z.object({
  id: z.string(),
  url: z.string(),
  clientId: z.string(),
  name: z.string(),
  authenticationEndpoint: z.string(),
  accessTokenEndpoint: z.string(),
  authorizationServer: z.string().optional(),
  idTokenValidation: IdTokenValidationSchema,
  active: z.boolean(),
  keys: PlatformKeysSchema,
})

export const AccessTokenRecordSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string().optional(),
  createdAt: z.number(),
})

export const IdTokenRecordSchema = z
  .object({
    id: z.string(),
    [IdTokenClaim.Iss]: z.string(),
    [IdTokenClaim.Sub]: z.string(),
    [IdTokenClaim.ClientId]: z.string(),
    [IdTokenClaim.PlatformId]: z.string(),
    [IdTokenClaim.DeploymentId]: z.string(),
  })
  // Real legacy `contexttoken` rows don't reliably have message_type/version/roles/target_link_uri set
  // (see `toIdTokenRecord`'s own note) -- loose rather than requiring every field this schema could
  // validate, unlike the fresh manager's stricter schema.
  .loose()
