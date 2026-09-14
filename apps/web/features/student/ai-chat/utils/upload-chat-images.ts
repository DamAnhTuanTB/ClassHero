export const AI_CHAT_IMAGE_UPLOAD_CONCURRENCY = 3;

export async function uploadChatImagesWithConcurrency<TImage, TUpload>(
  images: readonly TImage[],
  upload: (image: TImage, index: number) => Promise<TUpload>,
  concurrency = AI_CHAT_IMAGE_UPLOAD_CONCURRENCY,
): Promise<TUpload[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Image upload concurrency must be a positive integer.");
  }
  if (images.length === 0) return [];

  const results = new Array<TUpload>(images.length);
  let nextIndex = 0;
  let firstError: unknown;

  async function worker() {
    while (firstError === undefined) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= images.length) return;

      try {
        results[index] = await upload(images[index]!, index);
      } catch (error) {
        firstError = error;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, images.length) }, () => worker()),
  );
  if (firstError !== undefined) throw firstError;
  return results;
}
