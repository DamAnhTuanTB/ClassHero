import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import {
  DiagramBuilder,
  safeDiagramId,
} from "#api/modules/ai/utils/diagram-compilers/diagram-builder";

type SchematicIntent = Extract<
  LessonSummaryDiagramIntent,
  { family: "SET_SCHEMATIC" }
>;

export function compileSchematicDiagram(
  intent: SchematicIntent,
): LessonSummaryDiagramSpec {
  validateEdges(intent);
  switch (intent.archetype) {
    case "VENN":
      return compileVenn(intent);
    case "VENN_UNIVERSE":
      return compileVenn(intent, true);
    case "TREE":
      return compileTree(intent);
    case "FLOW":
      return compileFlow(intent);
    case "NETWORK":
      return compileNetwork(intent);
  }
}

function compileVenn(intent: SchematicIntent, hasUniverse = false) {
  const hasExplicitUniverseLabel =
    hasUniverse && /^(?:U|Ω)$/iu.test(intent.setLabels[0]?.trim() ?? "");
  const hasExplicitUniverseContext =
    hasExplicitUniverseLabel || /(?:tập\s*)?vũ\s*trụ|universe/iu.test(intent.caption ?? "");
  const renderUniverse = hasUniverse && hasExplicitUniverseContext;
  const universeLabel = renderUniverse
    ? hasExplicitUniverseLabel
      ? intent.setLabels[0]!
      : "U"
    : null;
  const setLabels = hasExplicitUniverseLabel
    ? intent.setLabels.slice(1)
    : intent.setLabels;
  if (setLabels.length < 1 || setLabels.length > 3) {
    throw new Error("A Venn diagram needs between one and three set labels.");
  }
  const builder = new DiagramBuilder(
    { minX: -5, minY: -3.5, width: 10, height: 7.5 },
    intent.caption,
  );
  if (renderUniverse && universeLabel) {
    const universeCorners = [
      builder.addPoint(hidden("vennUniverseA", -4.55, -3)),
      builder.addPoint(hidden("vennUniverseB", 4.55, -3)),
      builder.addPoint(hidden("vennUniverseC", 4.55, 3.2)),
      builder.addPoint(hidden("vennUniverseD", -4.55, 3.2)),
    ];
    builder.addPolygon("vennUniverse", universeCorners);
    const universeAnchor = builder.addPoint(hidden("vennUniverseLabel", -4.05, 2.7));
    builder.addLabel({
      text: universeLabel,
      anchorPointId: universeAnchor,
      anchorPrimitiveId: null,
      position: "CENTER",
    });
  }
  const centers: Array<readonly [number, number]> =
    setLabels.length === 1
      ? [[0, 0]]
      : setLabels.length === 2
        ? [[-1.4, 0], [1.4, 0]]
        : [[-1.5, 0.8], [1.5, 0.8], [0, -1.2]];
  for (const [index, setLabel] of setLabels.entries()) {
    const [x, y] = centers[index]!;
    const centerId = builder.addPoint(hidden(safeDiagramId("vennCenter", index), x, y));
    builder.addEllipse(safeDiagramId("vennSet", index), centerId, 2.3, 1.8);
    const labelPosition =
      setLabels.length === 3 && index === 2
        ? ([x, y - 1.05] as const)
        : ([x, y + 1.15] as const);
    const labelAnchor = builder.addPoint(
      hidden(safeDiagramId("vennSetLabel", index), labelPosition[0], labelPosition[1]),
    );
    builder.addLabel({
      text: setLabel,
      anchorPointId: labelAnchor,
      anchorPrimitiveId: null,
      position: "CENTER",
    });
  }
  let outsideNodeIndex = 0;
  for (const [index, node] of intent.nodes.entries()) {
    const group = canonicalVennGroup(node.group, setLabels);
    const isOutsideAllSets = group === null;
    const base = isOutsideAllSets
      ? renderUniverse
        ? ([3.55, -2.25] as const)
        : ([3.35, 2.35] as const)
      : resolveVennGroupCenter(group, setLabels, centers);
    const isIntersection = group?.includes("&") ?? false;
    const offsetX = isOutsideAllSets
      ? (outsideNodeIndex % 2) * 0.5 - 0.25
      : isIntersection
        ? 0
        : ((index % 3) - 1) * 0.55;
    const offsetY = isOutsideAllSets
      ? -Math.floor(outsideNodeIndex / 2) * 0.4
      : isIntersection
        ? 0
        : (Math.floor(index / 3) % 3 - 1) * 0.45;
    if (isOutsideAllSets) outsideNodeIndex += 1;
    const anchor = builder.addPoint(
      hidden(safeDiagramId("vennNode", index), base[0] + offsetX, base[1] + offsetY),
    );
    builder.addLabel({
      text: node.label,
      anchorPointId: anchor,
      anchorPrimitiveId: null,
      position: "CENTER",
    });
  }
  return builder.build();
}

