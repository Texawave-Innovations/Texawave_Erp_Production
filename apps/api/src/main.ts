import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  // request.ip (used by the office-network check and the audit trail) reads
  // X-Forwarded-For only for the configured number of proxy hops.
  app.set("trust proxy", config.getOrThrow<number>("TRUST_PROXY_HOPS"));

  app.enableCors({
    origin: config.getOrThrow<string>("CORS_ORIGIN"),
    credentials: true,
  });

  // Global request validation is registered as an APP_PIPE in AppModule
  // itself (not here) so tests that boot AppModule directly get identical
  // behavior — see app.module.ts.

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("TexaWave ERP API")
      .setDescription(
        "Foundation + reference feature only — see Docs/ARCHITECTURE.md for what's implemented vs. planned.",
      )
      .setVersion("0.0.1")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, swaggerDocument);

  const port = config.getOrThrow<number>("PORT");
  await app.listen(port);
}
await bootstrap();
