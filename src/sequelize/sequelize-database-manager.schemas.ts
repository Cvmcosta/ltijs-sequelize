import { z } from 'zod'
import { IdTokenValidationMethod, LtiMessageType } from 'ltijs'
import { IdTokenClaim } from '../shared/id-token-claim.constants'

// `SequelizeDatabaseManager`'s own validation of what it reads back out of the database, against the
// public `PlatformRecord`/`AccessTokenRecord`/`IdTokenRecord` shapes `ltijs` itself exports.

export const IdTokenValidationSchema = z.object({
  method: z.enum(IdTokenValidationMethod),
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
    [IdTokenClaim.MessageType]: z.enum(LtiMessageType),
    [IdTokenClaim.Version]: z.string(),
    [IdTokenClaim.Roles]: z.array(z.string()),
  })
  // Platforms/tools may attach further custom claims beyond the ones validated above.
  .loose()
