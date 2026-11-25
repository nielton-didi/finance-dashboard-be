import { nextDay } from '../profit-loss/profit-loss-periods';

export interface FiscalYearRow {
  fromDate: string;
  toDate: string;
}

/**
 * The first day of the fiscal year a date falls in. AutoCount only lists the years that
 * have been opened, so a date outside them takes its start month from the nearest one.
 */
export function fiscalYearStart(
  years: FiscalYearRow[],
  asOfDate: string,
): string {
  const containing = years.find(
    (year) => year.fromDate <= asOfDate && asOfDate <= year.toDate,
  );
  if (containing) return containing.fromDate;

  const latest = years.reduce<FiscalYearRow | null>(
    (a, b) => (a === null || b.fromDate > a.fromDate ? b : a),
    null,
  );
  // The day after a year ends is when the next one starts, whatever its length.
  const monthDay = latest ? nextDay(latest.toDate).slice(5) : '01-01';
  const year = Number(asOfDate.slice(0, 4));
  const candidate = `${String(year).padStart(4, '0')}-${monthDay}`;
  return candidate <= asOfDate
    ? candidate
    : `${String(year - 1).padStart(4, '0')}-${monthDay}`;
}
