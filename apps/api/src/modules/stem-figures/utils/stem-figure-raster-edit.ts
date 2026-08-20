import { z } from "zod";
import type { Sharp } from "sharp";

export const STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION =
  "TEXTBOOK_RASTER_CLEANUP_V2" as const;
export const STEM_FIGURE_RASTER_PREVIEW_MAX_EDGE = 1_600;
export const STEM_FIGURE_RASTER_EDIT_MAX_PIXELS = 16_000_000;
export const STEM_FIGURE_RASTER_MASK_MAX_BYTES = 8 * 1024 * 1024;

const MAX_MASK_COVERAGE_RATIO = 0.08;
const MAX_COMPONENTS = 32;
const MAX_COMPONENT_BOUNDING_BOX_RATIO = 0.12;
const MAX_BACKGROUND_VARIANCE = 484;
const MIN_BACKGROUND_SAMPLE_COUNT = 12;

export const stemFigureRasterEditOperationsSchema = z
  .object({
    enhance: z.boolean(),
    removeSimpleDetails: z.boolean(),
    pipelineVersion: z.literal(STEM_FIGURE_RASTER_EDIT_PIPELINE_VERSION),
  })
  .strict()
  .refine((value) => value.enhance !== value.removeSimpleDetails, {
    message: "Exactly one raster edit operation must be enabled.",
  });

export type StemFigureRasterEditOperations = z.infer<
  typeof stemFigureRasterEditOperationsSchema
>;

export type StemFigureRasterEditErrorCode =
  | "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED"
  | "STEM_FIGURE_RASTER_MASK_INVALID"
  | "STEM_FIGURE_RASTER_BACKGROUND_COMPLEX";

export class StemFigureRasterEditValidationError extends Error {
  constructor(
    readonly code: StemFigureRasterEditErrorCode,
    message: string,
    readonly details?: Record<string, number>,
  ) {
    super(message);
    this.name = "StemFigureRasterEditValidationError";
  }
}

export function parseStemFigureRasterEditOperations(
  value: string,
): StemFigureRasterEditOperations {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new StemFigureRasterEditValidationError(
      "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
      "Cấu hình chỉnh ảnh không hợp lệ.",
    );
  }
  const result = stemFigureRasterEditOperationsSchema.safeParse(parsed);
  if (!result.success) {
    throw new StemFigureRasterEditValidationError(
      "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
      "Cấu hình chỉnh ảnh không được hỗ trợ.",
    );
  }
  return result.data;
}

export function applyConservativeRasterEnhancement(pipeline: Sharp) {
  return pipeline.median(3).linear(1.18, -22).modulate({ saturation: 1.06 }).sharpen({
    sigma: 1.05,
    m1: 0.9,
    m2: 1.8,
    x1: 2,
    y2: 10,
    y3: 20,
  });
}

export function createSimpleBackgroundRemovalOverlay(input: {
  rgba: Uint8Array;
  mask: Uint8Array;
  width: number;
  height: number;
}) {
  const pixelCount = input.width * input.height;
  if (input.rgba.length !== pixelCount * 4 || input.mask.length !== pixelCount) {
    throw new StemFigureRasterEditValidationError(
      "STEM_FIGURE_RASTER_MASK_INVALID",
      "Kích thước vùng chọn không khớp với ảnh.",
    );
  }

  let activePixelCount = 0;
  for (const value of input.mask) {
    if (value > 0) activePixelCount += 1;
  }
  const maskCoverageRatio = activePixelCount / pixelCount;
  if (activePixelCount === 0 || maskCoverageRatio > MAX_MASK_COVERAGE_RATIO) {
    throw new StemFigureRasterEditValidationError(
      "STEM_FIGURE_RASTER_MASK_INVALID",
      activePixelCount === 0
        ? "Hãy tô vùng chi tiết cần xóa."
        : "Vùng chọn quá lớn. Hãy chỉ chọn chi tiết nhỏ cần xóa.",
      { maskCoverageRatio },
    );
  }

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(activePixelCount);
  const components: RasterMaskComponent[] = [];

  for (let index = 0; index < pixelCount; index += 1) {
    if (input.mask[index] === 0 || visited[index] === 1) continue;
    if (components.length >= MAX_COMPONENTS) {
      throw new StemFigureRasterEditValidationError(
        "STEM_FIGURE_RASTER_MASK_INVALID",
        "Vùng chọn có quá nhiều chi tiết rời. Hãy xóa từng nhóm nhỏ.",
      );
    }
    components.push(
      collectComponent({
        startIndex: index,
        mask: input.mask,
        visited,
        queue,
        width: input.width,
        height: input.height,
      }),
    );
  }

  const overlay = new Uint8Array(pixelCount * 4);
  let maximumBackgroundVariance = 0;
  for (const component of components) {
    const boundingBoxArea =
      (component.maxX - component.minX + 1) * (component.maxY - component.minY + 1);
    if (boundingBoxArea / pixelCount > MAX_COMPONENT_BOUNDING_BOX_RATIO) {
      throw new StemFigureRasterEditValidationError(
        "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
        "Vùng chọn bao phủ cấu trúc quá lớn. Hãy thu nhỏ vùng chọn.",
      );
    }
    const background = sampleComponentBackground(input, component);
    maximumBackgroundVariance = Math.max(maximumBackgroundVariance, background.variance);
    if (background.variance > MAX_BACKGROUND_VARIANCE) {
      throw new StemFigureRasterEditValidationError(
        "STEM_FIGURE_RASTER_BACKGROUND_COMPLEX",
        "Nền quanh vùng chọn có nhiều chi tiết hoặc màu sắc. Công cụ chỉ hỗ trợ nền phẳng.",
        { backgroundVariance: background.variance },
      );
    }

    for (const pixelIndex of component.pixels) {
      const offset = pixelIndex * 4;
      overlay[offset] = background.red;
      overlay[offset + 1] = background.green;
      overlay[offset + 2] = background.blue;
      overlay[offset + 3] = isBoundaryPixel(
        pixelIndex,
        input.mask,
        input.width,
        input.height,
      )
        ? 232
        : 255;
    }
  }

  return {
    overlay: Buffer.from(overlay),
    maskCoverageRatio,
    backgroundVariance: maximumBackgroundVariance,
    componentCount: components.length,
  };
}

