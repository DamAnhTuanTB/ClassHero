import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type { RetrievedChunk } from "#api/modules/ai/types/ai-text.types";

import type { MathDiagramLiveGateBLesson } from "./live-gate-b-lessons";

export type MathDiagramLiveGateBSourceEvidence = {
  readerPage: number;
  evidenceUrl: string;
  localImagePath: string;
  localOcrPath: string;
  imageSha256: string;
  ocrSha256: string;
  ocrCharacters: number;
};

export type MathDiagramLiveGateBPreparedSource = {
  chunks: RetrievedChunk[];
  evidence: MathDiagramLiveGateBSourceEvidence[];
};

export async function prepareOfficialReaderSource(input: {
  lesson: MathDiagramLiveGateBLesson;
  repositoryRoot: string;
}): Promise<MathDiagramLiveGateBPreparedSource> {
  const sourceDirectory = path.join(
    input.repositoryRoot,
    "tmp/m9-2-v51-live-gate-b/sources",
    input.lesson.caseId,
  );
  mkdirSync(sourceDirectory, { recursive: true });

  const htmlPath = path.join(sourceDirectory, "official-reader.html");
  const html = existsSync(htmlPath)
    ? readFileSync(htmlPath, "utf8")
    : await downloadText(input.lesson.officialReaderUrl, htmlPath);
  const pageUrls = extractOfficialReaderPageUrls(html);
  const missingPages = input.lesson.readerPages.filter((page) => !pageUrls.has(page));
  if (missingPages.length > 0) {
    throw new Error(
      `${input.lesson.caseId} is missing official reader pages: ${missingPages.join(", ")}.`,
    );
  }

  const evidence: MathDiagramLiveGateBSourceEvidence[] = [];
  const chunks: RetrievedChunk[] = [];
  for (const readerPage of input.lesson.readerPages) {
    const evidenceUrl = pageUrls.get(readerPage);
    if (!evidenceUrl) throw new Error(`Missing evidence URL for reader page ${readerPage}.`);
    const imagePath = path.join(sourceDirectory, `reader-page-${readerPage}.png`);
    const ocrPath = path.join(sourceDirectory, `reader-page-${readerPage}.txt`);
    if (!existsSync(imagePath)) await downloadBinary(evidenceUrl, imagePath);
    if (!existsSync(ocrPath)) {
      const ocr = execFileSync(
        "tesseract",
        [imagePath, "stdout", "-l", "vie+eng", "--psm", "6"],
        { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      ).trim();
      writeAtomic(ocrPath, `${ocr}\n`);
    }
    const image = readFileSync(imagePath);
    const ocr = readFileSync(ocrPath, "utf8").trim();
    if (ocr.length < 80) {
      throw new Error(
        `${input.lesson.caseId} reader page ${readerPage} produced only ${ocr.length} OCR characters.`,
      );
    }
    const chunkId = stableUuid(`${input.lesson.caseId}:reader-page:${readerPage}`);
    chunks.push({
      id: chunkId,
      content: ocr,
      metadata: {
        sourceFile: `${input.lesson.referenceId}-reader-page-${readerPage}.png`,
        readerPage,
        officialReaderUrl: input.lesson.officialReaderUrl,
        evidenceUrl,
        referenceId: input.lesson.referenceId,
      },
    });
    evidence.push({
      readerPage,
      evidenceUrl,
      localImagePath: path.relative(input.repositoryRoot, imagePath),
      localOcrPath: path.relative(input.repositoryRoot, ocrPath),
      imageSha256: createHash("sha256").update(image).digest("hex"),
      ocrSha256: createHash("sha256").update(ocr).digest("hex"),
      ocrCharacters: ocr.length,
    });
  }
  return { chunks, evidence };
}

export function extractOfficialReaderPageUrls(html: string) {
  const urls = html.match(
    /https:\/\/cdn3\.olm\.vn\/[^"'<>\s]+-page-\d+-[^"'<>\s]+\.png/gu,
  );
  const pageUrls = new Map<number, string>();
  for (const url of urls ?? []) {
    const match = url.match(/-page-(\d+)-/u);
    if (!match) continue;
    const page = Number(match[1]);
    if (!pageUrls.has(page)) pageUrls.set(page, url);
  }
  return pageUrls;
}

export function stableUuid(seed: string) {
  const hash = createHash("sha256").update(seed).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

async function downloadText(url: string, destination: string) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}.`);
  const text = await response.text();
  writeAtomic(destination, text);
  return text;
}

async function downloadBinary(url: string, destination: string) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const temporaryPath = `${destination}.tmp`;
  writeFileSync(temporaryPath, buffer);
  renameSync(temporaryPath, destination);
}

function writeAtomic(destination: string, value: string) {
  const temporaryPath = `${destination}.tmp`;
  writeFileSync(temporaryPath, value, "utf8");
  renameSync(temporaryPath, destination);
}
