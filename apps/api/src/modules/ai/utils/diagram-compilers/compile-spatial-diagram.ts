import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { DiagramBuilder } from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

type SpatialIntent = Extract<
  LessonSummaryDiagramIntent,
  { family: "SPATIAL_APPLIED" }
>;

export function compileSpatialDiagram(intent: SpatialIntent): LessonSummaryDiagramSpec {
  switch (intent.archetype) {
    case "CUBOID":
      return compileCuboid(intent);
    case "PRISM_OR_PYRAMID":
      return intent.variant === "PYRAMID"
        ? compilePyramid(intent)
        : intent.variant === "TRIANGULAR_PYRAMID"
          ? compileTriangularPyramid(intent)
          : compileTriangularPrism(intent);
    case "CYLINDER":
      return compileCylinder(intent);
    case "CONE_OR_SPHERE":
      return intent.variant === "SPHERE" ? compileSphere(intent) : compileCone(intent);
    case "APPLIED_RIGHT_TRIANGLE":
      return compileAppliedRightTriangle(intent);
    case "NET":
      return compileNet(intent);
  }
}

function compileTriangularPyramid(intent: SpatialIntent) {
  const labels = resolveLabels(intent.pointLabels, 4, ["A", "B", "C", "S"]);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1, width: 8, height: 8.5 },
    intent.caption,
  );
  const a = builder.addPoint(vertex("triangularPyramidA", 0, 0, labels[0]!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertex("triangularPyramidB", 5, 0, labels[1]!, "BOTTOM_RIGHT"));
  const c = builder.addPoint(vertex("triangularPyramidC", 2.25, 1.8, labels[2]!, "RIGHT"));
  const s = builder.addPoint(vertex("triangularPyramidS", 2.45, 6.1, labels[3]!, "TOP"));
  const edges = new Map<string, string>();
  const addEdge = (
    id: string,
    from: string,
    to: string,
    name: string,
    style: "SOLID" | "DASHED" = "SOLID",
  ) => {
    builder.addSegment(id, from, to, style);
    edges.set(normalizeTarget(name), id);
  };
  addEdge("triangularPyramidAB", a, b, "AB");
  addEdge("triangularPyramidAC", a, c, "AC", "DASHED");
  addEdge("triangularPyramidBC", b, c, "BC", "DASHED");
  addEdge("triangularPyramidSA", s, a, "SA");
  addEdge("triangularPyramidSB", s, b, "SB");
  addEdge("triangularPyramidSC", s, c, "SC", "DASHED");
  addDimensions(builder, intent, edges, a);
  return builder.build();
}

function compileNet(intent: SpatialIntent) {
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1, width: 10, height: 8 },
    intent.caption,
  );
  const rectangles =
    intent.variant === "CUBE_NET"
      ? [
          [2, 0, 2, 2],
          [0, 2, 2, 2],
          [2, 2, 2, 2],
          [4, 2, 2, 2],
          [6, 2, 2, 2],
          [2, 4, 2, 2],
        ]
      : [
          [2.5, 0, 3, 1.5],
          [0, 1.5, 2.5, 2],
          [2.5, 1.5, 3, 2],
          [5.5, 1.5, 2.5, 2],
          [2.5, 3.5, 3, 1.5],
          [2.5, 5, 3, 2],
        ];
  const pointByCoordinate = new Map<string, string>();
  const pointId = (x: number, y: number) => {
    const key = `${x}:${y}`;
    const existing = pointByCoordinate.get(key);
    if (existing) return existing;
    const id = `netPoint${pointByCoordinate.size}`;
    pointByCoordinate.set(key, builder.addPoint(hidden(id, x, y)));
    return id;
  };
  rectangles.forEach(([x, y, width, height], index) => {
    builder.addPolygon(
      `netFace${index}`,
      [
        pointId(x!, y!),
        pointId(x! + width!, y!),
        pointId(x! + width!, y! + height!),
        pointId(x!, y! + height!),
      ],
      index % 2 === 0 ? "SOFT_BLUE" : "SOFT_GREEN",
    );
  });
  const firstRectangle = rectangles[0];
  const firstDimension = intent.dimensions[0];
  if (firstRectangle && firstDimension) {
    const [x, y, width] = firstRectangle;
    const from = pointId(x!, y!);
    const to = pointId(x! + width!, y!);
    builder.addSegment("netDimensionEdge", from, to);
    builder.addLabel({
      text: `${firstDimension.value} ${firstDimension.unit}`,
      anchorPointId: from,
      anchorPrimitiveId: "netDimensionEdge",
      position: "BOTTOM",
    });
  }
  return builder.build();
}

