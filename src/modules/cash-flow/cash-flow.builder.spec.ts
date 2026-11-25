import { StockValueRow } from '../profit-loss/profit-loss-stock';
import { AccountMovementRow, buildCashFlow } from './cash-flow.builder';

const GROUPS: Record<string, [string, string]> = {
  FA: ['AS', 'D'],
  CA: ['AS', 'D'],
  CL: ['AS', 'C'],
  CP: ['FN', 'C'],
  LL: ['FN', 'C'],
  SL: ['GP', 'C'],
  CO: ['GP', 'D'],
  EP: ['NP', 'D'],
  AP: ['AP', 'D'],
};

/** `net` is the debit-positive movement in the period. */
function account(
  accountCode: string,
  accType: string,
  cashFlowCategory: string | null,
  net: number,
  extra: Partial<AccountMovementRow> = {},
): AccountMovementRow {
  const [groupCode, normalBalance] = GROUPS[accType];
  return {
    accountCode,
    accountName: accountCode,
    accType,
    specialAccType: null,
    parentAccNo: null,
    groupCode,
    normalBalance,
    cashFlowCategory,
    opening: 0,
    before: 0,
    debit: Math.max(net, 0),
    credit: Math.max(-net, 0),
    ...extra,
  };
}

const bank = (net: number, extra: Partial<AccountMovementRow> = {}) =>
  account('BANK', 'CA', 'O', net, { specialAccType: 'SBK', ...extra });

const JAN = 2026 * 12 + 1;

function build(accounts: AccountMovementRow[], stock: StockValueRow[] = []) {
  return buildCashFlow({
    companyName: 'Acme',
    fromDate: '2026-01-01',
    toDate: '2026-01-31',
    accounts,
    stock,
  });
}

function amountOf(
  { statement }: ReturnType<typeof build>,
  id: string,
): number | undefined {
  return [statement.operating, statement.investing, statement.financing]
    .flatMap((s) => s.items)
    .find((i) => i.id === id)?.amount;
}

describe('buildCashFlow', () => {
  it('turns profit into cash and ties it to the bank balance', () => {
    // Sales 500 on credit, 200 collected, rent 120 paid.
    const result = build([
      bank(80, { opening: 30, before: 20 }),
      account('DEBTORS', 'CA', 'O', 300),
      account('SALES', 'SL', 'O', -500),
      account('RENT', 'EP', 'O', 120),
    ]);
    const { statement } = result;
    expect(amountOf(result, 'net_profit')).toBe(380);
    expect(amountOf(result, 'DEBTORS')).toBe(-300);
    expect(statement.operating.total).toBe(80);
    expect(statement.openingCash).toBe(50);
    expect(statement.closingCash).toBe(130);
    expect(statement.unreconciled).toBe(0);
  });

  it('follows the AutoCount label, even for a liability like hire purchase', () => {
    const { statement } = build([bank(-40), account('HP', 'CL', 'I', 40)]);
    expect(statement.investing.total).toBe(-40);
    expect(statement.operating.total).toBe(0);
  });

  it('defaults unlabelled accounts by type and reports those that moved', () => {
    const { statement, unlabelled } = build([
      bank(1000 - 600 + 50),
      account('LOAN', 'LL', null, -1000),
      account('VAN', 'FA', ' ', 600),
      account('ACCRUALS', 'CL', null, -50),
      account('IDLE', 'FA', null, 0),
    ]);
    expect(statement.financing.total).toBe(1000);
    expect(statement.investing.total).toBe(-600);
    expect(statement.operating.total).toBe(50);
    expect(unlabelled.map((row) => row.accountCode)).toEqual([
      'LOAN',
      'VAN',
      'ACCRUALS',
    ]);
  });

  it('follows an operating label on a loan but points it out', () => {
    const { statement, questionable } = build([
      bank(1000),
      account('LOAN', 'LL', 'O', -1000),
      account('IDLE', 'FA', 'O', 0),
    ]);
    expect(statement.operating.total).toBe(1000);
    expect(questionable.map((row) => row.accountCode)).toEqual(['LOAN']);
  });

  it('adds depreciation back and keeps releases on disposal with the asset', () => {
    const result = build([
      bank(60),
      account('VAN', 'FA', 'I', -100),
      account('ACCUM', 'FA', 'I', 0, {
        specialAccType: 'SAD',
        debit: 40,
        credit: 25,
      }),
      account('DEPRECIATION', 'EP', 'O', 25),
    ]);
    expect(amountOf(result, 'net_profit')).toBe(-25);
    expect(amountOf(result, 'ACCUM:depreciation')).toBe(25);
    expect(result.statement.operating.total).toBe(0);
    expect(result.statement.investing.total).toBe(60);
    expect(result.statement.unreconciled).toBe(0);
  });

  it('moves a P&L account labelled financing out of operating', () => {
    const result = build([
      bank(70),
      account('SALES', 'SL', 'O', -100),
      account('INTEREST', 'EP', 'F', 30),
    ]);
    expect(amountOf(result, 'net_profit')).toBe(70);
    expect(amountOf(result, 'reclassified')).toBe(30);
    expect(result.statement.operating.total).toBe(100);
    expect(result.statement.financing.total).toBe(-30);
  });

  it('shows dividends, which profit leaves out, as financing', () => {
    const { statement } = build([
      bank(-90),
      account('DIVIDEND', 'AP', null, 90),
    ]);
    expect(statement.financing.total).toBe(-90);
    expect(statement.unreconciled).toBe(0);
  });

  it('folds creditors into their control account, label included', () => {
    const result = build([
      bank(-30),
      account('CREDITORS', 'CL', 'O', 0, { specialAccType: 'SCC' }),
      account('C1', 'CL', null, 30, {
        specialAccType: 'SCR',
        parentAccNo: 'CREDITORS',
      }),
    ]);
    expect(amountOf(result, 'CREDITORS')).toBe(-30);
    expect(result.unlabelled).toEqual([]);
  });

  it('treats transfers between bank and cash as no cash flow', () => {
    const { statement } = build([
      bank(-200),
      account('TILL', 'CA', 'O', 200, { specialAccType: 'SCH' }),
    ]);
    expect(statement.netChange).toBe(0);
    expect(statement.closingCash).toBe(0);
  });

  it('cancels stock valuations out of profit, so cash is unaffected', () => {
    const valuation = (periodNo: number, balance: number): StockValueRow => ({
      stockSetKey: 1,
      openStockAccNo: 'OPEN',
      closeStockAccNo: 'CLOSE',
      balanceStockAccNo: 'STOCK',
      periodNo,
      balance,
    });
    const result = build(
      [
        bank(-100),
        account('PURCHASES', 'CO', 'O', 100),
        account('OPEN', 'CO', 'O', 0),
        account('CLOSE', 'CO', 'O', 0),
        account('STOCK', 'CA', 'O', 0, { specialAccType: 'SBS' }),
      ],
      [valuation(JAN - 1, 60), valuation(JAN, 75)],
    );
    expect(amountOf(result, 'net_profit')).toBe(-85);
    expect(amountOf(result, 'stock')).toBe(-15);
    expect(result.statement.netChange).toBe(-100);
    expect(result.statement.unreconciled).toBe(0);
  });

  it('reports a ledger that does not balance rather than hiding it', () => {
    expect(build([bank(5)]).statement.unreconciled).toBe(5);
  });
});
