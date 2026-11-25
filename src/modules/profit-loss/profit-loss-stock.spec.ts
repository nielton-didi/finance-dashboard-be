import { GlAccountRow } from './profit-loss-statement.builder';
import {
  applyStockValues,
  carriedForwardFrom,
  StockValueRow,
} from './profit-loss-stock';

const JAN = 2026 * 12 + 1;

const ROWS: GlAccountRow[] = ['600-0000', '610-0000', '620-0000'].map(
  (accountCode) => ({
    accountCode,
    accountName: accountCode,
    accType: 'CO',
    amount: accountCode === '610-0000' ? 500 : 0,
  }),
);

function valuation(periodNo: number, balance: number): StockValueRow {
  return {
    stockSetKey: 1,
    openStockAccNo: '600-0000',
    closeStockAccNo: '620-0000',
    periodNo,
    balance,
  };
}

const amounts = (rows: GlAccountRow[]) => rows.map((r) => r.amount);

describe('applyStockValues', () => {
  const stock = [
    valuation(JAN - 1, 100),
    valuation(JAN, 150),
    valuation(JAN + 1, 80),
  ];

  it('adds the valuation before the range and deducts the one at its end', () => {
    expect(amounts(applyStockValues(ROWS, stock, JAN, JAN))).toEqual([
      100, 500, -150,
    ]);
  });

  it('uses only the outer valuations for a multi-month range', () => {
    expect(amounts(applyStockValues(ROWS, stock, JAN, JAN + 1))).toEqual([
      100, 500, -80,
    ]);
  });

  it('carries the latest valuation forward when a month has none', () => {
    const rows = applyStockValues(ROWS, stock, JAN + 2, JAN + 2);
    expect(amounts(rows)).toEqual([80, 500, -80]);
    expect(carriedForwardFrom(stock, JAN + 2)).toBe(JAN + 1);
    expect(carriedForwardFrom(stock, JAN + 1)).toBeNull();
  });

  it('marks only the rows that include a valuation', () => {
    const rows = applyStockValues(ROWS, stock, JAN, JAN);
    expect(rows.map((r) => Boolean(r.hasStockValue))).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('leaves the statement untouched when nothing is valued', () => {
    expect(applyStockValues(ROWS, [], JAN, JAN)).toEqual(ROWS);
    expect(carriedForwardFrom([], JAN)).toBeNull();
  });
});
