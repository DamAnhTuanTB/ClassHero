type StemFigurePosition = {
  blockPath: string;
  figureIndex: number;
};

export function compareStemFigurePositions(
  left: StemFigurePosition,
  right: StemFigurePosition,
) {
  const leftPath = parseBlockPath(left.blockPath);
  const rightPath = parseBlockPath(right.blockPath);

  if (leftPath && rightPath) {
    if (leftPath.sectionIndex !== rightPath.sectionIndex) {
      return leftPath.sectionIndex - rightPath.sectionIndex;
    }
    if (leftPath.blockIndex !== rightPath.blockIndex) {
      return leftPath.blockIndex - rightPath.blockIndex;
    }
    return left.figureIndex - right.figureIndex;
  }
  if (leftPath) return -1;
  if (rightPath) return 1;
  return (
    left.blockPath.localeCompare(right.blockPath, "en", { numeric: true }) ||
    left.figureIndex - right.figureIndex
  );
}

function parseBlockPath(value: string) {
  const match = value.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  if (!match) return null;
  return {
    sectionIndex: Number(match[1]),
    blockIndex: Number(match[2]),
  };
}
