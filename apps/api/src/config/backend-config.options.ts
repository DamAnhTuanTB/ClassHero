import { resolve } from "node:path";
import type { ConfigModuleOptions } from "@nestjs/config";

import { validateEnv } from "#api/config/env.validation";

const apiEnvFile = resolve(__dirname, "../..", ".env");

/**
 * API and worker share one backend env source owned by apps/api.
 * Deployed processes may still override file values through process.env.
 */
export const BACKEND_CONFIG_MODULE_OPTIONS = {
  isGlobal: true,
  envFilePath: apiEnvFile,
  validate: validateEnv,
} satisfies ConfigModuleOptions;
