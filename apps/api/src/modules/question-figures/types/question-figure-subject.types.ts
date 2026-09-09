export type QuestionFigureSubjectKey = "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";

export type QuestionFigureSubjectSnapshot = {
  key: QuestionFigureSubjectKey;
  name: string;
  slug: string;
};
