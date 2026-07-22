/**
 * M4.4 Live E2E Test Script
 *
 * Gọi trực tiếp MathpixOcrService + PdfMetadataService + OcrArtifactCacheService
 * để test full flow: PDF → Mathpix → download artifacts → cache → quality score.
 *
 * Usage: npx tsx apps/api/test/m4.4-live-e2e.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

// Load env from apps/api/.env
config({ path: resolve(__dirname, "../.env") });

async function main() {
  const appId = process.env.MATHPIX_APP_ID;
  const appKey = process.env.MATHPIX_APP_KEY;
  const ocrEnabled = process.env.OCR_PAID_ENABLED;

  console.log("=== M4.4 Live E2E Test ===\n");
  console.log(`OCR_PAID_ENABLED: ${ocrEnabled}`);
  console.log(`MATHPIX_APP_ID: ${appId ? appId.substring(0, 8) + "..." : "NOT SET"}`);
  console.log(`MATHPIX_APP_KEY: ${appKey ? "***" + appKey.slice(-4) : "NOT SET"}`);
  console.log("");

  if (!appId || !appKey || ocrEnabled !== "true") {
    console.error("❌ Mathpix keys not configured or OCR not enabled.");
    console.error(
      "   Set MATHPIX_APP_ID, MATHPIX_APP_KEY and OCR_PAID_ENABLED=true in apps/api/.env",
    );
    process.exit(1);
  }

  // --- 1. PDF Metadata ---
  console.log("--- Step 1: PDF Metadata ---");
  const pdfPath = resolve(__dirname, "Toan-7-Tap-1-lam-net.pdf");
  const pdfBuffer = readFileSync(pdfPath);
  console.log(`PDF file: ${pdfPath}`);
  console.log(`PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB`);

  const { PdfMetadataService } =
    await import("../src/workers/services/pdf-metadata.service");
  const pdfMeta = new PdfMetadataService();

  const contentHash = pdfMeta.computeContentHash(pdfBuffer);
  console.log(`Content hash: ${contentHash.substring(0, 16)}...`);

  // Clone buffer because pdf-parse detaches the underlying ArrayBuffer
  const pdfBufferForMetadata = Buffer.from(pdfBuffer);
  const pageCount = await pdfMeta.getPageCount(pdfBufferForMetadata);
  console.log(`Page count: ${pageCount}`);
  console.log("");

  // --- 2. Submit to Mathpix (chỉ dùng 5 trang đầu để tiết kiệm) ---
  console.log("--- Step 2: Submit to Mathpix ---");
  console.log("⚠️  Submitting FULL PDF — this will cost Mathpix credits.");
  console.log("    Waiting for processing...\n");

  // Use native fetch API calls directly (không cần NestJS DI)
  const MATHPIX_API = "https://api.mathpix.com";

  const submitFormData = new FormData();
  const ab = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength,
  ) as ArrayBuffer;
  submitFormData.append(
    "file",
    new Blob([ab], { type: "application/pdf" }),
    "Toan-7-Tap-1-lam-net.pdf",
  );
  submitFormData.append(
    "options_json",
    JSON.stringify({
      conversion_formats: {
        "mmd.zip": true,
        md: true,
        "html.zip": true,
      },
      languages: ["vi", "en"],
      include_page_data: true,
      enable_tables_fallback: true,
    }),
  );

  const submitRes = await fetch(`${MATHPIX_API}/v3/pdf`, {
    method: "POST",
    headers: { app_id: appId, app_key: appKey },
    body: submitFormData,
  });

  if (!submitRes.ok) {
    console.error(`❌ Submit failed (${submitRes.status}): ${await submitRes.text()}`);
    process.exit(1);
  }

  const { pdf_id: pdfId } = (await submitRes.json()) as { pdf_id: string };
  console.log(`✅ Submitted! pdf_id = ${pdfId}`);

  // --- 3. Poll ---
  console.log("\n--- Step 3: Polling ---");
  const startTime = Date.now();
  let pollInterval = 5000;

  while (true) {
    const statusRes = await fetch(`${MATHPIX_API}/v3/pdf/${pdfId}`, {
      headers: { app_id: appId, app_key: appKey },
    });
    const status = (await statusRes.json()) as {
      status: string;
      num_pages?: number;
      num_pages_completed?: number;
      percent_done?: number;
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `  [${elapsed}s] status=${status.status}, ` +
        `pages=${status.num_pages_completed ?? "?"}/${status.num_pages ?? "?"}, ` +
        `${status.percent_done ?? 0}% done`,
    );

    if (status.status === "completed") {
      console.log(`\n✅ Processing complete! ${status.num_pages} pages in ${elapsed}s`);
      break;
    }

    if (status.status === "error") {
      console.error("❌ Mathpix processing error!");
      process.exit(1);
    }

    if (Date.now() - startTime > 15 * 60 * 1000) {
      console.error("❌ Timeout after 15 minutes!");
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval * 1.5, 15000);
  }

  // --- 4. Download artifacts ---
  console.log("\n--- Step 4: Download Artifacts ---");
  const artifacts = ["mmd", "mmd.zip", "lines.json", "md", "html.zip"];

  for (const ext of artifacts) {
    const res = await fetch(`${MATHPIX_API}/v3/pdf/${pdfId}.${ext}`, {
      headers: { app_id: appId, app_key: appKey },
    });

    if (!res.ok) {
      console.error(`❌ Failed to download .${ext}: ${res.status}`);
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`  ✅ .${ext}: ${(buf.length / 1024).toFixed(0)} KB`);

    // Print first 300 chars of text artifacts
    if (ext === "mmd" || ext === "md") {
      const text = buf.toString("utf8");
      console.log(`     Preview: ${text.substring(0, 300).replace(/\n/g, "\\n")}...`);

      // Count pages (\\newpage separators) for mmd
      if (ext === "mmd") {
        const pages = text.split("\\newpage");
        console.log(`     Pages detected: ${pages.length}`);
      }
    }

    // Parse lines.json summary
    if (ext === "lines.json") {
      try {
        const parsed = JSON.parse(buf.toString("utf8"));
        const structure = Array.isArray(parsed)
          ? `array of ${parsed.length} items`
          : `object with keys: ${Object.keys(parsed).join(", ")}`;
        console.log(`     Structure: ${structure}`);
      } catch {
        console.log(`     (binary/unparseable)`);
      }
    }
  }

  // --- 5. Quality scoring sample ---
  console.log("\n--- Step 5: Quality Scoring (first 3 pages) ---");
  const { scorePageQuality } = await import("../src/workers/utils/quality-score");

  const mmdRes = await fetch(`${MATHPIX_API}/v3/pdf/${pdfId}.mmd`, {
    headers: { app_id: appId, app_key: appKey },
  });
  const mmdText = await mmdRes.text();
  const mmdPages = mmdText.split("\\newpage");

  for (let i = 0; i < Math.min(3, mmdPages.length); i++) {
    const pageText = mmdPages[i]!.trim();
    const score = scorePageQuality(pageText);
    console.log(`  Page ${i + 1}: score=${score}, length=${pageText.length} chars`);
    if (pageText.length > 0) {
      console.log(`    Preview: ${pageText.substring(0, 150).replace(/\n/g, "\\n")}...`);
    }
  }

  console.log("\n=== ✅ E2E Test Complete ===");
  console.log(`pdf_id: ${pdfId}`);
  console.log(`Total time: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
  console.log(`Content hash: ${contentHash.substring(0, 16)}...`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