function compileTriangularPrism(intent: SpatialIntent) {
  const labels = resolveLabels(intent.pointLabels, 6, ["A", "B", "C", "A'", "B'", "C'"]);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1, width: 8.5, height: 7 },
    intent.caption,
  );
  const coordinates = [
    [0, 0, "BOTTOM_LEFT"],
    [4.2, 0, "BOTTOM_RIGHT"],
    [1.25, 3.15, "TOP_LEFT"],
    [3, 1.45, "BOTTOM_LEFT"],
    [7.2, 1.45, "RIGHT"],
    [4.25, 4.6, "TOP_RIGHT"],
  ] as const;
  const points = coordinates.map(([x, y, position], index) =>
    builder.addPoint(vertex(`prismPoint${index}`, x, y, labels[index]!, position)),
  );
  const edges: Array<[number, number, string, "SOLID" | "DASHED"]> = [
    [0, 1, "AB", "SOLID"],
    [1, 2, "BC", "SOLID"],
    [2, 0, "CA", "SOLID"],
    [3, 4, "A'B'", "DASHED"],
    [4, 5, "B'C'", "SOLID"],
    [5, 3, "C'A'", "SOLID"],
    [0, 3, "AA'", "DASHED"],
    [1, 4, "BB'", "SOLID"],
    [2, 5, "CC'", "SOLID"],
  ];
  const edgeMap = new Map<string, string>();
  for (const [from, to, name, style] of edges) {
    const id = `prismEdge${from}${to}`;
    builder.addSegment(id, points[from]!, points[to]!, style);
    edgeMap.set(normalizeTarget(name), id);
    edgeMap.set(normalizeTarget(`${labels[from]}${labels[to]}`), id);
  }
  addDimensions(builder, intent, edgeMap, points[0]!);
  return builder.build();
}

function compilePyramid(intent: SpatialIntent) {
  const labels = resolveLabels(intent.pointLabels, 5, ["A", "B", "C", "D", "S"]);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1, width: 8.5, height: 8.5 },
    intent.caption,
  );
  const coordinates = [
    [0, 0, "BOTTOM_LEFT"],
    [4.8, 0, "BOTTOM_RIGHT"],
    [6.2, 1.65, "RIGHT"],
    [1.45, 1.65, "LEFT"],
    [3.05, 6.1, "TOP"],
  ] as const;
  const points = coordinates.map(([x, y, position], index) =>
    builder.addPoint(vertex(`pyramidPoint${index}`, x, y, labels[index]!, position)),
  );
  const edges: Array<[number, number, string, "SOLID" | "DASHED"]> = [
    [0, 1, "AB", "SOLID"],
    [1, 2, "BC", "SOLID"],
    [2, 3, "CD", "DASHED"],
    [3, 0, "DA", "DASHED"],
    [4, 0, "SA", "SOLID"],
    [4, 1, "SB", "SOLID"],
    [4, 2, "SC", "SOLID"],
    [4, 3, "SD", "DASHED"],
  ];
  const edgeMap = new Map<string, string>();
  for (const [from, to, name, style] of edges) {
    const id = `pyramidEdge${from}${to}`;
    builder.addSegment(id, points[from]!, points[to]!, style);
    edgeMap.set(normalizeTarget(name), id);
    edgeMap.set(normalizeTarget(`${labels[from]}${labels[to]}`), id);
  }
  addDimensions(builder, intent, edgeMap, points[0]!);
  return builder.build();
}

