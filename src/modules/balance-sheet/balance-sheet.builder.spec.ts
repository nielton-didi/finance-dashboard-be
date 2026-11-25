import { StockValueRow } from '../profit-loss/profit-loss-stock';
import {
  AccountBalanceRow,
  BalanceSheetInput,
  buildBalanceSheet,
} from './balance-sheet.builder';

const GROUPS: Record<string, [string, string, number]> = {
  FA: ['AS', 'D', 1],
  CA: ['AS', 'D', 3],
  CL: ['AS', 'C', 4],
  CP: ['FN', 'C', 5],
  RE: ['FN', 'C', 6],
  LL: ['FN', 'C', 7],
  SL: ['GP', 'C', 1],
  CO: ['GP', 'D', 3],
  EP: ['NP', 'D', 5],
  AP: ['AP', 'D', 8],
};

function account(
  accountCode: string,
  accType: string,
  amounts: Partial<
    Pick<AccountBalanceRow, 'opening' | 'priorNet' | 'currentNet'>
  > = {},
  extra: Partial<AccountBalanceRow> = {},
): AccountBalanceRow {
  const [groupCode, normalBalance, seq] = GROUPS[accType] ?? [null, null, null];
  return {
    accountCode,
    accountName: accountCode,
    accType,
    accTypeName: accType,
    specialAccType: null,
    parentAccNo: null,
    groupCode,
    normalBalance,
    seq,
    opening: 0,
    priorNet: 0,
    currentNet: 0,
    ...amounts,
    ...extra,
  };
}

const PERIOD = (year: number, month: number) => year * 12 + month;

function valuation(periodNo: number, balance: number): StockValueRow {
  return {
    stockSetKey: 1,
    openStockAccNo: 'OPEN',
    closeStockAccNo: 'CLOSE',
    balanceStockAccNo: 'STOCK',
    periodNo,
    balance,
  };
}

function build(
  accounts: AccountBalanceRow[],
  overrides: Partial<BalanceSheetInput> = {},
) {
  return buildBalanceSheet({
    companyName: 'Acme',
    asOfDate: '2026-06-30',
    fiscalYearStart: '2026-01-01',
    accounts,
    stock: [],
    openingPeriod: null,
    ...overrides,
  });
}

const calculated = (
  sheet: ReturnType<typeof build>,
  key: string,
): number | undefined =>
  sheet.equity.sections
    .flatMap((s) => s.items)
    .find((i) => i.calculated === key)?.amount;

// Capital 1000, prior-year sales 300, this year sales 200 less rent 50 — all in cash.
const BASE = [
  account(
    'BANK',
    'CA',
    { opening: 1000, priorNet: 300, currentNet: 150 },
    { specialAccType: 'SBK' },
  ),
  account('CAPITAL', 'CP', { opening: -1000 }),
  account('SALES', 'SL', { priorNet: -300, currentNet: -200 }),
  account('RENT', 'EP', { currentNet: 50 }),
];
const STOCK_ACCOUNTS = [
  account('STOCK', 'CA', {}, { specialAccType: 'SBS' }),
  account('OPEN', 'CO'),
  account('CLOSE', 'CO'),
];

