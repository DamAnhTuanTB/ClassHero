import { createHash } from "node:crypto";
import sharp from "sharp";

import type { AiInputImage } from "#api/modules/ai/types/ai-text.types";
import type { StemFigureGenerationBrief } from "#api/modules/stem-figures/types/stem-figure-generation.types";

export const STEM_FIGURE_PROVIDER_REFERENCE_MAX_EDGE_PIXELS = 2_048;

export async function prepareStemFigureProviderReferenceImages(input: {
  assets: StemFigureGenerationBrief["referenceAssets"];
  downloadObject: (objectKey: string) => Promise<Buffer>;
}) {
  const normalized: Array<{
    asset: StemFigureGenerationBrief["referenceAssets"][number];
    bytes: Buffer;
    contentHash: string;
  }> = [];
  for (let index = 0; index < input.assets.length; index += 2) {
    normalized.push(
      ...(await Promise.all(
        input.assets.slice(index, index + 2).map(async (asset) => {
          const downloaded = await input.downloadObject(asset.objectKey);
          const bytes = await sharp(downloaded, { limitInputPixels: 64_000_000 })
            .rotate()
            .resize({
              width: STEM_FIGURE_PROVIDER_REFERENCE_MAX_EDGE_PIXELS,
              height: STEM_FIGURE_PROVIDER_REFERENCE_MAX_EDGE_PIXELS,
              fit: "inside",
              withoutEnlargement: true,
            })
            .png({ compressionLevel: 9 })
            .toBuffer();
          return {
            asset,
            bytes,
            contentHash: createHash("sha256").update(bytes).digest("hex"),
          };
        }),
      )),
    );
  }
  const assets: StemFigureGenerationBrief["referenceAssets"] = [];
  const images: AiInputImage[] = [];
  const seenContentHashes = new Set<string>();

  for (const normalizedImage of normalized) {
    if (seenContentHashes.has(normalizedImage.contentHash)) continue;
    seenContentHashes.add(normalizedImage.contentHash);
    assets.push({ ...normalizedImage.asset, mimeType: "image/png" });
    images.push({
      imageUrl: `data:image/png;base64,${normalizedImage.bytes.toString("base64")}`,
      detail: "high",
    });
  }

  return { assets, images };
}
