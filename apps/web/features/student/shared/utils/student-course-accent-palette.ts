import type { CSSProperties } from "react";
import { getStudentCourseAudienceStyle } from "@/features/student/shared/utils/student-course-audience-palette";

export function getStudentCourseAccentStyle({
  accentCount,
  accentIndex,
  targetAudienceCode,
  targetAudienceGrade = 0,
  targetAudienceName = "",
}: {
  accentCount: number;
  accentIndex: number;
  targetAudienceCode?: string;
  targetAudienceGrade?: number;
  targetAudienceName?: string;
}): CSSProperties {
  const normalizedAccentIndex = Math.max(0, Math.floor(accentIndex));
  const safeAccentCount = Math.max(1, Math.floor(accentCount), normalizedAccentIndex + 1);
  const isSupportingAccent = normalizedAccentIndex % 2 === 1;
  const supportingAccentCount = Math.floor(safeAccentCount / 2);
  const blueAccentCount = safeAccentCount - supportingAccentCount;
  const supportingAccentIndex = Math.floor(normalizedAccentIndex / 2);
  const blueAccentIndex = normalizedAccentIndex - supportingAccentIndex;

  const hue = isSupportingAccent
    ? getSupportingAccentHue(supportingAccentIndex)
    : 196 + ((blueAccentIndex + 0.5) / blueAccentCount) * 36;
  const saturation = 66 + ((normalizedAccentIndex * 5) % 9);
  const lightness = 79 + ((normalizedAccentIndex * 5) % 6);
  const darkSaturation = Math.max(54, saturation - 10);
  const darkLightness = 58 + ((normalizedAccentIndex * 3) % 5);
  const strongSaturation = Math.min(86, saturation + 8);
  const strongLightness = Math.max(60, lightness - 16);
  const darkStrongSaturation = Math.min(86, darkSaturation + 8);
  const darkStrongLightness = Math.min(68, darkLightness + 5);

  return {
    ...getStudentCourseAudienceStyle({
      fallbackHue: hue,
      targetAudienceCode,
      targetAudienceGrade,
      targetAudienceName,
    }),
    "--student-course-accent": `hsl(${hue.toFixed(3)} ${saturation}% ${lightness}%)`,
    "--student-course-accent-dark": `hsl(${hue.toFixed(3)} ${darkSaturation}% ${darkLightness}%)`,
    "--student-course-accent-strong": `hsl(${hue.toFixed(3)} ${strongSaturation}% ${strongLightness}%)`,
    "--student-course-accent-dark-strong": `hsl(${hue.toFixed(3)} ${darkStrongSaturation}% ${darkStrongLightness}%)`,
  } as CSSProperties;
}

function getSupportingAccentHue(accentIndex: number): number {
  const supportingHues = [48, 8, 142, 25, 172, 185] as const;
  const paletteCycle = Math.floor(accentIndex / supportingHues.length);
  const baseHue =
    supportingHues[accentIndex % supportingHues.length] ?? supportingHues[0];

  return baseHue + paletteCycle * 2.75;
}