function compileCuboid(intent: SpatialIntent) {
  const labels = resolveLabels(intent.pointLabels, 8, ["A", "B", "C", "D", "E", "F", "G", "H"]);
  const builder = new DiagramBuilder(
    { minX: -1, minY: -1, width: 9, height: 7.5 },
    intent.caption,
  );
  const frontWidth = intent.variant === "CUBE" ? 4 : 5;
  const frontHeight = intent.variant === "CUBE" ? 4 : 3.5;
  const depthX = intent.variant === "CUBE" ? 1.45 : 1.7;
  const depthY = intent.variant === "CUBE" ? 1.45 : 1.5;
  const coordinates = [
    [0, 0],
    [frontWidth, 0],
    [frontWidth, frontHeight],
    [0, frontHeight],
    [depthX, depthY],
    [frontWidth + depthX, depthY],
    [frontWidth + depthX, frontHeight + depthY],
    [depthX, frontHeight + depthY],
  ] as const;
  const points = coordinates.map(([x, y], index) =>
    builder.addPoint(vertex(`cuboidPoint${index}`, x, y, labels[index]!, index < 2 ? "BOTTOM" : "TOP")),
  );
  const edges: Array<[number, number, string, "SOLID" | "DASHED"]> = [
    [0, 1, "AB", "SOLID"],
    [1, 2, "BC", "SOLID"],
    [2, 3, "CD", "SOLID"],
    [3, 0, "DA", "SOLID"],
    [4, 5, "EF", "DASHED"],
    [5, 6, "FG", "SOLID"],
    [6, 7, "GH", "SOLID"],
    [7, 4, "HE", "DASHED"],
    [0, 4, "AE", "DASHED"],
    [1, 5, "BF", "SOLID"],
    [2, 6, "CG", "SOLID"],
    [3, 7, "DH", "SOLID"],
  ];
  const edgeMap = new Map<string, string>();
  for (const [from, to, name, style] of edges) {
    const id = `cuboidEdge${name}`;
    builder.addSegment(id, points[from]!, points[to]!, style);
    edgeMap.set(normalizeTarget(`${labels[from]}${labels[to]}`), id);
    edgeMap.set(normalizeTarget(name), id);
  }
  const dimensionAliases: Array<[string, string]> = [
    ["chiều dài", "cuboidEdgeAB"],
    ["dài", "cuboidEdgeAB"],
    ["length", "cuboidEdgeAB"],
    ["chiều rộng", "cuboidEdgeAE"],
    ["rộng", "cuboidEdgeAE"],
    ["width", "cuboidEdgeAE"],
    ["chiều cao", "cuboidEdgeBC"],
    ["cao", "cuboidEdgeBC"],
    ["height", "cuboidEdgeBC"],
    ["cạnh", "cuboidEdgeAB"],
    ["edge", "cuboidEdgeAB"],
  ];
  for (const [alias, segmentId] of dimensionAliases) {
    edgeMap.set(normalizeTarget(alias), segmentId);
  }
  addDimensions(
    builder,
    intent,
    edgeMap,
    points[0]!,
    new Map([
      [normalizeTarget("chiều rộng"), "RIGHT"],
      [normalizeTarget("rộng"), "RIGHT"],
      [normalizeTarget("width"), "RIGHT"],
    ]),
  );
  return builder.build();
}

function compileCylinder(intent: SpatialIntent) {
  const labels = resolveLabels(intent.pointLabels, 3, ["O", "O′", "A"]);
  const builder = new DiagramBuilder(
    { minX: -4, minY: -1, width: 8, height: 9 },
    intent.caption,
  );
  const bottom = builder.addPoint(center("cylinderBottom", 0, 0, labels[0]!));
  const top = builder.addPoint(center("cylinderTop", 0, 6, labels[1]!));
  const radiusEnd = builder.addPoint(vertex("cylinderRadiusEnd", 2.6, 0, labels[2]!, "RIGHT"));
  const bottomLeft = builder.addPoint(hidden("cylinderBottomLeft", -2.6, 0));
  const bottomRight = builder.addPoint(hidden("cylinderBottomRight", 2.6, 0));
  const topLeft = builder.addPoint(hidden("cylinderTopLeft", -2.6, 6));
  const topRight = builder.addPoint(hidden("cylinderTopRight", 2.6, 6));
  addEllipseHalves(builder, "cylinderBottomEllipse", 0, 0, 2.6, 0.75);
  builder.addEllipse("cylinderTopEllipse", top, 2.6, 0.75);
  builder.addSegment("cylinderLeft", bottomLeft, topLeft);
  builder.addSegment("cylinderRight", bottomRight, topRight);
  builder.addSegment("cylinderRadius", bottom, radiusEnd);
  builder.addSegment("cylinderHeight", bottom, top, "DASHED");
  addDimensions(
    builder,
    intent,
    new Map([
      ["radius", "cylinderRadius"],
      ["r", "cylinderRadius"],
      [normalizeTarget(`${labels[0]}${labels[2]}`), "cylinderRadius"],
      ["height", "cylinderHeight"],
      ["h", "cylinderHeight"],
      [normalizeTarget(`${labels[0]}${labels[1]}`), "cylinderHeight"],
    ]),
    bottom,
  );
  return builder.build();
}

