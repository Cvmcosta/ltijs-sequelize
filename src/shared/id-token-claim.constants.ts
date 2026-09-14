// The LTI 1.3 / OIDC id_token claim URIs `ltijs` itself keys `IdTokenClaims`/`IdTokenRecord` by
// (`#services/launch/id-token.constants`'s `IdTokenClaim` enum internally) -- not part of `ltijs`'s public
// API surface, so this package keeps its own copy of the constant claim names it needs to read/write
// individual claims (splitting them across columns in `sequelize-legacy`, validating required top-level
// keys in both managers' zod schemas).
export const IdTokenClaim = {
  Iss: 'iss',
  Sub: 'sub',
  Aud: 'aud',
  Azp: 'azp',
  Exp: 'exp',
  Iat: 'iat',
  Nonce: 'nonce',
  GivenName: 'given_name',
  FamilyName: 'family_name',
  Name: 'name',
  Email: 'email',
  ClientId: 'client_id',
  PlatformId: 'platform_id',
  DeploymentId: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  MessageType: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  Version: 'https://purl.imsglobal.org/spec/lti/claim/version',
  Roles: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  RoleScopeMentor: 'https://purl.imsglobal.org/spec/lti/claim/role_scope_mentor',
  TargetLinkUri: 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
  ToolPlatform: 'https://purl.imsglobal.org/spec/lti/claim/tool_platform',
  Context: 'https://purl.imsglobal.org/spec/lti/claim/context',
  ResourceLink: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  LaunchPresentation: 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation',
  Custom: 'https://purl.imsglobal.org/spec/lti/claim/custom',
  Lis: 'https://purl.imsglobal.org/spec/lti/claim/lis',
  ForUser: 'https://purl.imsglobal.org/spec/lti/claim/for_user',
  Endpoint: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
  NamesRoleService: 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice',
  DeepLinkingSettings: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
} as const
