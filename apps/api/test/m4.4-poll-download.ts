/**
 * Poll + Download artifacts from existing Mathpix pdf_id
 */
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../.env") });

const appId = process.env.MATHPIX_APP_ID!;
const appKey = process.env.MATHPIX_APP_KEY!;
const MATHPIX_API = "https://api.mathpix.com";
const PDF_ID = "ae177c55-83dc-4c94-a8f8-73b2c5ae18af";

interface MathpixPollStatus {
  status?: string;
  num_pages?: number;
  num_pages_completed?: number;
  percent_done?: number;
  conversion_status?: unknown;
}

async function main() {
  console.log(`=== Polling pdf_id=${PDF_ID} ===\n`);

  // 1. Poll until complete
  const startTime = Date.now();
  let pollInterval = 3000;

  while (true) {
    const res = await fetch(`${MATHPIX_API}/v3/pdf/${PDF_ID}`, {
      headers: { app_id: appId, app_key: appKey },
    });
    const status = (await res.json()) as MathpixPollStatus;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `[${elapsed}s] status=${status.status}, ` +
        `pages=${status.num_pages_completed ?? "?"}/${status.num_pages ?? "?"}, ` +
        `${status.percent_done ?? 0}%`,
    );

    if (status.status === "completed") {
      console.log(`\n✅ Complete! ${status.num_pages} pages`);
      console.log(`Conversion status:`, JSON.stringify(status.conversion_status));
      break;
    }
    if (status.status === "error") {
      console.error("❌ Error!");
      process.exit(1);
    }
    if (Date.now() - startTime > 15 * 60 * 1000) {
      console.error("❌ Timeout!");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval * 1.5, 15000);
  }

  // 2. Download artifacts
  console.log("\n--- Download Artifacts ---");
  const artifacts = ["mmd", "lines.json", "md", "mmd.zip", "html.zip"];

  for (const ext of artifacts) {
    try {
      const res = await fetch(`${MATHPIX_API}/v3/pdf/${PDF_ID}.${ext}`, {
        headers: { app_id: appId, app_key: appKey },
      });
      if (!res.ok) {
        console.log(`  ❌ .${ext}: ${res.status} ${await res.text()}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`  ✅ .${ext}: ${(buf.length / 1024).toFixed(0)} KB`);

      if (ext === "mmd") {
        const text = buf.toString("utf8");
        const pages = text.split("\\newpage");
        console.log(`     Pages in MMD: ${pages.length}`);
        console.log(`     First 200 chars: ${text.substring(0, 200).replace(/\n/g, "\\n")}...`);
      }

      if (ext === "lines.json") {
        try {
          const parsed = JSON.parse(buf.toString("utf8"));
          if (Array.isArray(parsed)) {
            console.log(`     Array of ${parsed.length} items`);
          } else {
            console.log(`     Keys: ${Object.keys(parsed).slice(0, 5).join(", ")}`);
          }
        } catch { console.log("     (binary)"); }
      }
    } catch (err) {
      console.log(`  ❌ .${ext}: ${err}`);
    }
  }

  // 3. Quality scoring
  console.log("\n--- Quality Scoring ---");
  const { scorePageQuality } = await import("../src/workers/utils/quality-score");
  const { chunkText } = await import("../src/workers/utils/chunking");

  const mmdRes = await fetch(`${MATHPIX_API}/v3/pdf/${PDF_ID}.mmd`, {
    headers: { app_id: appId, app_key: appKey },
  });
  const mmdText = await mmdRes.text();
  const pages = mmdText.split("\\newpage");

  for (let i = 0; i < Math.min(5, pages.length); i++) {
    const t = pages[i]!.trim();
    const score = scorePageQuality(t);
    console.log(`  Page ${i + 1}: score=${score}, ${t.length} chars`);
  }

  // 4. Chunking
  console.log("\n--- Chunking (pages 1-10) ---");
  const sample = pages.slice(0, 10).join("\n\n");
  const chunks = chunkText(sample);
  console.log(`  Input: ${sample.length} chars → ${chunks.length} chunks`);
  chunks.forEach((c, i) =>
    console.log(`  Chunk ${i}: ${c.tokenCount} tokens, hash=${c.contentHash}`),
  );

  console.log("\n=== ✅ E2E COMPLETE ===");
}

main().catch(console.error);
