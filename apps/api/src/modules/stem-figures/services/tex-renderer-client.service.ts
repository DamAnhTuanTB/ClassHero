import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvConfig } from "#api/config/env.validation";
import type { LessonSummarySubjectKey } from "#api/modules/ai/types/lesson-summary-subject.types";
import type { TexRendererResult } from "#api/modules/stem-figures/types/tex-renderer.types";

@Injectable()
export class TexRendererClientService {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async render(
    latexSource: string,
    subjectKey: LessonSummarySubjectKey = "GENERAL",
  ): Promise<TexRendererResult> {
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
        code: typeof data.code === "string" ? data.code : "TEX_RENDERER_BAD_RESPONSE",
        log: typeof data.log === "string" ? data.log : "Renderer returned no log.",
        durationMs: typeof data.durationMs === "number" ? data.durationMs : undefined,
        rendererVersion:
          typeof data.rendererVersion === "string" ? data.rendererVersion : undefined,
        issues: readIssues(data.issues),
        collectionComplete: data.collectionComplete !== false,
      };
    } catch (error) {
      return {
        ok: false,
        category: "INFRASTRUCTURE",
        code:
          error instanceof DOMException && error.name === "AbortError"
            ? "TEX_RENDERER_REQUEST_TIMEOUT"
            : "TEX_RENDERER_UNAVAILABLE",
        log: error instanceof Error ? error.message : String(error),
        issues: [],
        collectionComplete: false,
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
    if (typeof record.code !== "string" || typeof record.message !== "string") {
      return [];
    }
    return [
      {
        code: record.code,
        severity: record.severity === "WARNING" ? ("WARNING" as const) : ("ERROR" as const),
        message: record.message,
        file: typeof record.file === "string" ? record.file : null,
        line: typeof record.line === "number" ? record.line : null,
        column: typeof record.column === "number" ? record.column : null,
        element: typeof record.element === "string" ? record.element : null,
        path: typeof record.path === "string" ? record.path : null,
      },
    ];
  });
}
