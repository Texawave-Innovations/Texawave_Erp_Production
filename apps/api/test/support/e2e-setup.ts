import { resolve } from "node:path";
import { assessE2eEnvironment, explain, readDotenv } from "./e2e-guard.js";

// Environment variables set in the shell win over apps/api/.env (that is how
// ConfigModule loads them), so evaluate the same effective values.
const dotenv = readDotenv(resolve(process.cwd(), ".env"));
const assessment = assessE2eEnvironment({
  CI: process.env.CI,
  DATABASE_URL: process.env.DATABASE_URL ?? dotenv.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL ?? dotenv.REDIS_URL,
  ALLOW_E2E_ON_SHARED_DB: process.env.ALLOW_E2E_ON_SHARED_DB,
});

if (!assessment.ok) {
  throw new Error(explain(assessment.problems));
}
