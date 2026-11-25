import type { BreakdownInterval } from './dto/profit-loss-query.dto';

/**
 * AutoCount numbers accounting periods as `year * 12 + month` (month 1-12) in every
 * period-balance table (PBalance, BudgetPBalance, StockPBalance), e.g. Sep 2020 = 24249.
 */
export function toPeriodNo(isoDate: string): number {
  const { year, month } = parse(isoDate);
  return year * 12 + month;
}

export function fromPeriodNo(periodNo: number): {
  year: number;
  month: number;
} {
  const zeroBased = periodNo - 1;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function periodLabel(periodNo: number): string {
  const { year, month } = fromPeriodNo(periodNo);
  return `${MONTHS[month - 1]} ${year}`;
}

/** True when the range starts on the 1st and ends on the last day of a month. */
export function isWholeMonths(fromDate: string, toDate: string): boolean {
  const to = parse(toDate);
  return (
    parse(fromDate).day === 1 && to.day === lastDayOfMonth(to.year, to.month)
  );
}

/**
 * The same range one year earlier. A month-end stays a month-end, so Feb 2024 (29 days)
 * and Feb 2025 (28 days) are compared as whole months in both directions.
 */
export function shiftRangeToPriorYear(
  fromDate: string,
  toDate: string,
): { fromDate: string; toDate: string } {
  return {
    fromDate: shiftYear(fromDate, false),
    toDate: shiftYear(toDate, true),
  };
}

/** The same date one year earlier; a month-end stays a month-end. */
export function shiftDateToPriorYear(isoDate: string): string {
  return shiftYear(isoDate, true);
}

export interface PeriodBucket {
  key: string;
  label: string;
  fromPeriod: number;
  toPeriod: number;
}

/** Splits a range into calendar months or quarters, clipped to the months it touches. */
export function enumerateBuckets(
  fromDate: string,
  toDate: string,
  interval: BreakdownInterval,
): PeriodBucket[] {
  const first = toPeriodNo(fromDate);
  const last = toPeriodNo(toDate);
  const buckets: PeriodBucket[] = [];

  for (let periodNo = first; periodNo <= last; periodNo++) {
    const { year, month } = fromPeriodNo(periodNo);
    const quarter = Math.ceil(month / 3);
    const key =
      interval === 'monthly'
        ? `${year}-${String(month).padStart(2, '0')}`
        : `${year}-Q${quarter}`;

    const previous = buckets.at(-1);
    if (previous?.key === key) {
      previous.toPeriod = periodNo;
      continue;
    }
    buckets.push({
      key,
      label:
        interval === 'monthly' ? periodLabel(periodNo) : `Q${quarter} ${year}`,
      fromPeriod: periodNo,
      toPeriod: periodNo,
    });
  }

  return buckets;
}

function parse(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day };
}

/** True on the last day of a month, when month-end stock valuations are exact. */
export function isMonthEnd(isoDate: string): boolean {
  const { year, month, day } = parse(isoDate);
  return day === lastDayOfMonth(year, month);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftYear(isoDate: string, keepMonthEnd: boolean): string {
  const { year, month, day } = parse(isoDate);
  const lastDay = lastDayOfMonth(year - 1, month);
  const wasMonthEnd = day === lastDayOfMonth(year, month);
  const shiftedDay =
    keepMonthEnd && wasMonthEnd ? lastDay : Math.min(day, lastDay);
  return [
    String(year - 1).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(shiftedDay).padStart(2, '0'),
  ].join('-');
}
