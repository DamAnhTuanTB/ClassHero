import { FileVisibility } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { FilesService } from "#api/modules/files/services/files.service";
import {
  readOcrPreviewImageReferences,
  rewriteOcrPreviewImageUrls,
} from "#api/modules/learning-paths/utils/ocr-preview.helpers";
import { normalizeOcrPages } from "#api/workers/utils/ocr-artifact-normalizer";

describe("M4.5 private document previews", () => {
  it("always signs a private file even when stale publicUrl metadata exists", async () => {
    const service = new FilesService(
      {} as never,
      {} as never,
      {
        createSignedGetUrl: async (objectKey: string) =>
          `http://localhost:9100/private-bucket/${objectKey}?signed=true`,
      } as never,
    );

    await expect(
      service.resolveAccessUrl({
        objectKey: "uploads/development/lesson.pdf",
        publicUrl: "http://localhost:9000/old-bucket/lesson.pdf",
        visibility: FileVisibility.PRIVATE,
      }),
    ).resolves.toContain("signed=true");
  });

  it("keeps a public URL only for files explicitly marked public", async () => {
    const service = new FilesService(
      {} as never,
      {} as never,
      {
        createSignedGetUrl: async () => "https://signed.example/file.pdf",
      } as never,
    );

    await expect(
      service.resolveAccessUrl({
        objectKey: "public/file.pdf",
        publicUrl: "https://cdn.example/public/file.pdf",
        visibility: FileVisibility.PUBLIC,
      }),
    ).resolves.toBe("https://cdn.example/public/file.pdf");
  });

  it("reads ordered OCR images only from the requested source document", () => {
    const images = readOcrPreviewImageReferences(
      {
        visual: {
          providerImages: [
            {
              imageId: "second",
              objectKey: "document-images/source-1/page-042/second.jpg",
              orderInPage: 2,
              captionCandidate: "Hình 5.24",
            },
            {
              imageId: "foreign",
              objectKey: "document-images/source-2/page-042/foreign.jpg",
              orderInPage: 1,
            },
            {
              imageId: "first",
              objectKey: "document-images/source-1/page-042/first.jpg",
              orderInPage: 1,
              captionCandidate: "Hình 5.23",
            },
          ],
        },
      },
      "source-1",
    );

    expect(images.map((image) => image.imageId)).toEqual(["first", "second"]);
  });

  it("rewrites inline Mathpix images without changing provider content order", () => {
    const firstUrl = "https://storage.example/first.jpg?signed=one";
    const secondUrl = "https://storage.example/second.jpg?signed=two";
    const content = [
      "Đoạn trước hình 5.23",
      "![](./images/local-image.jpg)",
      "\\begin{figure}",
      "\\includegraphics{https://cdn.mathpix.com/cropped/provider-id-42.jpg?height=276&width=553&top_left_y=3357&top_left_x=2721}",
      "\\caption{Hinh 5.23}",
      "\\end{figure}",
      "Đoạn giữa hai hình",
      "![](http://localhost:9000/bucket/document-images/source-1/page-042/provider-id-42_606_943_4274_2545.jpg)",
      "Hinh 5.24",
      "Đoạn sau hình 5.24",
    ].join("\n");

    const rewritten = rewriteOcrPreviewImageUrls(content, [
      {
        caption: null,
        imageId: "local",
        kind: "image",
        mimeType: "image/jpeg",
        objectKey: "document-images/source-1/page-001/local-image.jpg",
        orderInPage: 1,
        url: "https://storage.example/local-image.jpg?signed=local",
      },
      {
        caption: "Hình 5.23",
        imageId: "first",
        kind: "diagram",
        mimeType: "image/jpeg",
        objectKey:
          "document-images/source-1/page-042/provider-id-42_276_553_3357_2721.jpg",
        orderInPage: 1,
        url: firstUrl,
      },
      {
        caption: "Hình 5.24",
        imageId: "second",
        kind: "diagram",
        mimeType: "image/jpeg",
        objectKey:
          "document-images/source-1/page-042/provider-id-42_606_943_4274_2545.jpg",
        orderInPage: 2,
        url: secondUrl,
      },
    ]);

    expect(rewritten).not.toContain("cdn.mathpix.com");
    expect(rewritten).not.toContain("localhost:9000");
    expect(rewritten).not.toContain("./images/local-image.jpg");
    expect(rewritten).toContain("https://storage.example/local-image.jpg?signed=local");
    expect(rewritten?.indexOf("Đoạn trước")).toBeLessThan(
      rewritten?.indexOf(firstUrl) ?? -1,
    );
    expect(rewritten?.indexOf(firstUrl)).toBeLessThan(
      rewritten?.indexOf("Đoạn giữa") ?? -1,
    );
    expect(rewritten?.indexOf("Đoạn giữa")).toBeLessThan(
      rewritten?.indexOf(secondUrl) ?? -1,
    );
    expect(rewritten?.indexOf(secondUrl)).toBeLessThan(
      rewritten?.indexOf("Đoạn sau") ?? -1,
    );
  });

  it("escapes signed URL separators so Mathpix tables keep the image in one cell", () => {
    const content = String.raw`\begin{tabular}{|c|c|c|}
A & ![](./images/table-image.jpg) & Z \\
\end{tabular}`;
    const signedUrl =
      "http://localhost:9100/private/table-image.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=test";

    const rewritten = rewriteOcrPreviewImageUrls(content, [
      {
        caption: null,
        imageId: "table-image",
        kind: "image",
        mimeType: "image/jpeg",
        objectKey: "document-images/source-1/page-001/table-image.jpg",
        orderInPage: 1,
        url: signedUrl,
      },
    ]);

    expect(rewritten).toContain(
      "X-Amz-Algorithm=AWS4-HMAC-SHA256\\&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD\\&X-Amz-Credential=test",
    );
    expect(rewritten).not.toContain(
      "X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256",
    );
  });

  it("keeps the Mathpix lines.json conversion-output sequence per page", () => {
    const [page] = normalizeOcrPages(
      {
        mmd: Buffer.from(""),
        md: Buffer.from(""),
        linesJson: Buffer.from(
          JSON.stringify({
            pages: [
              {
                lines: [
                  {
                    id: "text-before",
                    conversion_output: true,
                    text_display: "Đoạn trước hình",
                  },
                  {
                    id: "figure",
                    conversion_output: true,
                    text_display:
                      "\\n\\n\\begin{figure}\\n\\includegraphics{https://cdn.mathpix.com/cropped/provider-id-42.jpg?height=276&width=553&top_left_y=3357&top_left_x=2721}\\n\\caption{Hinh 5.23}\\n\\end{figure}",
                  },
                  {
                    id: "caption-child",
                    conversion_output: false,
                    text_display: "Hinh 5.23",
                  },
                  {
                    id: "text-after",
                    conversion_output: true,
                    text_display: "\\n\\nĐoạn sau hình",
                  },
                ],
              },
            ],
          }),
        ),
      },
      1,
    );

    expect(page?.text.indexOf("Đoạn trước")).toBeLessThan(
      page?.text.indexOf("includegraphics") ?? -1,
    );
    expect(page?.text.indexOf("includegraphics")).toBeLessThan(
      page?.text.indexOf("Hinh 5.23") ?? -1,
    );
    expect(page?.text.indexOf("Hinh 5.23")).toBeLessThan(
      page?.text.indexOf("Đoạn sau") ?? -1,
    );
    expect(page?.text.match(/Hinh 5\.23/gu)).toHaveLength(1);
  });
});
