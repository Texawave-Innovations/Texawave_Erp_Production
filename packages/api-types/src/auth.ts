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

export interface MeUser {
  userId: number;
  organizationId: number;
  email: string;
  fullName: string;
  roleIds: number[];
  permissions: string[];
  /** True until the user changes their temporary password (TEXA-16 onboarding). */
  mustChangePassword: boolean;
}
