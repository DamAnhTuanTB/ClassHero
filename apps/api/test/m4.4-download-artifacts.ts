/**
 * Download all artifacts from Mathpix and save to disk for viewing
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../.env") });

const appId = process.env.MATHPIX_APP_ID!;
const appKey = process.env.MATHPIX_APP_KEY!;
const MATHPIX_API = "https://api.mathpix.com";
const PDF_ID = "ae177c55-83dc-4c94-a8f8-73b2c5ae18af";

async function main() {
  const outDir = resolve(__dirname, "mathpix-output");
  mkdirSync(outDir, { recursive: true });

  const artifacts = [
    { ext: "mmd", filename: "toan7.mmd" },
    { ext: "lines.json", filename: "toan7.lines.json" },
    { ext: "mmd.zip", filename: "toan7.mmd.zip" },
    { ext: "html.zip", filename: "toan7.html.zip" },
  ];

  for (const { ext, filename } of artifacts) {
    console.log(`Downloading .${ext}...`);
    const res = await fetch(`${MATHPIX_API}/v3/pdf/${PDF_ID}.${ext}`, {
      headers: { app_id: appId, app_key: appKey },
    });

    if (!res.ok) {
      console.error(`  ❌ ${res.status}: ${await res.text()}`);
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const path = resolve(outDir, filename);
    writeFileSync(path, buf);
    console.log(`  ✅ Saved: ${path} (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  console.log(`\n=== Done! Files saved to: ${outDir} ===`);
  console.log(`\nCách xem:`);
  console.log(`  - .mmd: mở bằng text editor (VS Code)`);
  console.log(`  - .lines.json: mở bằng text editor hoặc JSON viewer`);
  console.log(`  - .mmd.zip: giải nén để xem ảnh + text`);
  console.log(`  - .html.zip: giải nén rồi mở file .html bằng trình duyệt`);
}

main().catch(console.error);
