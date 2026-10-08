import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  const corsOrigin = config.getOrThrow<string>("CORS_ORIGIN");
  const allowedOrigins = corsOrigin.includes(",")
    ? corsOrigin.split(",").map((s) => s.trim())
    : [corsOrigin.trim()];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      const isAllowed =
        allowedOrigins.includes(origin) ||
        (config.get<string>("NODE_ENV") !== "production" &&
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
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
