export interface AccessTokenPayload {
  sub: number;
  organizationId: number;
  roleIds: number[];
  type: "access";
}

export interface RefreshTokenPayload {
  sub: number;
  jti: string;
  type: "refresh";
}
