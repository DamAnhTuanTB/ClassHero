/**
 * Test image extraction from the downloaded mmd.zip
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Import the service directly (standalone test, no NestJS DI)
import { ImageExtractionService } from "../src/workers/services/image-extraction.service";

async function main() {
  const zipPath = resolve(__dirname, "mathpix-output/toan7.mmd.zip");

  console.log("=== Image Extraction Test ===\n");
  console.log(`ZIP file: ${zipPath}`);

  const zipBuffer = readFileSync(zipPath);
  console.log(`ZIP size: ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB\n`);

  const service = new ImageExtractionService();
  const images = await service.extractImagesFromZip(zipBuffer);

  console.log(`\nTotal images: ${images.length}`);

  // Show page distribution
  const byPage = service.groupByPage(images);
  console.log(`Pages with images: ${byPage.size}\n`);

  // Show first 10 pages
  console.log("--- Per-page breakdown (first 20 pages) ---");
  for (let page = 1; page <= 20; page++) {
    const pageImages = byPage.get(page);
    if (!pageImages) continue;
    console.log(`  Page ${String(page).padStart(3)}: ${pageImages.length} images`);
    for (const img of pageImages) {
      console.log(
        `    → ${img.filename} (${(img.data.length / 1024).toFixed(0)} KB, ${img.boundingBox.w}x${img.boundingBox.h})`,
      );
    }
  }

  // MinIO path example
  console.log("\n--- MinIO storage paths (examples) ---");
  const docId = "abc123-source-doc-id";
  for (const img of images.slice(0, 5)) {
    const key = `document-images/${docId}/page-${String(img.pageNumber).padStart(3, "0")}/${img.filename}`;
    console.log(`  ${key}`);
  }

  console.log("\n=== ✅ Image Extraction Test COMPLETE ===");
}

main().catch(console.error);