export function canonicalVennGroup(group: string | null, setLabels: string[]) {
  if (!group) return null;
  const normalizedGroup = group
    .normalize("NFKC")
    .toLocaleUpperCase("vi-VN")
    .replaceAll("∩", "&")
    .replaceAll("INTERSECTION", "&")
    .replaceAll("INTERSECT", "&")
    .replaceAll("ONLY", "")
    .replaceAll(/[^\p{L}\p{N}&]/gu, "");
  const matchedLabels = setLabels.filter((label) => {
    const normalizedLabel = label
      .normalize("NFKC")
      .toLocaleUpperCase("vi-VN")
      .replaceAll(/[^\p{L}\p{N}]/gu, "");
    return normalizedLabel.length > 0 && normalizedGroup.includes(normalizedLabel);
  });
  return matchedLabels.length > 0 ? matchedLabels.join("&") : group;
}

function resolveVennGroupCenter(
  group: string | null,
  setLabels: string[],
  centers: Array<readonly [number, number]>,
): readonly [number, number] {
  if (!group) return [0, 0];
  const groupLabels = group
    .split("&")
    .map((label) => label.trim())
    .filter(Boolean);
  const groupCenters = groupLabels
    .map((label) => centers[setLabels.indexOf(label)])
    .filter((center): center is readonly [number, number] => center !== undefined);
  if (groupCenters.length === 0) return [0, 0];
  return [
    groupCenters.reduce((sum, center) => sum + center[0], 0) / groupCenters.length,
    groupCenters.reduce((sum, center) => sum + center[1], 0) / groupCenters.length,
  ];
}

function compileTree(intent: SchematicIntent) {
  const layers = computeTreeLayers(intent);
  const xByNodeId = computeTreeXCoordinates(intent);
  const maximumX = Math.max(...xByNodeId.values(), 0);
  const levelSpacing = 3.4;
  const builder = new DiagramBuilder(
    {
      minX: -1.5,
      minY: -1.4,
      width: Math.max(maximumX + 3, 6),
      height: Math.max((layers.length - 1) * levelSpacing + 2.8, 5),
    },
    intent.caption,
  );
  const positions = new Map<string, { x: number; y: number; pointId: string }>();
  for (const [layerIndex, layer] of layers.entries()) {
    for (const [nodeIndex, node] of layer.entries()) {
      const x = xByNodeId.get(node.id)!;
      const y = (layers.length - layerIndex - 1) * levelSpacing;
      const pointId = builder.addPoint(hidden(`treeNode${layerIndex}Index${nodeIndex}`, x, y));
      positions.set(node.id, { x, y, pointId });
      const isRootLayer = layerIndex === 0;
      const isLeafLayer = layerIndex === layers.length - 1;
      builder.addLabel({
        text: node.label,
        anchorPointId: pointId,
        anchorPrimitiveId: null,
        position: isRootLayer
          ? "TOP"
          : isLeafLayer
            ? "BOTTOM"
            : x <= maximumX / 2
              ? "LEFT"
              : "RIGHT",
      });
    }
  }
  addSchematicEdges(builder, intent, positions, "treeEdge");
  return builder.build();
}

