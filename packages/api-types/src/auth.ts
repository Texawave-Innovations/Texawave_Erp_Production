// HANDWRITTEN — mirrors apps/api/src/platform/auth/dto and auth.service.ts's
// AuthTokens interface. See packages/api-types/README.md.

export interface LoginInput {
  organizationSlug: string;
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
