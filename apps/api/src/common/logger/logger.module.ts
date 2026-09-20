import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import type { IncomingMessage } from "node:http";

/**
 * Replaces Nest's default logger globally with structured JSON logging
 * (Docs/CODING_STANDARDS.md §8). `genReqId` becomes the request's
 * correlation ID — `TenancyInterceptor` copies it into the CLS store so
 * `AllExceptionsFilter` can put it in the error response body too. Never log
 * secrets: `redact` covers auth/cookie headers here; extend this list if a
 * new header/body field can carry one — never log request bodies containing
 * passwords/tokens directly.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>("NODE_ENV") === "production";
        return {
          pinoHttp: {
            level: config.get<string>("LOG_LEVEL", "info"),
            genReqId: (req: IncomingMessage): string => {
              const header = req.headers["x-correlation-id"];
              return (
                (Array.isArray(header) ? header[0] : header) ?? randomUUID()
              );
            },
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers['set-cookie']",
              ],
              censor: "[redacted]",
            },
            // Spread rather than `transport: isProduction ? undefined : {...}`
            // — with exactOptionalPropertyTypes, an explicit `undefined`
            // value is not the same as the key being absent.
            ...(isProduction
              ? {}
              : {
                  transport: {
                    target: "pino-pretty",
                    options: { singleLine: true },
                  },
                }),
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
