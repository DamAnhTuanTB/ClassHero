import { z } from "zod";

import { EMBEDDING_VECTOR_DIMENSIONS } from "#api/config/ai.constants";

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
    OCR_PROVIDER: z.enum(["mathpix"]).default("mathpix"),
    OCR_PAID_ENABLED: z.coerce.boolean().default(false),
    OCR_ARTIFACT_CACHE_ENABLED: z.coerce.boolean().default(true),
    OCR_ARTIFACT_PREFIX: z.string().min(1).default("ocr-artifacts"),
    MATHPIX_APP_ID: z.string().min(1).optional(),
    MATHPIX_APP_KEY: z.string().min(1).optional(),
    MATHPIX_LANGUAGE_HINTS: z.string().default("vi,en"),
    OCR_MAX_CONCURRENT_DOCUMENTS: z.coerce.number().int().positive().default(2),
    OCR_MONTHLY_BUDGET_VND: z.coerce.number().int().nonnegative().default(1000000),
    OCR_ALLOW_FREE_FALLBACK: z.coerce.boolean().default(false),
    OCR_DEBUG_ARTIFACTS_ENABLED: z.coerce.boolean().default(false),

    // OpenAI
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_STRUCTURED_MODEL: z.string().min(1).default("gpt-4.1-mini"),
    OPENAI_CHAT_MODEL: z.string().min(1).default("gpt-4.1-mini"),
    OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
    OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

    // Gemini
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_STRUCTURED_MODEL: z.string().min(1).default("gemini-2.5-flash"),
    GEMINI_CHAT_MODEL: z.string().min(1).default("gemini-2.5-flash"),

    // AI budget/rate limit
    AI_PROVIDER_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(60_000),
    AI_GENERATION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(1_800_000)
      .default(600_000),
    AI_SUMMARY_SCHEMA_REFS_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
    AI_SUMMARY_SCHEMA_REFS_V2_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
    AI_SUMMARY_PROMPT_CACHE_KEY_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
    AI_SUMMARY_PROMPT_CACHE_RETENTION: z
      .enum(["in_memory", "24h"])
      .default("in_memory"),
    AI_MONTHLY_BUDGET_VND: z.coerce.number().int().nonnegative().default(1500000),
    AI_STUDENT_CHAT_DAILY_LIMIT: z.coerce.number().int().positive().default(20),
    AI_STUDENT_GENERATE_DAILY_LIMIT: z.coerce.number().int().positive().default(5),

    // payOS
    PAYOS_CLIENT_ID: z.string().min(1).optional(),
    PAYOS_API_KEY: z.string().min(1).optional(),
    PAYOS_CHECKSUM_KEY: z.string().min(1).optional(),
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

    if (env.OCR_PAID_ENABLED) {
      if (!env.MATHPIX_APP_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["MATHPIX_APP_ID"],
          message: "MATHPIX_APP_ID is required when OCR_PAID_ENABLED is true.",
        });
      }

      if (!env.MATHPIX_APP_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["MATHPIX_APP_KEY"],
          message: "MATHPIX_APP_KEY is required when OCR_PAID_ENABLED is true.",
        });
      }
    }

    if (env.OPENAI_EMBEDDING_DIMENSIONS !== EMBEDDING_VECTOR_DIMENSIONS) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENAI_EMBEDDING_DIMENSIONS"],
        message:
          `OPENAI_EMBEDDING_DIMENSIONS must be ${EMBEDDING_VECTOR_DIMENSIONS} ` +
          "to match document_chunks.embedding vector(1536). Create a database migration before changing dimensions.",
      });
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
