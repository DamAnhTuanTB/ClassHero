import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "#api/config/env.validation";
import * as fs from "fs";
import * as path from "path";

/** All artifacts downloaded from a single Mathpix PDF OCR job. */
export interface OcrArtifactBundle {
  /** Mathpix Markdown — page-by-page text with \newpage separator. */
  mmd: Buffer;
  /** Plain Markdown fallback from Mathpix. */
  md: Buffer;
  /** MMD ZIP — contains MMD + embedded images/figures. */
  mmdZip: Buffer;
  /** Per-line bounding boxes, confidence, type (text/math). */
  linesJson: Buffer;

  /** HTML ZIP — HTML + embedded images for future lesson viewer. */
  htmlZip: Buffer;
  /** Mathpix-assigned PDF ID. */
  pdfId: string;
  /** Number of pages detected. */
  numPages: number;
  /** Wall-clock processing time in milliseconds. */
  processingTimeMs: number;
}

interface MathpixStatusResponse {
  status: string;
  num_pages?: number;
  num_pages_completed?: number;
  percent_done?: number;
}

const MATHPIX_API_BASE = "https://api.mathpix.com";
export const MATHPIX_PDF_MODEL_VERSION = "mathpix-v3-pdf";
export const MATHPIX_OUTPUT_FORMATS = [
  "mmd",
  "mmd.zip",
  "lines.json",
  "md",
  "html.zip",
] as const;
export const MATHPIX_CONVERSION_FORMATS = ["mmd.zip", "md", "html.zip"] as const;

export type MathpixOutputFormat = (typeof MATHPIX_OUTPUT_FORMATS)[number];
export type MathpixConversionFormat = (typeof MATHPIX_CONVERSION_FORMATS)[number];

export type MathpixPdfOptions = {
  conversion_formats: Record<string, true | Record<string, unknown>>;
  languages: string[];
  include_page_data: true;
  enable_tables_fallback: true;
  page_separator?: string;
};

export function buildMathpixPdfOptions(languageHints: string[]): MathpixPdfOptions {
  return {
    conversion_formats: {
      "mmd.zip": true,
      "html.zip": true,
      md: true,
    },
    languages: languageHints,
    include_page_data: true,
    enable_tables_fallback: true,
    page_separator: "\\newpage",
  };
}

@Injectable()
export class MathpixOcrService {
  private readonly logger = new Logger(MathpixOcrService.name);
  private readonly appId: string;
  private readonly appKey: string;
  private readonly languageHints: string[];

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {
    this.appId = this.configService.get("MATHPIX_APP_ID", { infer: true }) ?? "";
    this.appKey = this.configService.get("MATHPIX_APP_KEY", { infer: true }) ?? "";
    const hints = this.configService.get("MATHPIX_LANGUAGE_HINTS", {
      infer: true,
    });
    this.languageHints = hints.split(",").map((h) => h.trim());
  }

