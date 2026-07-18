/**
 * Debug: test submit to Mathpix and print full response
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../.env") });

async function main() {
  const appId = process.env.MATHPIX_APP_ID!;
  const appKey = process.env.MATHPIX_APP_KEY!;

  // Submit a tiny portion — just first few KB to test API
  const pdfPath = resolve(__dirname, "Toan-7-Tap-1-lam-net.pdf");
  const pdfBuffer = readFileSync(pdfPath);

  const formData = new FormData();
  const ab = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength,
  ) as ArrayBuffer;
  formData.append(
    "file",
    new Blob([ab], { type: "application/pdf" }),
    "test.pdf",
  );
  formData.append(
    "options_json",
    JSON.stringify({
      conversion_formats: { "mmd.zip": true, md: true, "html.zip": true },
      languages: ["vi", "en"],
    }),
  );

  console.log("Submitting to Mathpix...");
  const res = await fetch("https://api.mathpix.com/v3/pdf", {
    method: "POST",
    headers: { app_id: appId, app_key: appKey },
    body: formData,
  });

  console.log(`Response status: ${res.status}`);
  console.log(`Response headers:`, Object.fromEntries(res.headers.entries()));

  const body = await res.text();
  console.log(`Response body: ${body}`);

  // If we got an ID, try polling
  try {
    const json = JSON.parse(body);
    console.log("\nParsed JSON:", JSON.stringify(json, null, 2));

    // Try to find the pdf_id in the response
    const possibleId = json.pdf_id || json.id || json.request_id;
    if (possibleId) {
      console.log(`\nFound ID: ${possibleId}`);
      console.log("Polling status...");

      const statusRes = await fetch(
        `https://api.mathpix.com/v3/pdf/${possibleId}`,
        { headers: { app_id: appId, app_key: appKey } },
      );
      const statusBody = await statusRes.text();
      console.log(`Status response: ${statusBody}`);
    }
  } catch {
    console.log("(not JSON)");
  }
}

main().catch(console.error);
