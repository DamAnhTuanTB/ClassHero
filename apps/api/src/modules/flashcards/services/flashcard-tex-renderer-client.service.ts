import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvConfig } from "#api/config/env.validation";

export type FlashcardTexRendererResult =
  | { ok: true; svg: string; log: string; durationMs: number; rendererVersion: string }
  | {
      ok: false;
      code: string;
      log: string;
      issues: Array<{ code: string; message: string }>;
    };

@Injectable()
export class FlashcardTexRendererClientService {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async render(
    latexSource: string,
    subjectKey: string,
  ): Promise<FlashcardTexRendererResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get("TEX_RENDER_REQUEST_TIMEOUT_MS", { infer: true }),
    );
    try {
      const response = await fetch(
        new URL("/render", this.config.get("TEX_RENDERER_URL", { infer: true })),
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.config.get("TEX_RENDERER_TOKEN", { infer: true })}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ latexSource, subjectKey }),
          signal: controller.signal,
        },
      );
      const data = (await response.json()) as Record<string, unknown>;
      if (data.ok === true && typeof data.svg === "string") {
        return {
          ok: true,
          svg: data.svg,
          log: typeof data.log === "string" ? data.log : "",
          durationMs: typeof data.durationMs === "number" ? data.durationMs : 0,
          rendererVersion:
            typeof data.rendererVersion === "string"
              ? data.rendererVersion
              : "unknown",
        };
      }
      return {
        ok: false,
        code:
          typeof data.code === "string"
            ? data.code
            : "FLASHCARD_TEX_BAD_RESPONSE",
        log: typeof data.log === "string" ? data.log : "Renderer returned no log.",
        issues: readIssues(data.issues),
      };
    } catch (error) {
      return {
        ok: false,
        code:
          error instanceof DOMException && error.name === "AbortError"
            ? "FLASHCARD_TEX_REQUEST_TIMEOUT"
            : "FLASHCARD_TEX_RENDERER_UNAVAILABLE",
        log: error instanceof Error ? error.message : String(error),
        issues: [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function readIssues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    return typeof record.code === "string" && typeof record.message === "string"
      ? [{ code: record.code, message: record.message }]
      : [];
  });
}