function compileCone(intent: SpatialIntent) {
  const labels = resolveLabels(intent.pointLabels, 3, ["O", "S", "A"]);
  const builder = new DiagramBuilder(
    { minX: -4, minY: -1.5, width: 8, height: 9.5 },
    intent.caption,
  );
  const centerPoint = builder.addPoint(center("coneCenter", 0, 0, labels[0]!));
  const apex = builder.addPoint(vertex("coneApex", 0, 6, labels[1]!, "TOP"));
  const radiusEnd = builder.addPoint(vertex("coneRadiusEnd", 2.7, 0, labels[2]!, "RIGHT"));
  const left = builder.addPoint(hidden("coneLeft", -2.7, 0));
  addEllipseHalves(builder, "coneBase", 0, 0, 2.7, 0.8);
  builder.addSegment("coneLeftSide", left, apex);
  builder.addSegment("coneRightSide", radiusEnd, apex);
  builder.addSegment("coneRadius", centerPoint, radiusEnd);
  builder.addSegment("coneHeight", centerPoint, apex, "DASHED");
  addDimensions(
    builder,
    intent,
    new Map([
      ["radius", "coneRadius"],
      ["r", "coneRadius"],
      ["height", "coneHeight"],
      ["h", "coneHeight"],
    ]),
    centerPoint,
  );
  return builder.build();
}

function compileSphere(intent: SpatialIntent) {
  const labels = resolveLabels(intent.pointLabels, 2, ["O", "A"]);
  const builder = new DiagramBuilder(
    { minX: -4, minY: -4, width: 8, height: 8.5 },
    intent.caption,
  );
  const centerPoint = builder.addPoint(center("sphereCenter", 0, 0, labels[0]!));
  const radiusEnd = builder.addPoint(vertex("sphereRadiusEnd", 3, 0, labels[1]!, "RIGHT"));
  builder.addCircle("sphereOutline", centerPoint, 3);
  addEllipseHalves(builder, "sphereEquator", 0, 0, 3, 0.75);
  builder.addSegment("sphereRadius", centerPoint, radiusEnd);
  addDimensions(
    builder,
    intent,
    new Map([
      ["radius", "sphereRadius"],
      ["r", "sphereRadius"],
    ]),
    centerPoint,
  );
  return builder.build();
}

function compileAppliedRightTriangle(intent: SpatialIntent) {
  if (intent.pointLabels.length >= 6) return compileAppliedRightTrianglePair(intent);
  const labels = resolveLabels(intent.pointLabels, 3, ["A", "B", "C"]);
  const builder = new DiagramBuilder(
    { minX: -1.5, minY: -1.5, width: 9, height: 8.5 },
    intent.caption,
  );
  const foot = builder.addPoint(vertex("appliedFoot", 0, 0, labels[0]!, "BOTTOM_LEFT"));
  const top = builder.addPoint(vertex("appliedTop", 0, 6, labels[1]!, "TOP_LEFT"));
  const ground = builder.addPoint(vertex("appliedGround", 6, 0, labels[2]!, "BOTTOM_RIGHT"));
  builder.addSegment("appliedWall", foot, top);
  builder.addSegment("appliedGroundSegment", foot, ground);
  builder.addSegment("appliedHypotenuse", top, ground);
  builder.addRightAngle(foot, top, ground);
  const map = new Map([
    ["wall", "appliedWall"],
    ["height", "appliedWall"],
    ["h", "appliedWall"],
    ["ground", "appliedGroundSegment"],
    ["distance", "appliedGroundSegment"],
    ["ladder", "appliedHypotenuse"],
    [normalizeTarget(`${labels[0]}${labels[1]}`), "appliedWall"],
    [normalizeTarget(`${labels[0]}${labels[2]}`), "appliedGroundSegment"],
    [normalizeTarget(`${labels[1]}${labels[2]}`), "appliedHypotenuse"],
  ]);
  addDimensions(builder, intent, map, foot);
  return builder.build();
}