type RasterMaskComponent = {
  pixels: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function collectComponent(input: {
  startIndex: number;
  mask: Uint8Array;
  visited: Uint8Array;
  queue: Int32Array;
  width: number;
  height: number;
}): RasterMaskComponent {
  let head = 0;
  let tail = 1;
  input.queue[0] = input.startIndex;
  input.visited[input.startIndex] = 1;
  const pixels: number[] = [];
  let minX = input.startIndex % input.width;
  let maxX = minX;
  let minY = Math.floor(input.startIndex / input.width);
  let maxY = minY;

  while (head < tail) {
    const index = input.queue[head]!;
    head += 1;
    pixels.push(index);
    const x = index % input.width;
    const y = Math.floor(index / input.width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < input.width ? index + 1 : -1,
      y > 0 ? index - input.width : -1,
      y + 1 < input.height ? index + input.width : -1,
    ];
    for (const neighbor of neighbors) {
      if (
        neighbor >= 0 &&
        (input.mask[neighbor] ?? 0) > 0 &&
        input.visited[neighbor] === 0
      ) {
        input.visited[neighbor] = 1;
        input.queue[tail] = neighbor;
        tail += 1;
      }
    }
  }

  return { pixels, minX, minY, maxX, maxY };
}

function sampleComponentBackground(
  input: { rgba: Uint8Array; mask: Uint8Array; width: number; height: number },
  component: RasterMaskComponent,
) {
  const ringWidth = Math.max(
    3,
    Math.min(12, Math.round(Math.min(input.width, input.height) * 0.004)),
  );
  const fromX = Math.max(0, component.minX - ringWidth);
  const toX = Math.min(input.width - 1, component.maxX + ringWidth);
  const fromY = Math.max(0, component.minY - ringWidth);
  const toY = Math.min(input.height - 1, component.maxY + ringWidth);
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];

  for (let y = fromY; y <= toY; y += 1) {
    for (let x = fromX; x <= toX; x += 1) {
      const isOutsideBox =
        x < component.minX ||
        x > component.maxX ||
        y < component.minY ||
        y > component.maxY;
      const index = y * input.width + x;
      if (!isOutsideBox || (input.mask[index] ?? 0) > 0) continue;
      const offset = index * 4;
      if ((input.rgba[offset + 3] ?? 0) < 192) continue;
      reds.push(input.rgba[offset] ?? 0);
      greens.push(input.rgba[offset + 1] ?? 0);
      blues.push(input.rgba[offset + 2] ?? 0);
    }
  }

  if (reds.length < MIN_BACKGROUND_SAMPLE_COUNT) {
    throw new StemFigureRasterEditValidationError(
      "STEM_FIGURE_RASTER_EDIT_UNSUPPORTED",
      "Không đủ vùng nền sạch quanh chi tiết đã chọn.",
    );
  }
  const variance =
    (channelVariance(reds) + channelVariance(greens) + channelVariance(blues)) / 3;
  return {
    red: median(reds),
    green: median(greens),
    blue: median(blues),
    variance,
  };
}

function isBoundaryPixel(index: number, mask: Uint8Array, width: number, height: number) {
  const x = index % width;
  const y = Math.floor(index / width);
  return (
    x === 0 ||
    y === 0 ||
    x === width - 1 ||
    y === height - 1 ||
    mask[index - 1] === 0 ||
    mask[index + 1] === 0 ||
    mask[index - width] === 0 ||
    mask[index + width] === 0
  );
}

function channelVariance(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function median(values: number[]) {
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)]!;
}
