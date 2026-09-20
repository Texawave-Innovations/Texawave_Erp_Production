export interface AccessTokenPayload {
  sub: string;
  organizationId: string;
  roleIds: string[];
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}
