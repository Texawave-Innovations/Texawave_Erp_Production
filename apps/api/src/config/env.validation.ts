import { z } from "zod";

/**
 * Typed, validated environment (Docs/CODING_STANDARDS.md / Phase 6). Fails
 * fast at startup with a clear message instead of a runtime `undefined` a
 * hundred requests later. Every var the app actually reads must be declared
 * here — see apps/api/.env.example for the full list with comments.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60),

  CORS_ORIGIN: z.string().default("http://localhost:3001"),

  // How many reverse-proxy hops sit in front of the API. 0 = trust the socket
  // address only (the safe default). Set it to the real hop count in each
  // deployment. Too high lets a client forge X-Forwarded-For and pass the
  // office-network check.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  APP_BASE_URL: z.url().default("http://localhost:3001"),

  // Optional: when unset, MailerService falls back to logging the reset link
  // instead of sending it — keeps local dev/e2e working without real Gmail
  // credentials (see apps/api/src/platform/auth/mailer.service.ts).
  // GMAIL_APP_PASSWORD is a 16-char App Password (Google Account > Security >
  // App passwords), never the account's real login password.
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),

  // AES-256-GCM key for encrypting sensitive onboarding fields (bank account
  // numbers — apps/api/src/shared/crypto/field-encryption.service.ts).
  // 64 hex characters = 32 bytes. Generate with: openssl rand -hex 32
  // Local-disk root for employee document uploads (shared/file-storage). Back
  // this folder up together with the database — rows point at these files.
  UPLOAD_DIR: z.string().min(1).default("storage/uploads"),

  FIELD_ENCRYPTION_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      "FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
    ),
});

export type Env = z.infer<typeof envSchema>;

/** Passed to `ConfigModule.forRoot({ validate })`. Throws on startup (not on
 * first use) if the environment is invalid or incomplete. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