  /**
   * Submit a PDF buffer for processing and return the Mathpix pdf_id.
   */
  async submitPdf(fileBuffer: Buffer, fileName: string): Promise<{ pdfId: string }> {
    const formData = new FormData();

    // Copy to a clean ArrayBuffer to avoid SharedArrayBuffer type conflict
    const ab = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([ab], { type: "application/pdf" });
    formData.append("file", blob, fileName);

    const options = buildMathpixPdfOptions(this.languageHints);

    formData.append("options_json", JSON.stringify(options));

    this.logger.log(
      `Submitting PDF "${fileName}" (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB) to Mathpix...`,
    );

    const response = await fetch(`${MATHPIX_API_BASE}/v3/pdf`, {
      method: "POST",
      headers: {
        app_id: this.appId,
        app_key: this.appKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Mathpix submit failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as unknown;
    const pdfId = isRecord(data) ? readString(data, "pdf_id") : null;

    if (!pdfId) {
      throw new Error(
        `Mathpix submit did not return pdf_id${summarizeMathpixSubmitResponse(data)}`,
      );
    }

    this.logger.log(`Mathpix accepted PDF, pdf_id=${pdfId}`);

    return { pdfId };
  }

  /**
   * Poll Mathpix until the PDF is fully processed.
   * Returns the final status response.
   */
  async pollUntilComplete(
    pdfId: string,
    timeoutMs = 15 * 60 * 1000,
    onProgress?: (progress: number) => void | Promise<void>,
  ): Promise<{ numPages: number }> {
    const startTime = Date.now();
    let pollInterval = 5_000; // start at 5s

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getStatus(pdfId);

      if (status.status === "completed") {
        this.logger.log(`Mathpix completed pdf_id=${pdfId}, pages=${status.num_pages}`);
        return { numPages: status.num_pages ?? 0 };
      }

      if (status.status === "error") {
        throw new Error(`Mathpix processing error for pdf_id=${pdfId}`);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      this.logger.debug(
        `Mathpix polling pdf_id=${pdfId}: status=${status.status}, ` +
          `pages=${status.num_pages_completed ?? "?"}/${status.num_pages ?? "?"}, ` +
          `${status.percent_done ?? 0}% done, elapsed=${elapsed}s`,
      );

      if (onProgress && typeof status.percent_done === "number") {
        await onProgress(status.percent_done);
      }

      await this.sleep(pollInterval);
      // Exponential backoff: 5s → 10s → 15s (cap)
      pollInterval = Math.min(pollInterval * 1.5, 15_000);
    }

    throw new Error(`Mathpix timeout after ${timeoutMs / 1000}s for pdf_id=${pdfId}`);
  }

  /**
   * Download a single text artifact (mmd, lines.json, md).
   */
  async downloadArtifact(pdfId: string, ext: string): Promise<Buffer> {
    const url = `${MATHPIX_API_BASE}/v3/pdf/${pdfId}.${ext}`;
    this.logger.debug(`Downloading Mathpix artifact: ${ext}`);

    const response = await fetch(url, {
      headers: {
        app_id: this.appId,
        app_key: this.appKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Mathpix download .${ext} failed (${response.status}): ${await response.text()}`,
      );
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Download all artifacts and return them as a bundle.
   */
  async downloadAllArtifacts(
    pdfId: string,
    numPages: number,
    processingStartTime: number,
  ): Promise<OcrArtifactBundle> {
    this.logger.log(`Downloading all artifacts for pdf_id=${pdfId}...`);

    const [mmd, md, mmdZip, linesJson, htmlZip] = await Promise.all([
      this.downloadArtifact(pdfId, "mmd"),
      this.downloadArtifact(pdfId, "md"),
      this.downloadArtifact(pdfId, "mmd.zip"),
      this.downloadArtifact(pdfId, "lines.json"),
      this.downloadArtifact(pdfId, "html.zip"),
    ]);

    const processingTimeMs = Date.now() - processingStartTime;

    this.logger.log(
      `All artifacts downloaded for pdf_id=${pdfId}: ` +
        `mmd=${(mmd.length / 1024).toFixed(0)}KB, ` +
        `md=${(md.length / 1024).toFixed(0)}KB, ` +
        `mmd.zip=${(mmdZip.length / 1024).toFixed(0)}KB, ` +
        `lines.json=${(linesJson.length / 1024).toFixed(0)}KB, ` +
        `html.zip=${(htmlZip.length / 1024).toFixed(0)}KB`,
    );

    if (
      this.configService.get("OCR_DEBUG_ARTIFACTS_ENABLED", { infer: true }) &&
      this.configService.get("NODE_ENV", { infer: true }) !== "production"
    ) {
      try {
        const debugDir = path.join(process.cwd(), "debug", "mathpix", pdfId);
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        fs.writeFileSync(path.join(debugDir, "artifact.mmd"), mmd);
        fs.writeFileSync(path.join(debugDir, "artifact.md"), md);
        fs.writeFileSync(path.join(debugDir, "artifact.mmd.zip"), mmdZip);
        fs.writeFileSync(path.join(debugDir, "artifact.lines.json"), linesJson);
        fs.writeFileSync(path.join(debugDir, "artifact.html.zip"), htmlZip);
        this.logger.log(`[DEBUG] Saved raw Mathpix artifacts to ${debugDir}`);
      } catch (error) {
        this.logger.error("Failed to save debug Mathpix artifacts", error);
      }
    }

    return {
      mmd,
      md,
      mmdZip,
      linesJson,
      htmlZip,
      pdfId,
      numPages,
      processingTimeMs,
    };
  }

  private async getStatus(pdfId: string): Promise<MathpixStatusResponse> {
    const response = await fetch(`${MATHPIX_API_BASE}/v3/pdf/${pdfId}`, {
      headers: {
        app_id: this.appId,
        app_key: this.appKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Mathpix status check failed (${response.status}): ${await response.text()}`,
      );
    }

    return response.json() as Promise<MathpixStatusResponse>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

function summarizeMathpixSubmitResponse(value: unknown) {
  if (!isRecord(value)) {
    return ": response body was not an object";
  }

  const error = readString(value, "error");
  const errorInfo = isRecord(value.error_info) ? value.error_info : null;
  const errorId = errorInfo ? readString(errorInfo, "id") : null;
  const errorMessage = errorInfo ? readString(errorInfo, "message") : null;
  const details = [errorId, errorMessage, error].filter(Boolean).join("; ");

  if (details) {
    return `: ${details}`;
  }

  return `: response keys=${Object.keys(value).join(",")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const raw = value[key];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}