function compileAppliedRightTrianglePair(intent: SpatialIntent) {
  const [aLabel, bLabel, hLabel, aPrimeLabel, bPrimeLabel, hPrimeLabel] =
    intent.pointLabels;
  const builder = new DiagramBuilder(
    { minX: -1.2, minY: -1.3, width: 12.4, height: 6.8 },
    intent.caption,
  );
  const h = builder.addPoint(vertex("appliedLeftH", 0, 0, hLabel!, "BOTTOM_LEFT"));
  const b = builder.addPoint(vertex("appliedLeftB", 0, 4, bLabel!, "TOP_LEFT"));
  const a = builder.addPoint(vertex("appliedLeftA", 3, 0, aLabel!, "BOTTOM_RIGHT"));
  const hPrime = builder.addPoint(
    vertex("appliedRightH", 7, 0, hPrimeLabel!, "BOTTOM_LEFT"),
  );
  const bPrime = builder.addPoint(
    vertex("appliedRightB", 7, 4, bPrimeLabel!, "TOP_LEFT"),
  );
  const aPrime = builder.addPoint(
    vertex("appliedRightA", 10, 0, aPrimeLabel!, "BOTTOM_RIGHT"),
  );
  const segments = new Map<string, { id: string; fallbackPointId: string }>();
  const addNamedSegment = (
    id: string,
    from: string,
    to: string,
    name: string,
    fallbackPointId: string,
  ) => {
    builder.addSegment(id, from, to);
    segments.set(normalizeTarget(name), { id, fallbackPointId });
  };
  addNamedSegment("appliedLeftWall", h, b, `${hLabel}${bLabel}`, h);
  addNamedSegment("appliedLeftGround", h, a, `${hLabel}${aLabel}`, h);
  addNamedSegment("appliedLeftHypotenuse", a, b, `${aLabel}${bLabel}`, a);
  addNamedSegment(
    "appliedRightWall",
    hPrime,
    bPrime,
    `${hPrimeLabel}${bPrimeLabel}`,
    hPrime,
  );
  addNamedSegment(
    "appliedRightGround",
    hPrime,
    aPrime,
    `${hPrimeLabel}${aPrimeLabel}`,
    hPrime,
  );
  addNamedSegment(
    "appliedRightHypotenuse",
    aPrime,
    bPrime,
    `${aPrimeLabel}${bPrimeLabel}`,
    aPrime,
  );
  builder.addRightAngle(h, b, a);
  builder.addRightAngle(hPrime, bPrime, aPrime);

  const dimensionGroups = new Map<
    string,
    Array<{ segmentId: string; fallbackPointId: string; text: string }>
  >();
  for (const dimension of intent.dimensions) {
    const segment = segments.get(normalizeTarget(dimension.target));
    if (!segment) continue;
    const text = `${dimension.value} ${dimension.unit}`;
    const groupKey = `${dimension.value}|${dimension.unit}`;
    const group = dimensionGroups.get(groupKey) ?? [];
    if (!group.some((entry) => entry.segmentId === segment.id)) {
      group.push({ segmentId: segment.id, fallbackPointId: segment.fallbackPointId, text });
      dimensionGroups.set(groupKey, group);
    }
  }
  let markCount = 1;
  for (const group of dimensionGroups.values()) {
    if (group.length > 1) {
      builder.addEqualLengths(
        group.map((entry) => entry.segmentId),
        markCount,
      );
      markCount += 1;
    }
    const first = group[0];
    if (!first) continue;
    builder.addLabel({
      text: first.text,
      anchorPointId: first.fallbackPointId,
      anchorPrimitiveId: first.segmentId,
      position: "TOP",
    });
  }
  return builder.build();
}

