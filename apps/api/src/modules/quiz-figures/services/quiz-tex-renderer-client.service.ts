import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvConfig } from "#api/config/env.validation";

export type QuizTexRendererResult =
  | { ok: true; svg: string; log: string; durationMs: number; rendererVersion: string }
  | {
      ok: false;
      category: "SOURCE" | "INFRASTRUCTURE";
      code: string;
      log: string;
      durationMs?: number;
      rendererVersion?: string;
    };

@Injectable()
export class QuizTexRendererClientService {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async render(latexSource: string, subjectKey: string): Promise<QuizTexRendererResult> {
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
            typeof data.rendererVersion === "string" ? data.rendererVersion : "unknown",
        };
      }
      return {
        ok: false,
        category: data.category === "SOURCE" ? "SOURCE" : "INFRASTRUCTURE",
        code: typeof data.code === "string" ? data.code : "QUIZ_TEX_BAD_RESPONSE",
        log: typeof data.log === "string" ? data.log : "Renderer returned no log.",
        durationMs: typeof data.durationMs === "number" ? data.durationMs : undefined,
        rendererVersion:
          typeof data.rendererVersion === "string" ? data.rendererVersion : undefined,
      };
    } catch (error) {
      return {
        ok: false,
        category: "INFRASTRUCTURE",
        code:
          error instanceof DOMException && error.name === "AbortError"
            ? "QUIZ_TEX_REQUEST_TIMEOUT"
            : "QUIZ_TEX_RENDERER_UNAVAILABLE",
        log: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