describe('buildBalanceSheet', () => {
  it('includes opening balances and splits profit at the fiscal year start', () => {
    const sheet = build(BASE);
    expect(sheet.totalAssets.amount).toBe(1450);
    expect(calculated(sheet, 'retained_brought_forward')).toBe(300);
    expect(calculated(sheet, 'current_year_profit')).toBe(150);
    expect(sheet.totalEquityAndLiabilities.amount).toBe(1450);
    expect(sheet.outOfBalance).toBe(0);
  });

  it('shows dividends apart from current year profit', () => {
    const sheet = build([
      ...BASE,
      account('DIVIDEND', 'AP', { currentNet: 40 }),
      account('CASH', 'CA', { currentNet: -40 }, { specialAccType: 'SCH' }),
    ]);
    expect(calculated(sheet, 'current_year_profit')).toBe(150);
    expect(calculated(sheet, 'current_year_other')).toBe(-40);
    expect(sheet.outOfBalance).toBe(0);
  });

  it('groups liabilities by AutoCount type and folds creditors into control', () => {
    const sheet = build([
      ...BASE,
      account('VAN', 'FA', { currentNet: 500 }),
      account('CREDITORS', 'CL', {}, { specialAccType: 'SCC' }),
      account(
        'C1',
        'CL',
        { currentNet: -120 },
        { specialAccType: 'SCR', parentAccNo: 'CREDITORS' },
      ),
      account(
        'C2',
        'CL',
        { currentNet: -80 },
        { specialAccType: 'SCR', parentAccNo: 'CREDITORS' },
      ),
      account('LOAN', 'LL', { currentNet: -300 }),
    ]);
    expect(sheet.currentLiabilities.sections[0].items).toEqual([
      expect.objectContaining({ accountCode: 'CREDITORS', amount: 200 }),
    ]);
    expect(sheet.nonCurrentLiabilities.amount).toBe(300);
    expect(sheet.totalLiabilities.amount).toBe(500);
    expect(sheet.outOfBalance).toBe(0);
  });

  it('keeps accounts of custom types, using their AutoCount group', () => {
    const custom = (code: string, normalBalance: string, currentNet: number) =>
      account(
        code,
        'X' + normalBalance,
        { currentNet },
        { groupCode: 'AS', normalBalance, seq: 9 },
      );
    const sheet = build([...BASE, custom('A', 'D', 70), custom('L', 'C', -70)]);
    expect(sheet.currentAssets.amount).toBe(1520);
    expect(sheet.currentLiabilities.amount).toBe(70);
    expect(sheet.outOfBalance).toBe(0);
  });

  it('reports a ledger that does not balance rather than hiding it', () => {
    expect(
      build([...BASE, account('ODD', 'CA', { currentNet: 5 })]).outOfBalance,
    ).toBe(5);
  });

  describe('with stock valuations', () => {
    const stock = [
      valuation(PERIOD(2025, 12), 100),
      valuation(PERIOD(2026, 6), 130),
    ];
    const stockAsset = (sheet: ReturnType<typeof build>) =>
      sheet.assetComposition.find((c) => c.key === 'stock')?.amount;

    it('shows only the latest valuation and puts the change in this year', () => {
      const sheet = build([...BASE, ...STOCK_ACCOUNTS], { stock });
      expect(stockAsset(sheet)).toBe(130);
      expect(calculated(sheet, 'current_year_profit')).toBe(180);
      expect(calculated(sheet, 'retained_brought_forward')).toBe(400);
      expect(sheet.outOfBalance).toBe(0);
    });

    it('replaces an opening balance held on the stock account', () => {
      const [stockAccount, ...rest] = STOCK_ACCOUNTS;
      const sheet = build(
        [
          ...BASE,
          { ...stockAccount, opening: 100 },
          ...rest,
          account('CAPITAL2', 'CP', { opening: -100 }),
        ],
        { stock, openingPeriod: PERIOD(2026, 1) },
      );
      expect(stockAsset(sheet)).toBe(130);
      expect(calculated(sheet, 'retained_brought_forward')).toBe(300);
      expect(sheet.outOfBalance).toBe(0);
    });

    it('treats a pre-opening valuation as the missing opening balance', () => {
      const sheet = build(
        [
          ...BASE,
          ...STOCK_ACCOUNTS,
          account('CAPITAL2', 'CP', { opening: -100 }),
        ],
        { stock, openingPeriod: PERIOD(2026, 1) },
      );
      expect(stockAsset(sheet)).toBe(130);
      expect(calculated(sheet, 'retained_brought_forward')).toBe(300);
      expect(sheet.outOfBalance).toBe(0);
    });
  });
});
