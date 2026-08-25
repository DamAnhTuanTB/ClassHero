import sharp from "sharp";

const MAX_REFINEMENT_IMAGE_EDGE = 1_600;
const MAX_REFINEMENT_SVG_BYTES = 2 * 1024 * 1024;

export async function buildQuizFigureRefinementImageDataUrl(svg: Buffer) {
  if (svg.byteLength === 0 || svg.byteLength > MAX_REFINEMENT_SVG_BYTES) {
    throw new Error("QUIZ_FIGURE_REFINEMENT_IMAGE_SIZE_INVALID");
  }
  const png = await sharp(svg, {
    density: 192,
    limitInputPixels: MAX_REFINEMENT_IMAGE_EDGE * MAX_REFINEMENT_IMAGE_EDGE * 4,
  })
    .flatten({ background: "#ffffff" })
    .resize({
      width: MAX_REFINEMENT_IMAGE_EDGE,
      height: MAX_REFINEMENT_IMAGE_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return `data:image/png;base64,${png.toString("base64")}`;
}
