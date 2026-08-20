import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { StemFigureRasterEditService } from "#api/modules/stem-figures/services/stem-figure-raster-edit.service";
import {
  applyConservativeRasterEnhancement,
  createSimpleBackgroundRemovalOverlay,
  parseStemFigureRasterEditOperations,
  StemFigureRasterEditValidationError,
} from "#api/modules/stem-figures/utils/stem-figure-raster-edit";

describe("M9.18 raster cleanup utility", () => {
  it("builds a white overlay for a small detail on a flat white background", () => {
    const width = 20;
    const height = 20;
    const rgba = new Uint8Array(width * height * 4).fill(255);
    const mask = new Uint8Array(width * height);
    for (let y = 8; y < 12; y += 1) {
      for (let x = 8; x < 12; x += 1) mask[y * width + x] = 1;
    }

    const result = createSimpleBackgroundRemovalOverlay({
      rgba,
      mask,
      width,
      height,
    });

    expect(result.maskCoverageRatio).toBeCloseTo(0.04);
    expect(result.backgroundVariance).toBe(0);
    expect(result.componentCount).toBe(1);
    const centerOffset = (9 * width + 9) * 4;
    expect([...result.overlay.subarray(centerOffset, centerOffset + 4)]).toEqual([
      255, 255, 255, 255,
    ]);
    expect(result.overlay[(8 * width + 8) * 4 + 3]).toBe(232);
  });

  it("clips removal masks at every image corner and fills the in-bounds pixels", () => {
    const width = 30;
    const height = 30;
    const rgba = new Uint8Array(width * height * 4).fill(255);
    const cornerOrigins = [
      { x: 0, y: 0 },
      { x: width - 3, y: 0 },
      { x: 0, y: height - 3 },
      { x: width - 3, y: height - 3 },
    ];

    for (const origin of cornerOrigins) {
      const mask = new Uint8Array(width * height);
      for (let y = origin.y; y < origin.y + 3; y += 1) {
        for (let x = origin.x; x < origin.x + 3; x += 1) {
          mask[y * width + x] = 1;
        }
      }

      const result = createSimpleBackgroundRemovalOverlay({
        rgba,
        mask,
        width,
        height,
      });
      const centerOffset = ((origin.y + 1) * width + origin.x + 1) * 4;

      expect(result.componentCount).toBe(1);
      expect(result.backgroundVariance).toBe(0);
      expect([...result.overlay.subarray(centerOffset, centerOffset + 4)]).toEqual([
        255, 255, 255, 255,
      ]);
    }
  });

  it("rejects a mask that covers more than the small-detail limit", () => {
    const width = 20;
    const height = 20;
    const rgba = new Uint8Array(width * height * 4).fill(255);
    const mask = new Uint8Array(width * height);
    for (let y = 5; y < 12; y += 1) {
      for (let x = 5; x < 12; x += 1) mask[y * width + x] = 1;
    }

    expect(() =>
      createSimpleBackgroundRemovalOverlay({ rgba, mask, width, height }),
    ).toThrowError(
      expect.objectContaining<Partial<StemFigureRasterEditValidationError>>({
        code: "STEM_FIGURE_RASTER_MASK_INVALID",
      }),
    );
  });

  it("rejects removal when the surrounding background is highly varied", () => {
    const width = 30;
    const height = 30;
    const rgba = new Uint8Array(width * height * 4);
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const value = (x + y) % 2 === 0 ? 0 : 255;
        rgba[offset] = value;
        rgba[offset + 1] = value;
        rgba[offset + 2] = value;
        rgba[offset + 3] = 255;
      }
    }
    for (let y = 13; y < 17; y += 1) {
      for (let x = 13; x < 17; x += 1) mask[y * width + x] = 1;
    }

    expect(() =>
      createSimpleBackgroundRemovalOverlay({ rgba, mask, width, height }),
    ).toThrowError(
      expect.objectContaining<Partial<StemFigureRasterEditValidationError>>({
        code: "STEM_FIGURE_RASTER_BACKGROUND_COMPLEX",
      }),
    );
  });

  it("accepts exactly one tool and rejects a combined operation", () => {
    expect(
      parseStemFigureRasterEditOperations(
        JSON.stringify({
          enhance: true,
          removeSimpleDetails: false,
          pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2",
        }),
      ),
    ).toMatchObject({ enhance: true, removeSimpleDetails: false });
    expect(() =>
      parseStemFigureRasterEditOperations(
        JSON.stringify({
          enhance: true,
          removeSimpleDetails: true,
          pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2",
        }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<StemFigureRasterEditValidationError>>({
        code: "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
      }),
    );
  });

  it("produces a measurably sharper result for a blurred diagram", async () => {
    const blurred = await createBlurredDiagram();
    const before = await sharp(blurred).stats();
    const enhanced = await applyConservativeRasterEnhancement(sharp(blurred))
      .png()
      .toBuffer();
    const after = await sharp(enhanced).stats();

    expect(after.sharpness).toBeGreaterThan(before.sharpness * 1.15);
  });

  it("removes isolated impulse noise without erasing a connected line", async () => {
    const noisy = await sharp({
      create: { width: 40, height: 40, channels: 4, background: "white" },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="40" height="40"><rect x="5" y="5" width="1" height="1" fill="black"/><path d="M10 25H30" stroke="black" stroke-width="3"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();
    const enhanced = await applyConservativeRasterEnhancement(sharp(noisy))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const noiseOffset = (5 * enhanced.info.width + 5) * 4;
    const lineOffset = (25 * enhanced.info.width + 20) * 4;

    expect(enhanced.data[noiseOffset]).toBeGreaterThan(245);
    expect(enhanced.data[lineOffset]).toBeLessThan(40);
  });

  it("cleans light background haze while preserving black and colored marks", async () => {
    const hazy = await sharp({
      create: {
        width: 48,
        height: 40,
        channels: 4,
        background: { r: 241, g: 241, b: 239, alpha: 1 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="48" height="40"><path d="M6 12H42" stroke="#111827" stroke-width="4"/><path d="M6 20H42" stroke="#16b5c8" stroke-width="4"/><path d="M6 28H42" stroke="#f4c542" stroke-width="4"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();
    const enhanced = await applyConservativeRasterEnhancement(sharp(hazy))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * enhanced.info.width + x) * 4;
      return enhanced.data.subarray(offset, offset + 3);
    };

    expect([...pixel(2, 2)]).toEqual([255, 255, 255]);
    expect(pixel(24, 12)[0]).toBeLessThan(30);
    expect(pixel(24, 20)[1]).toBeGreaterThan(170);
    expect(pixel(24, 20)[2]).toBeGreaterThan(190);
    expect(pixel(24, 28)[0]).toBeGreaterThan(240);
    expect(pixel(24, 28)[1]).toBeGreaterThan(170);
    expect(pixel(24, 28)[2]).toBeLessThan(80);
  });

  it("slightly deepens colored marks without tinting white or black", async () => {
    const source = await sharp({
      create: { width: 64, height: 40, channels: 4, background: "white" },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="64" height="40"><rect x="6" y="8" width="14" height="24" fill="#38b9c9"/><rect x="25" y="8" width="14" height="24" fill="#111827"/><rect x="44" y="8" width="14" height="24" fill="#ef4444"/></svg>',
          ),
        },
      ])
      .png()
      .toBuffer();
    const legacy = await sharp(source)
      .median(3)
      .linear(1.18, -22)
      .sharpen({ sigma: 1.05, m1: 0.9, m2: 1.8, x1: 2, y2: 10, y3: 20 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const enhanced = await applyConservativeRasterEnhancement(sharp(source))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (data: Buffer, x: number, y: number) => {
      const offset = (y * enhanced.info.width + x) * 4;
      return [...data.subarray(offset, offset + 3)];
    };
    const chroma = (color: number[]) => Math.max(...color) - Math.min(...color);
    const cyanBefore = pixel(legacy.data, 12, 20);
    const cyanAfter = pixel(enhanced.data, 12, 20);
    const redBefore = pixel(legacy.data, 50, 20);
    const redAfter = pixel(enhanced.data, 50, 20);

    expect(chroma(cyanAfter)).toBeGreaterThan(chroma(cyanBefore));
    expect(chroma(redAfter)).toBeGreaterThan(chroma(redBefore));
    expect(chroma(cyanAfter)).toBeLessThanOrEqual(chroma(cyanBefore) * 1.2);
    expect(chroma(redAfter)).toBeLessThanOrEqual(chroma(redBefore) * 1.2);
    expect(pixel(enhanced.data, 2, 2)).toEqual(pixel(legacy.data, 2, 2));
    const blackBefore = pixel(legacy.data, 31, 20);
    const blackAfter = pixel(enhanced.data, 31, 20);
    expect(
      blackAfter.every((channel, index) =>
        Number.isFinite(blackBefore[index])
          ? Math.abs(channel - (blackBefore[index] ?? channel)) <= 1
          : false,
      ),
    ).toBe(true);
  });
});

describe("M9.18 raster cleanup service", () => {
  it("keeps preview read-only and atomically persists apply metadata/audit", async () => {
    const source = await createSourceImage();
    const maskBuffer = await createMaskImage();
    const figure = createFigureRecord();
    const editedFigure = {
      ...figure,
      currentRevisionId: "30000000-0000-4000-8000-000000000001",
      currentRevision: {
        ...figure.currentRevision,
        id: "30000000-0000-4000-8000-000000000001",
        sourceVersion: 2,
        deliveryFile: {
          ...figure.currentRevision.deliveryFile,
          objectKey: "test/edited.webp",
        },
      },
    };
    const transaction = {
      stemFigure: {
        findFirst: vi.fn().mockResolvedValue({
          id: figure.id,
          lessonSummaryId: null,
          blockPath: figure.blockPath,
          figureIndex: figure.figureIndex,
          planJson: figure.planJson,
        }),
        update: vi.fn().mockResolvedValue({ id: figure.id }),
      },
      file: {
        create: vi.fn().mockResolvedValue({ id: "20000000-0000-4000-8000-000000000001" }),
      },
      stemFigureRevision: {
        create: vi.fn().mockResolvedValue({ id: "30000000-0000-4000-8000-000000000001" }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "40000000-0000-4000-8000-000000000001" }),
      },
    };
    const prisma = {
      stemFigure: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(figure)
          .mockResolvedValueOnce(figure)
          .mockResolvedValueOnce(editedFigure),
      },
      stemFigureRevision: {
        findFirst: vi.fn().mockResolvedValue({ sourceVersion: 1 }),
      },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const storage = {
      fileProvider: "R2",
      bucketName: "test-bucket",
      downloadObject: vi.fn().mockResolvedValue(source),
      uploadBuffer: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      createObjectKey: vi.fn().mockReturnValue("test/edited.webp"),
      getPublicUrl: vi.fn().mockReturnValue("https://cdn.test/edited.webp"),
    };
    const config = {
      get: vi.fn((key: string) => (key === "MAX_IMAGE_UPLOAD_MB" ? 10 : "test")),
    };
    const figures = {
      getForAdmin: vi.fn().mockResolvedValue({ ...figure, assetUrl: "new-url" }),
    };
    const service = new StemFigureRasterEditService(
      prisma as never,
      config as never,
      storage as never,
      figures as never,
    );
    const dto = {
      baseCurrentRevisionId: figure.currentRevisionId,
      basePendingRevisionId: null,
      baseSourceVersion: 1,
      operations: JSON.stringify({
        enhance: false,
        removeSimpleDetails: true,
        pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2",
      }),
    };
    const mask = {
      buffer: maskBuffer,
      mimetype: "image/png",
      originalname: "mask.png",
      size: maskBuffer.length,
    };

    const preview = await service.preview(figure.lessonId, figure.id, dto, mask);
    expect(preview.previewDataUrl).toMatch(/^data:image\/webp;base64,/u);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.uploadBuffer).not.toHaveBeenCalled();

    const result = await service.apply(
      figure.lessonId,
      figure.id,
      "50000000-0000-4000-8000-000000000001",
      dto,
      mask,
    );

    expect(storage.uploadBuffer).toHaveBeenCalledWith(
      "test/edited.webp",
      expect.any(Buffer),
      "image/webp",
    );
    expect(transaction.file.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            uploadSource: "stem-figure.raster-edit",
            textbookSourceObjectKey: "ocr/crop-1.png",
          }),
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STEM_FIGURE_RASTER_EDIT_APPLIED",
        }),
      }),
    );
    expect(transaction.stemFigure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentRevisionId: "30000000-0000-4000-8000-000000000001",
        }),
      }),
    );
    expect(result.auditId).toBe("40000000-0000-4000-8000-000000000001");

    const nextPreview = await service.preview(
      figure.lessonId,
      figure.id,
      {
        baseCurrentRevisionId: editedFigure.currentRevisionId,
        basePendingRevisionId: null,
        baseSourceVersion: 2,
        operations: JSON.stringify({
          enhance: true,
          removeSimpleDetails: false,
          pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2",
        }),
      },
      undefined,
    );
    expect(nextPreview.previewDataUrl).toMatch(/^data:image\/webp;base64,/u);
    expect(storage.downloadObject).toHaveBeenLastCalledWith("test/edited.webp");
  });
});