function addDimensions(
  builder: DiagramBuilder,
  intent: SpatialIntent,
  segments: Map<string, string>,
  fallbackPointId: string,
  positionByTarget: Map<
    string,
    "TOP" | "TOP_RIGHT" | "RIGHT" | "BOTTOM_RIGHT" | "BOTTOM" | "BOTTOM_LEFT" | "LEFT" | "TOP_LEFT"
  > = new Map(),
) {
  for (const dimension of intent.dimensions) {
    const target = normalizeTarget(dimension.target);
    const segmentId = segments.get(dimension.target.toLowerCase()) ?? segments.get(target);
    builder.addLabel({
      text: `${dimension.value} ${dimension.unit}`,
      anchorPointId: fallbackPointId,
      anchorPrimitiveId: segmentId ?? null,
      position: positionByTarget.get(target) ?? "TOP",
    });
  }
}

function resolveLabels(provided: string[], count: number, defaults: string[]) {
  if (
    provided.length === count &&
    defaults.length === count &&
    defaults.every((label) => provided.includes(label))
  ) {
    return defaults;
  }
  return Array.from({ length: count }, (_, index) => provided[index] ?? defaults[index]!);
}

export function canonicalSpatialPointLabels(intent: SpatialIntent) {
  if (intent.archetype === "CUBOID") {
    return resolveLabels(intent.pointLabels, 8, ["A", "B", "C", "D", "E", "F", "G", "H"]);
  }
  if (intent.archetype === "PRISM_OR_PYRAMID") {
    if (intent.variant === "PYRAMID") {
      return resolveLabels(intent.pointLabels, 5, ["A", "B", "C", "D", "S"]);
    }
    if (intent.variant === "TRIANGULAR_PYRAMID") {
      return resolveLabels(intent.pointLabels, 4, ["A", "B", "C", "S"]);
    }
    return resolveLabels(intent.pointLabels, 6, ["A", "B", "C", "A'", "B'", "C'"]);
  }
  if (intent.archetype === "CYLINDER") {
    return resolveLabels(intent.pointLabels, 3, ["O", "O′", "A"]);
  }
  if (intent.archetype === "CONE_OR_SPHERE") {
    return intent.variant === "SPHERE"
      ? resolveLabels(intent.pointLabels, 2, ["O", "A"])
      : resolveLabels(intent.pointLabels, 3, ["O", "S", "A"]);
  }
  if (intent.archetype === "APPLIED_RIGHT_TRIANGLE") {
    return intent.pointLabels.length >= 6
      ? intent.pointLabels.slice(0, 6)
      : resolveLabels(intent.pointLabels, 3, ["A", "B", "C"]);
  }
  return intent.pointLabels;
}

function normalizeTarget(value: string) {
  return [...value.toLowerCase()].sort().join("");
}

function vertex(
  id: string,
  x: number,
  y: number,
  label: string,
  labelPosition: "TOP" | "TOP_RIGHT" | "RIGHT" | "BOTTOM_RIGHT" | "BOTTOM" | "BOTTOM_LEFT" | "LEFT" | "TOP_LEFT",
) {
  return { id, x, y, label, pointStyle: "NONE" as const, labelPosition };
}

function center(id: string, x: number, y: number, label: string) {
  return {
    id,
    x,
    y,
    label,
    pointStyle: "FILLED" as const,
    labelPosition: "BOTTOM_RIGHT" as const,
  };
}

function hidden(id: string, x: number, y: number) {
  return {
    id,
    x,
    y,
    label: null,
    pointStyle: "NONE" as const,
    labelPosition: "TOP" as const,
  };
}

function addEllipseHalves(
  builder: DiagramBuilder,
  id: string,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
) {
  const addHalf = (
    suffix: string,
    startDegrees: number,
    style: "SOLID" | "DASHED",
  ) => {
    const pointIds = Array.from({ length: 17 }, (_, index) => {
      const angle = ((startDegrees + (180 * index) / 16) * Math.PI) / 180;
      return builder.addPoint(
        hidden(
          `${id}${suffix}Point${index}`,
          centerX + radiusX * Math.cos(angle),
          centerY + radiusY * Math.sin(angle),
        ),
      );
    });
    builder.addPolyline(`${id}${suffix}`, pointIds, style);
  };
  addHalf("Back", 0, "DASHED");
  addHalf("Front", 180, "SOLID");
}
