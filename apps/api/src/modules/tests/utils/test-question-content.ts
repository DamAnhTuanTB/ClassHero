/**
 * Student Test scoring still has a Test-specific database contract. Admin question
 * validation and explanation synchronization live in the assessments module.
 */
export function calculateEffectivePoints(
  storedPoints: Array<number | null>,
  totalScore: number,
) {
  const explicitTotal = storedPoints.reduce(
    (sum: number, points) => sum + (points ?? 0),
    0,
  );
  const automaticCount = storedPoints.filter((points) => points === null).length;
  const remainingHundredths = Math.max(0, Math.round((totalScore - explicitTotal) * 100));
  const baseHundredths =
    automaticCount === 0 ? 0 : Math.floor(remainingHundredths / automaticCount);
  let remainder = automaticCount === 0 ? 0 : remainingHundredths % automaticCount;

  return storedPoints.map((points) => {
    if (points !== null) return points;
    const hundredths = baseHundredths + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return hundredths / 100;
  });
}
