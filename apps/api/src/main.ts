import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "#api/app.module";
import { ApiResponseInterceptor } from "#api/common/api/api-response.interceptor";
import { HttpExceptionFilter } from "#api/common/errors/http-exception.filter";
import { createValidationException } from "#api/common/validation/validation-error";
import { EnvConfig, parseCorsOrigins } from "#api/config/env.validation";
import { setupSwagger } from "#api/config/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService<EnvConfig, true>);
  const logger = new Logger("Bootstrap");
  const nodeEnv = configService.get("NODE_ENV", { infer: true });
  const appName = configService.get("APP_NAME", { infer: true });
  const port = configService.get("API_PORT", { infer: true });
  const corsOrigins = parseCorsOrigins(
    configService.get("CORS_ORIGINS", { infer: true }),
  );

  app.useLogger(getLoggerLevels(configService.get("LOG_LEVEL", { infer: true })));
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: createValidationException,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  if (nodeEnv !== "production") {
    setupSwagger(app, appName);
    logger.log(`Swagger docs available at /api/docs`);
  }

  await app.listen(port, "0.0.0.0");
  logger.log(`${appName} API listening on port ${port}`);
}

function getLoggerLevels(logLevel: EnvConfig["LOG_LEVEL"]) {
  const levels = {
    error: ["error"],
    warn: ["error", "warn"],
    log: ["error", "warn", "log"],
    debug: ["error", "warn", "log", "debug"],
    verbose: ["error", "warn", "log", "debug", "verbose"],
  } as const;

  return [...levels[logLevel]];
}

void bootstrap();
