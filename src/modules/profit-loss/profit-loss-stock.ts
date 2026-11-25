import { GlAccountRow, round } from './profit-loss-statement.builder';

/** One stock set's month-end valuation (StockPBalance joined to StockSet). */
export interface StockValueRow {
  stockSetKey: number;
  openStockAccNo: string;
  closeStockAccNo: string;
  periodNo: number;
  balance: number;
}

/**
 * AutoCount keeps month-end stock valuations outside the ledger: they reach the P&L by
 * adding the valuation before the range to the "opening stock" account and deducting the
 * valuation at the end of the range from the "closing stock" account, both within cost
 * of goods sold. A month with no valuation carries the latest earlier one forward.
 */
export function applyStockValues(
  rows: GlAccountRow[],
  stockRows: StockValueRow[],
  fromPeriod: number,
  toPeriod: number,
): GlAccountRow[] {
  const adjustments = new Map<string, number>();
  const add = (accNo: string, amount: number) =>
    adjustments.set(accNo, (adjustments.get(accNo) ?? 0) + amount);

  for (const setRows of groupByStockSet(stockRows).values()) {
    const opening = latestAtOrBefore(setRows, fromPeriod - 1);
    const closing = latestAtOrBefore(setRows, toPeriod);
    if (opening) add(opening.openStockAccNo, opening.balance);
    if (closing) add(closing.closeStockAccNo, -closing.balance);
  }

  return rows.map((row) => {
    const adjustment = adjustments.get(row.accountCode);
    if (adjustment === undefined || row.accType !== 'CO') return row;
    return {
      ...row,
      amount: round(row.amount + adjustment),
      hasStockValue: true,
    };
  });
}

/** The period closing stock was actually valued at, when that is before `toPeriod`. */
export function carriedForwardFrom(
  stockRows: StockValueRow[],
  toPeriod: number,
): number | null {
  let oldest: number | null = null;
  for (const setRows of groupByStockSet(stockRows).values()) {
    const closing = latestAtOrBefore(setRows, toPeriod);
    if (!closing || closing.periodNo === toPeriod) continue;
    if (oldest === null || closing.periodNo < oldest) oldest = closing.periodNo;
  }
  return oldest;
}

function groupByStockSet(rows: StockValueRow[]): Map<number, StockValueRow[]> {
  const groups = new Map<number, StockValueRow[]>();
  for (const row of rows) {
    const group = groups.get(row.stockSetKey);
    if (group) group.push(row);
    else groups.set(row.stockSetKey, [row]);
  }
  return groups;
}

function latestAtOrBefore(
  rows: StockValueRow[],
  periodNo: number,
): StockValueRow | undefined {
  let latest: StockValueRow | undefined;
  for (const row of rows) {
    if (row.periodNo > periodNo) continue;
    if (!latest || row.periodNo > latest.periodNo) latest = row;
  }
  return latest;
}
