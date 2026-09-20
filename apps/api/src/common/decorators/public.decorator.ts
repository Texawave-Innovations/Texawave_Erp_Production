import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as not requiring `JwtAuthGuard` — e.g. `POST /auth/login`,
 * `GET /health`. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
