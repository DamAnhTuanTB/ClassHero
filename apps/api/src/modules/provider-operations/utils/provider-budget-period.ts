export type ProviderBudgetPeriod = {
  key: string;
  start: Date;
  end: Date;
};

export function getProviderBudgetPeriod(
  date: Date,
  timeZone: string,
): ProviderBudgetPeriod {
  const local = getZonedParts(date, timeZone);
  const nextMonth = local.month === 12 ? 1 : local.month + 1;
  const nextYear = local.month === 12 ? local.year + 1 : local.year;

  return {
    key: `${local.year}-${String(local.month).padStart(2, "0")}`,
    start: zonedDateTimeToUtc(local.year, local.month, 1, timeZone),
    end: zonedDateTimeToUtc(nextYear, nextMonth, 1, timeZone),
  };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, timeZone: string) {
  const desiredUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let result = new Date(desiredUtc);

  for (let index = 0; index < 2; index += 1) {
    const actual = getZonedParts(result, timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    result = new Date(result.getTime() + desiredUtc - actualAsUtc);
  }

  return result;
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}
