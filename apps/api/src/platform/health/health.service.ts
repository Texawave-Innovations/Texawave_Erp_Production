import { Injectable } from "@nestjs/common";
import { HealthRepository } from "./health.repository.js";

export interface HealthStatus {
  status: "ok" | "error";
  db: "ok" | "unreachable";
  redis: "ok" | "unreachable";
}

@Injectable()
export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async check(): Promise<HealthStatus> {
    const [dbOk, redisOk] = await Promise.all([
      this.repository.pingDb(),
      this.repository.pingRedis(),
    ]);
    return {
      status: dbOk && redisOk ? "ok" : "error",
      db: dbOk ? "ok" : "unreachable",
      redis: redisOk ? "ok" : "unreachable",
    };
  }
}