function computeTreeXCoordinates(intent: SchematicIntent) {
  const incoming = new Map<string, number>(
    intent.nodes.map((node) => [node.id, 0] as const),
  );
  const children = new Map<string, string[]>(
    intent.nodes.map((node) => [node.id, [] as string[]] as const),
  );
  for (const edge of intent.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    children.get(edge.from)?.push(edge.to);
  }

  const roots = intent.nodes
    .map((node) => node.id)
    .filter((id) => incoming.get(id) === 0);
  const xByNodeId = new Map<string, number>();
  let nextLeafX = 0;
  const leafSpacing = 3.4;
  const placeNode = (nodeId: string): number => {
    const cached = xByNodeId.get(nodeId);
    if (cached !== undefined) return cached;
    const childIds = children.get(nodeId) ?? [];
    if (childIds.length === 0) {
      const x = nextLeafX;
      nextLeafX += leafSpacing;
      xByNodeId.set(nodeId, x);
      return x;
    }
    const childXs = childIds.map(placeNode);
    const x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    xByNodeId.set(nodeId, x);
    return x;
  };
  for (const root of roots) placeNode(root);
  return xByNodeId;
}

function compileFlow(intent: SchematicIntent) {
  const builder = new DiagramBuilder(
    { minX: -1, minY: -2, width: intent.nodes.length * 3.6 + 2, height: 4 },
    intent.caption,
  );
  const positions = new Map<string, { x: number; y: number; pointId: string }>();
  for (const [index, node] of intent.nodes.entries()) {
    const x = index * 3.6;
    const y = 0;
    const centerId = builder.addPoint(hidden(safeDiagramId("flowCenter", index), x, y));
    positions.set(node.id, { x, y, pointId: centerId });
    const rectangle = [
      builder.addPoint(hidden(`flow${index}A`, x - 1.2, y - 0.65)),
      builder.addPoint(hidden(`flow${index}B`, x + 1.2, y - 0.65)),
      builder.addPoint(hidden(`flow${index}C`, x + 1.2, y + 0.65)),
      builder.addPoint(hidden(`flow${index}D`, x - 1.2, y + 0.65)),
    ];
    builder.addPolygon(safeDiagramId("flowNode", index), rectangle, "SOFT_BLUE");
    builder.addLabel({
      text: node.label,
      anchorPointId: centerId,
      anchorPrimitiveId: null,
      position: "CENTER",
    });
  }
  addFlowEdges(builder, intent, positions);
  return builder.build();
}

function addFlowEdges(
  builder: DiagramBuilder,
  intent: SchematicIntent,
  positions: Map<string, { x: number; y: number; pointId: string }>,
) {
  for (const [index, edge] of intent.edges.entries()) {
    const from = positions.get(edge.from)!;
    const to = positions.get(edge.to)!;
    const direction = to.x >= from.x ? 1 : -1;
    const edgeStart = builder.addPoint(
      hidden(safeDiagramId("flowEdgeStart", index), from.x + direction * 1.2, from.y),
    );
    const edgeEnd = builder.addPoint(
      hidden(safeDiagramId("flowEdgeEnd", index), to.x - direction * 1.2, to.y),
    );
    const segmentId = builder.addSegment(
      safeDiagramId("flowEdge", index),
      edgeStart,
      edgeEnd,
    );
    const arrowUpper = builder.addPoint(
      hidden(
        safeDiagramId("flowArrowUpper", index),
        to.x - direction * 1.48,
        to.y + 0.18,
      ),
    );
    const arrowLower = builder.addPoint(
      hidden(
        safeDiagramId("flowArrowLower", index),
        to.x - direction * 1.48,
        to.y - 0.18,
      ),
    );
    builder.addSegment(safeDiagramId("flowArrowWingUpper", index), arrowUpper, edgeEnd);
    builder.addSegment(safeDiagramId("flowArrowWingLower", index), arrowLower, edgeEnd);
    if (!edge.label) continue;
    const anchor = builder.addPoint(
      hidden(
        safeDiagramId("flowEdgeLabel", index),
        (from.x + to.x) / 2,
        (from.y + to.y) / 2,
      ),
    );
    builder.addLabel({
      text: edge.label,
      anchorPointId: anchor,
      anchorPrimitiveId: segmentId,
      position: "TOP",
    });
  }
}

