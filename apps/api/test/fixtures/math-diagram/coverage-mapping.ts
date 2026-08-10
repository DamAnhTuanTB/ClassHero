const fixtureIdsBySharedCompilerCell = {
  "plane-axial-symmetry-medium": ["geometry-axial-symmetry"],
  "plane-central-symmetry-hard": ["geometry-central-symmetry"],
  "advanced-angle-bisectors-medium": ["advanced-angle-bisectors"],
  "advanced-perpendicular-bisectors-hard": [
    "advanced-perpendicular-bisectors",
  ],
  "advanced-altitudes-hard": ["advanced-altitudes"],
  "spatial-triangular-prism-medium": ["spatial-triangular-prism"],
  "spatial-pyramid-hard": ["spatial-pyramid", "spatial-triangular-pyramid"],
} as const satisfies Record<string, readonly string[]>;

export function mathDiagramFixtureMatchesInventoryCell(input: {
  cellId: string;
  cellCompilerKey: string;
  fixtureId: string;
  fixtureCompilerKey: string;
}) {
  const explicitFixtureIds =
    fixtureIdsBySharedCompilerCell[
      input.cellId as keyof typeof fixtureIdsBySharedCompilerCell
    ];
  if (explicitFixtureIds) {
    return explicitFixtureIds.some((fixtureId) => fixtureId === input.fixtureId);
  }
  return input.cellCompilerKey === input.fixtureCompilerKey;
}
