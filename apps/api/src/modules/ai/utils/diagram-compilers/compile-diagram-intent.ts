import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import {
  lessonSummaryDiagramIntentSchema,
  type LessonSummaryDiagramIntent,
} from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { compileAdvancedGeometryDiagram } from "#api/modules/ai/utils/diagram-compilers/compile-advanced-geometry-diagram";
import { compileCoordinateDiagram } from "#api/modules/ai/utils/diagram-compilers/compile-coordinate-diagram";
import { compileDataDiagram } from "#api/modules/ai/utils/diagram-compilers/compile-data-diagram";
import { compileElementaryDiagram } from "#api/modules/ai/utils/diagram-compilers/compile-elementary-diagram";
import { compileGraphDiagram } from "#api/modules/ai/utils/diagram-compilers/compile-graph-diagram";
import { compilePlaneGeometryDiagram } from "#api/modules/ai/utils/diagram-compilers/compile-plane-geometry-diagram";
import { compileSchematicDiagram } from "#api/modules/ai/utils/diagram-compilers/compile-schematic-diagram";
import { compileSpatialDiagram } from "#api/modules/ai/utils/diagram-compilers/compile-spatial-diagram";
import {
  assertCompiledDiagramSemantics,
  validateCompiledDiagramSemantics,
  type DiagramSemanticIssue,
} from "#api/modules/ai/utils/diagram-compilers/diagram-semantic-validator";

export type CompiledDiagram = {
  spec: LessonSummaryDiagramSpec;
  diagnostics: {
    intentVersion: 1;
    compilerKey: string;
    family: LessonSummaryDiagramIntent["family"];
    archetype: LessonSummaryDiagramIntent["archetype"];
  };
};

export function compileLessonSummaryDiagramIntent(input: unknown): CompiledDiagram {
  const compiled = compileLessonSummaryDiagramIntentWithDiagnostics(input);
  assertCompiledDiagramSemantics(compiled.intent, compiled.spec);
  const { intent: _intent, semanticIssues: _semanticIssues, ...result } = compiled;
  return result;
}

export type CompiledDiagramWithDiagnostics = CompiledDiagram & {
  intent: LessonSummaryDiagramIntent;
  semanticIssues: DiagramSemanticIssue[];
};

export function compileLessonSummaryDiagramIntentWithDiagnostics(
  input: unknown,
): CompiledDiagramWithDiagnostics {
  const intent = lessonSummaryDiagramIntentSchema.parse(input);
  const spec = compileByFamily(intent);
  return {
    intent,
    spec,
    semanticIssues: validateCompiledDiagramSemantics(intent, spec),
    diagnostics: {
      intentVersion: 1,
      compilerKey: resolveCompilerKey(intent),
      family: intent.family,
      archetype: intent.archetype,
    },
  };
}

function compileByFamily(intent: LessonSummaryDiagramIntent) {
  switch (intent.family) {
    case "ELEMENTARY_MODEL":
      return compileElementaryDiagram(intent);
    case "NUMBER_COORDINATE":
      return compileCoordinateDiagram(intent);
    case "ALGEBRA_GRAPH":
      return compileGraphDiagram(intent);
    case "DATA_STATISTICS":
      return compileDataDiagram(intent);
    case "PLANE_GEOMETRY":
      return compilePlaneGeometryDiagram(intent);
    case "ADVANCED_GEOMETRY":
      return compileAdvancedGeometryDiagram(intent);
    case "SPATIAL_APPLIED":
      return compileSpatialDiagram(intent);
    case "SET_SCHEMATIC":
      return compileSchematicDiagram(intent);
  }
}

function resolveCompilerKey(intent: LessonSummaryDiagramIntent) {
  if (intent.family === "ALGEBRA_GRAPH" && intent.archetype === "LINEAR_FUNCTION") {
    return "graph.linear.v1";
  }
  if (intent.family === "ALGEBRA_GRAPH" && intent.archetype === "QUADRATIC_FUNCTION") {
    return "graph.quadratic.v1";
  }
  if (intent.family === "SPATIAL_APPLIED" && intent.archetype === "CONE_OR_SPHERE") {
    return "spatial.cone-sphere.v1";
  }
  if (
    intent.family === "SPATIAL_APPLIED" &&
    intent.archetype === "PRISM_OR_PYRAMID"
  ) {
    return "spatial.prism-pyramid.v1";
  }
  if (
    intent.family === "PLANE_GEOMETRY" &&
    intent.archetype === "RIGHT_TRIANGLE_CONGRUENCE"
  ) {
    return "geometry.right-triangle-congruence.v1";
  }
  if (
    intent.family === "SET_SCHEMATIC" &&
    (intent.archetype === "VENN" || intent.archetype === "VENN_UNIVERSE")
  ) {
    return "schematic.venn.v1";
  }
  if (intent.family === "NUMBER_COORDINATE" && intent.archetype === "COORDINATE_POINTS") {
    return "coordinate.points.v1";
  }
  const suffix = intent.archetype.toLowerCase().replaceAll("_", "-");
  switch (intent.family) {
    case "ELEMENTARY_MODEL":
      return `elementary.${suffix}.v1`;
    case "NUMBER_COORDINATE":
      return `coordinate.${suffix}.v1`;
    case "ALGEBRA_GRAPH":
      return `graph.${suffix}.v1`;
    case "DATA_STATISTICS":
      return `data.${suffix}.v1`;
    case "PLANE_GEOMETRY":
    case "ADVANCED_GEOMETRY":
      return `geometry.${suffix}.v1`;
    case "SPATIAL_APPLIED":
      return `spatial.${suffix}.v1`;
    case "SET_SCHEMATIC":
      return `schematic.${suffix}.v1`;
  }
}
