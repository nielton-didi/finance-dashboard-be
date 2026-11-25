import {
  nextDay,
  shiftDateToPriorYear,
  shiftRangeToPriorYear,
} from '../profit-loss/profit-loss-periods';

export interface DateRange {
  fromDate: string;
  toDate: string;
}

export interface PerformanceRanges {
  mtd: DateRange;
  ytd: DateRange;
  ttm: DateRange;
}

/** Month to date, fiscal year to date and the twelve months ending on a date. */
export function performanceRanges(
  asOfDate: string,
  fiscalYearStart: string,
): { current: PerformanceRanges; prior: PerformanceRanges } {
  const mtd = { fromDate: `${asOfDate.slice(0, 8)}01`, toDate: asOfDate };
  const ytd = { fromDate: fiscalYearStart, toDate: asOfDate };
  const yearAgo = shiftDateToPriorYear(asOfDate);

  return {
    current: { mtd, ytd, ttm: twelveMonthsTo(asOfDate) },
    prior: {
      mtd: shiftRangeToPriorYear(mtd.fromDate, mtd.toDate),
      ytd: shiftRangeToPriorYear(ytd.fromDate, ytd.toDate),
      ttm: twelveMonthsTo(yearAgo),
    },
  };
}

function twelveMonthsTo(toDate: string): DateRange {
  return { fromDate: nextDay(shiftDateToPriorYear(toDate)), toDate };
}
