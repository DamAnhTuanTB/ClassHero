import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { compileLessonSummaryDiagramIntent } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";

import { semanticDiagramVisualCases } from "./fixtures/math-diagram/semantic-visual-cases";

const outputPath = fileURLToPath(
  new URL("../../../tmp/m9-2-semantic-diagram-review.json", import.meta.url),
);

const examples = semanticDiagramVisualCases.map((visualCase) => {
  const compiled = compileLessonSummaryDiagramIntent(visualCase.intent);
  return {
    caseId: visualCase.caseId,
    title: visualCase.title,
    problem: visualCase.problem,
    family: visualCase.intent.family,
    difficulty: visualCase.intent.difficulty,
    compilerKey: compiled.diagnostics.compilerKey,
    diagramSpec: compiled.spec,
  };
});

mkdirSync(fileURLToPath(new URL("../../../tmp/", import.meta.url)), {
  recursive: true,
});
writeFileSync(
  outputPath,
  `${JSON.stringify({ version: 1, source: "DETERMINISTIC_COMPILER", examples }, null, 2)}\n`,
  "utf8",
);

process.stdout.write(`Generated ${examples.length} semantic diagram fixtures at ${outputPath}\n`);
