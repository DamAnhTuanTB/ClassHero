import type { SolutionFigureSubjectSnapshot } from "#api/modules/solution-figures/types/solution-figure-subject.types";
import { buildChemistrySolutionFigureSystemPrompt } from "#api/modules/solution-figures/utils/prompts/chemistry-solution-figure-system-prompt";
import { buildGeneralSolutionFigureSystemPrompt } from "#api/modules/solution-figures/utils/prompts/general-solution-figure-system-prompt";
import { buildMathSolutionFigureSystemPrompt } from "#api/modules/solution-figures/utils/prompts/math-solution-figure-system-prompt";
import { buildPhysicsSolutionFigureSystemPrompt } from "#api/modules/solution-figures/utils/prompts/physics-solution-figure-system-prompt";

export function buildSolutionFigureSystemPrompt(subject: SolutionFigureSubjectSnapshot) {
  switch (subject.key) {
    case "MATH":
      return buildMathSolutionFigureSystemPrompt(subject);
    case "PHYSICS":
      return buildPhysicsSolutionFigureSystemPrompt(subject);
    case "CHEMISTRY":
      return buildChemistrySolutionFigureSystemPrompt(subject);
    case "GENERAL":
      return buildGeneralSolutionFigureSystemPrompt(subject);
  }
}
