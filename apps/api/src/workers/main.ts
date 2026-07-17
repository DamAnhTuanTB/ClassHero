import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { EnvConfig } from "#api/config/env.validation";
import { WorkerModule } from "#api/workers/worker.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService<EnvConfig, true>);
  const logger = new Logger("WorkerBootstrap");
  const appName = configService.get("APP_NAME", { infer: true });

  app.useLogger(getLoggerLevels(configService.get("LOG_LEVEL", { infer: true })));
  logger.log(`${appName} worker context started`);

  let isClosing = false;
  const shutdown = async (signal: string) => {
    if (isClosing) {
      return;
    }

    isClosing = true;
    logger.log(`Received ${signal}, closing worker context`);
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
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
