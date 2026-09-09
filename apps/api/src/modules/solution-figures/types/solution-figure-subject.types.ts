export type SolutionFigureSubjectKey = "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";

export type SolutionFigureSubjectSnapshot = {
  key: SolutionFigureSubjectKey;
  name: string;
  slug: string;
};
