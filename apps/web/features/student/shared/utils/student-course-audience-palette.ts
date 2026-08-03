import type { CSSProperties } from "react";

const targetAudienceHues: Record<string, number> = {
  ALL_STUDENTS: 8,
  GRADE_3: 115,
  GRADE_4: 30,
  GRADE_5: 92,
  GRADE_6: 285,
  GRADE_7: 140,
  GRADE_8: 65,
  GRADE_9: 215,
  GRADE_10: 18,
  GRADE_11: 338,
  GRADE_12: 220,
  HIGH_SCHOOL: 240,
  PRIMARY_SCHOOL: 48,
  SECONDARY_SCHOOL: 188,
  WORKING_ADULT: 172,
};

export function getStudentCourseAudienceStyle({
  fallbackHue,
  targetAudienceCode,
  targetAudienceGrade,
  targetAudienceName,
}: {
  fallbackHue: number;
  targetAudienceCode?: string;
  targetAudienceGrade?: number | null;
  targetAudienceName?: string;
}): CSSProperties {
  const resolvedCode = resolveTargetAudienceCode(
    targetAudienceCode,
    targetAudienceName,
    targetAudienceGrade,
  );
  const audienceHue = resolvedCode
    ? (targetAudienceHues[resolvedCode] ?? fallbackHue)
    : fallbackHue;
  const audienceSaturation = 76;
  const audienceSurfaceLightness =
    resolvedCode === "GRADE_12" ? 96 : resolvedCode === "HIGH_SCHOOL" ? 95 : 93;
  const audienceTextLightness =
    resolvedCode === "GRADE_12" ? 44 : audienceHue >= 35 && audienceHue <= 180 ? 30 : 40;

  return {
    "--student-course-audience-bg": `hsl(${audienceHue} ${audienceSaturation}% ${audienceSurfaceLightness}%)`,
    "--student-course-audience-text": `hsl(${audienceHue} ${Math.max(audienceSaturation - 8, 50)}% ${audienceTextLightness}%)`,
    "--student-course-audience-dark-bg": `hsl(${audienceHue} ${audienceSaturation}% 80% / 14%)`,
    "--student-course-audience-dark-text": `hsl(${audienceHue} ${audienceSaturation}% 82%)`,
  } as CSSProperties;
}

function resolveTargetAudienceCode(
  targetAudienceCode: string | undefined,
  targetAudienceName: string | undefined,
  targetAudienceGrade: number | null | undefined,
) {
  const normalizedName = (targetAudienceName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (
    typeof targetAudienceGrade === "number" &&
    targetAudienceGrade >= 3 &&
    targetAudienceGrade <= 12 &&
    normalizedName === `khoi ${targetAudienceGrade}`
  ) {
    return `GRADE_${targetAudienceGrade}`;
  }

  if (targetAudienceCode) {
    return targetAudienceCode;
  }

  if (normalizedName.includes("nguoi di lam")) {
    return "WORKING_ADULT";
  }

  if (normalizedName.includes("toan khoi")) {
    return "ALL_STUDENTS";
  }

  if (normalizedName.includes("thpt")) {
    return "HIGH_SCHOOL";
  }

  if (normalizedName.includes("thcs")) {
    return "SECONDARY_SCHOOL";
  }

  if (normalizedName.includes("tieu hoc")) {
    return "PRIMARY_SCHOOL";
  }

  if (typeof targetAudienceGrade === "number") {
    if (targetAudienceGrade >= 10 && targetAudienceGrade <= 12) {
      return "HIGH_SCHOOL";
    }

    if (targetAudienceGrade >= 6 && targetAudienceGrade <= 9) {
      return "SECONDARY_SCHOOL";
    }

    if (targetAudienceGrade >= 3 && targetAudienceGrade <= 5) {
      return "PRIMARY_SCHOOL";
    }
  }

  return undefined;
}
