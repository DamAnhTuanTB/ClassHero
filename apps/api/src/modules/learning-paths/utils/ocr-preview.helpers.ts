type JsonRecord = Record<string, unknown>;

export type OcrPreviewImageReference = {
  caption: string | null;
  imageId: string;
  kind: string | null;
  mimeType: string | null;
  objectKey: string;
  orderInPage: number;
};

type OcrPreviewImageWithUrl = OcrPreviewImageReference & {
  url: string;
};

export function readOcrPreviewImageReferences(
  metadataJson: unknown,
  sourceDocumentId: string,
): OcrPreviewImageReference[] {
  const metadata = asRecord(metadataJson);
  const visual = asRecord(metadata?.visual);
  const providerImages = Array.isArray(visual?.providerImages)
    ? visual.providerImages
    : [];
  const expectedObjectKeyPrefix = `document-images/${sourceDocumentId}/`;

  return providerImages
    .map((value, index) => toPreviewImage(value, index))
    .filter(
      (image): image is OcrPreviewImageReference =>
        image !== null && image.objectKey.startsWith(expectedObjectKeyPrefix),
    )
    .sort((left, right) => left.orderInPage - right.orderInPage);
}

/**
 * Keeps Mathpix's provider-native text/image sequence intact while replacing
 * stale provider/public image URLs with short-lived storage URLs.
 */
export function rewriteOcrPreviewImageUrls(
  content: string | null,
  images: OcrPreviewImageWithUrl[],
): string | null {
  if (!content || images.length === 0) {
    return content;
  }

  const imageUrlByFilename = new Map(
    images.map((image) => [getFilename(image.objectKey), image.url]),
  );

  let rewrittenContent = content;
  for (const [filename, url] of imageUrlByFilename) {
    rewrittenContent = rewrittenContent
      .replaceAll(`./images/${filename}`, url)
      .replaceAll(`images/${filename}`, url);
  }

  return rewrittenContent.replace(
    /https?:\/\/[^\s<>"'{}()[\]]+/gu,
    (rawUrl) => resolvePreviewImageUrl(rawUrl, imageUrlByFilename) ?? rawUrl,
  );
}

function toPreviewImage(
  value: unknown,
  fallbackOrder: number,
): OcrPreviewImageReference | null {
  const image = asRecord(value);
  const imageId = readString(image?.imageId);
  const objectKey = readString(image?.objectKey);

  if (!imageId || !objectKey) {
    return null;
  }

  return {
    caption: readString(image?.captionCandidate),
    imageId,
    kind: readString(image?.kind),
    mimeType: readString(image?.mimeType),
    objectKey,
    orderInPage: readNumber(image?.orderInPage) ?? fallbackOrder + 1,
  };
}

function resolvePreviewImageUrl(
  rawUrl: string,
  imageUrlByFilename: Map<string, string>,
): string | null {
  const normalizedUrl = rawUrl.replaceAll("\\&", "&");

  for (const [filename, url] of imageUrlByFilename) {
    if (normalizedUrl.includes(`/${filename}`)) {
      return url;
    }
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const croppedImageMatch = parsedUrl.pathname.match(/\/cropped\/(.+)-(\d+)\.jpg$/u);
    if (!croppedImageMatch) {
      return null;
    }

    const [, providerDocumentId, pageNumber] = croppedImageMatch;
    const height = parsedUrl.searchParams.get("height");
    const width = parsedUrl.searchParams.get("width");
    const topLeftY = parsedUrl.searchParams.get("top_left_y");
    const topLeftX = parsedUrl.searchParams.get("top_left_x");
    if (!providerDocumentId || !pageNumber || !height || !width || !topLeftY || !topLeftX) {
      return null;
    }

    const filename = `${providerDocumentId}-${pageNumber}_${height}_${width}_${topLeftY}_${topLeftX}.jpg`;
    return imageUrlByFilename.get(filename) ?? null;
  } catch {
    return null;
  }
}

function getFilename(objectKey: string) {
  return objectKey.slice(objectKey.lastIndexOf("/") + 1);
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