function compileNetwork(intent: SchematicIntent) {
  const radius = Math.max(intent.nodes.length * 0.55, 2.5);
  const builder = new DiagramBuilder(
    { minX: -radius - 2, minY: -radius - 2, width: radius * 2 + 4, height: radius * 2 + 4.5 },
    intent.caption,
  );
  const positions = new Map<string, { x: number; y: number; pointId: string }>();
  for (const [index, node] of intent.nodes.entries()) {
    const angle = (2 * Math.PI * index) / intent.nodes.length + Math.PI / 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const pointId = builder.addPoint({
      id: safeDiagramId("networkNode", index),
      x,
      y,
      label: null,
      pointStyle: "FILLED",
      labelPosition: "TOP",
    });
    positions.set(node.id, { x, y, pointId });
    builder.addLabel({
      text: node.label,
      anchorPointId: pointId,
      anchorPrimitiveId: null,
      position: x >= 0 ? "RIGHT" : "LEFT",
    });
  }
  addSchematicEdges(builder, intent, positions, "networkEdge");
  return builder.build();
}

function addSchematicEdges(
  builder: DiagramBuilder,
  intent: SchematicIntent,
  positions: Map<string, { x: number; y: number; pointId: string }>,
  prefix: string,
) {
  for (const [index, edge] of intent.edges.entries()) {
    const from = positions.get(edge.from)!;
    const to = positions.get(edge.to)!;
    const segmentId = builder.addSegment(
      safeDiagramId(prefix, index),
      from.pointId,
      to.pointId,
    );
    if (!edge.label) continue;
    const anchor = builder.addPoint(
      hidden(
        safeDiagramId(`${prefix}Label`, index),
        (from.x + to.x) / 2,
        (from.y + to.y) / 2,
      ),
    );
    builder.addLabel({
      text: edge.label,
      anchorPointId: anchor,
      anchorPrimitiveId: segmentId,
      position: "TOP",
    });
  }
}

function computeTreeLayers(intent: SchematicIntent) {
  const nodesById = new Map(intent.nodes.map((node) => [node.id, node] as const));
  const incoming = new Map<string, number>(
    intent.nodes.map((node) => [node.id, 0] as const),
  );
  const children = new Map<string, string[]>(
    intent.nodes.map((node) => [node.id, [] as string[]] as const),
  );
  for (const edge of intent.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    children.get(edge.from)?.push(edge.to);
  }
  let current = [...incoming.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  if (current.length === 0) throw new Error("A tree requires at least one root.");
  const layers: SchematicIntent["nodes"][] = [];
  const visited = new Set<string>();
  while (current.length > 0) {
    const layer = current.map((id) => nodesById.get(id)!).filter(Boolean);
    layers.push(layer);
    const next: string[] = [];
    for (const id of current) {
      visited.add(id);
      for (const child of children.get(id) ?? []) {
        incoming.set(child, (incoming.get(child) ?? 1) - 1);
        if (incoming.get(child) === 0) next.push(child);
      }
    }
    current = next;
  }
  if (visited.size !== intent.nodes.length) throw new Error("A tree cannot contain cycles.");
  return layers;
}

function validateEdges(intent: SchematicIntent) {
  const nodeIds = new Set(intent.nodes.map((node) => node.id));
  for (const edge of intent.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Edge ${edge.from}->${edge.to} references an unknown node.`);
    }
    if (edge.from === edge.to) throw new Error("A schematic edge cannot be a self-loop.");
  }
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
