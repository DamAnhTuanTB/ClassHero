import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    APP_NAME: z.string().min(1).default("learning-path-mvp"),
    WEB_URL: z.string().url(),
    API_URL: z.string().url(),
    API_PORT: z.coerce.number().int().positive().max(65535).default(4000),
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    JWT_ACCESS_SECRET: z.string().min(8),
    JWT_REFRESH_SECRET: z.string().min(8),
    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("30d"),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("30d"),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().email().optional(),
    REDIS_URL: z.string().min(1),
    WORKER_CONCURRENCY_AI: z.coerce.number().int().positive().default(2),
    WORKER_CONCURRENCY_DOCUMENT: z.coerce.number().int().positive().default(1),
    WORKER_CONCURRENCY_NOTIFICATION: z.coerce.number().int().positive().default(3),
    CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["error", "warn", "log", "debug", "verbose"]).default("debug"),
    FILE_STORAGE_PROVIDER: z
      .enum(["minio_local", "cloudflare_r2"])
      .default("minio_local"),
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1).default("auto"),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET_NAME: z.string().min(1),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
    FILE_PUBLIC_BASE_URL: z.string().url().optional().or(z.literal("")),
    FILE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    MAX_PDF_UPLOAD_MB: z.coerce.number().positive().default(50),
    MAX_IMAGE_UPLOAD_MB: z.coerce.number().positive().default(10),
    MAX_AVATAR_UPLOAD_MB: z.coerce.number().positive().default(5),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      const unsafeSecretValues = new Set([
        "change-me",
        "changeme",
        "development",
        "secret",
      ]);

      if (unsafeSecretValues.has(env.JWT_ACCESS_SECRET)) {
        ctx.addIssue({
          code: "custom",
          path: ["JWT_ACCESS_SECRET"],
          message: "JWT_ACCESS_SECRET must be changed in production.",
        });
      }

      if (unsafeSecretValues.has(env.JWT_REFRESH_SECRET)) {
        ctx.addIssue({
          code: "custom",
          path: ["JWT_REFRESH_SECRET"],
          message: "JWT_REFRESH_SECRET must be changed in production.",
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