async function createSourceImage() {
  const blackSquare = await sharp({
    create: { width: 8, height: 8, channels: 4, background: "black" },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 40, height: 40, channels: 4, background: "white" },
  })
    .composite([{ input: blackSquare, left: 16, top: 16 }])
    .webp({ quality: 92 })
    .toBuffer();
}

async function createBlurredDiagram() {
  const crisp = await sharp(
    Buffer.from(
      '<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="360" fill="white"/><path d="M70 270H570M170 210L315 90L470 210" fill="none" stroke="#334155" stroke-width="8"/><text x="290" y="70" font-size="42" fill="#0891b2">u</text></svg>',
    ),
  )
    .png()
    .toBuffer();
  return sharp(crisp).blur(1.6).jpeg({ quality: 72 }).toBuffer();
}

function createMaskImage() {
  return sharp({
    create: {
      width: 40,
      height: 40,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="8" height="8"><rect width="8" height="8" fill="white"/></svg>',
        ),
        left: 16,
        top: 16,
      },
    ])
    .png()
    .toBuffer();
}

function createFigureRecord() {
  const currentRevisionId = "10000000-0000-4000-8000-000000000001";
  return {
    id: "10000000-0000-4000-8000-000000000002",
    lessonId: "10000000-0000-4000-8000-000000000003",
    lessonSummaryId: null,
    aiGenerationId: null,
    blockPath: "sections.0.blocks.0",
    figureIndex: 0,
    localPlanId: "F001",
    planJson: {},
    subjectKey: "MATH",
    subjectName: "Toán",
    subjectSlug: "toan",
    status: "SUCCEEDED",
    theme: "LIGHT",
    currentRevisionId,
    pendingRevisionId: null,
    currentRevision: {
      id: currentRevisionId,
      sourceKind: "ADMIN_UPLOAD",
      origin: "ADMIN_UPLOAD",
      status: "SUCCEEDED",
      sourceHash: "source-hash",
      sourceVersion: 1,
      altText: "Hình sách giáo khoa",
      caption: null,
      deliveryFile: {
        objectKey: "delivery/current.webp",
        publicUrl: "https://cdn.test/current.webp",
        mimeType: "image/webp",
        metadataJson: {
          uploadSource: "stem-figure.use-source-crop",
          textbookSourceObjectKey: "ocr/crop-1.png",
        },
      },
      referenceSnapshotJson: null,
      referenceSnapshotHash: null,
      generationBriefHash: null,
    },
    pendingRevision: null,
    revisions: [],
    lastErrorCategory: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
