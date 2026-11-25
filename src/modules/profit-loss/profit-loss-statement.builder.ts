import {
  ProfitLossLineItemDto,
  ProfitLossSectionDto,
  ProfitLossStatementDto,
  ProfitLossSummaryRowDto,
} from './dto/profit-loss-statement.dto';

export const PNL_ACC_TYPES = ['SL', 'SA', 'CO', 'OI', 'EP', 'TX'] as const;
export type PnlAccType = (typeof PNL_ACC_TYPES)[number];

export interface GlAccountRow {
  accountCode: string;
  accountName: string;
  accType: PnlAccType;
  /** Signed so a positive amount always means "more of this account's natural balance". */
  amount: number;
  /** Set when `amount` includes a stock valuation — see profit-loss-stock.ts. */
  hasStockValue?: boolean;
}

/**
 * Ported from the working `profit-loss-test` prototype module — the GLDTL/GLMast/AccGroup
 * query and AccType/NormalBalance sign-netting logic is unchanged, only the DataSource
 * acquisition (now per-organization) and companyName (now from the organizations table) differ.
 */
export function buildProfitLossStatement(
  rows: GlAccountRow[],
  companyName: string,
  fromDate: string,
  toDate: string,
): ProfitLossStatementDto {
  // Percentages are relative to total gross sales (SL), matching the source system's % column.
  const grossSalesTotal = round(
    rows.filter((r) => r.accType === 'SL').reduce((s, r) => s + r.amount, 0),
  );

  const sales = buildSection('SALES', 'SL', rows, grossSalesTotal);
  const salesAdjustments = buildSection(
    'SALES ADJUSTMENTS',
    'SA',
    rows,
    grossSalesTotal,
  );
  const netSalesAmount = round(sales.total - salesAdjustments.total);
  const netSales = buildSummaryRow(
    'NET SALES',
    netSalesAmount,
    grossSalesTotal,
  );

  const costOfGoodsSold = buildSection(
    'COST OF GOODS SOLD',
    'CO',
    rows,
    grossSalesTotal,
  );
  const grossProfitAmount = round(netSalesAmount - costOfGoodsSold.total);
  const grossProfit = buildSummaryRow(
    'GROSS PROFIT/(LOSS)',
    grossProfitAmount,
    grossSalesTotal,
  );

  const otherIncomes = buildSection(
    'OTHER INCOMES',
    'OI',
    rows,
    grossSalesTotal,
  );
  const expenses = buildSection('EXPENSES', 'EP', rows, grossSalesTotal);
  const netProfitAmount = round(
    grossProfitAmount + otherIncomes.total - expenses.total,
  );
  const netProfit = buildSummaryRow(
    'NET PROFIT/(LOSS)',
    netProfitAmount,
    grossSalesTotal,
  );

  const taxation = buildSection('TAXATION', 'TX', rows, grossSalesTotal);
  const netProfitAfterTax = buildSummaryRow(
    'NET PROFIT/(LOSS) AFTER TAX',
    round(netProfitAmount - taxation.total),
    grossSalesTotal,
  );

  return {
    companyName,
    fromDate,
    toDate,
    sales,
    salesAdjustments,
    netSales,
    costOfGoodsSold,
    grossProfit,
    otherIncomes,
    expenses,
    netProfit,
    taxation,
    netProfitAfterTax,
  };
}

function buildSection(
  title: string,
  accType: PnlAccType,
  rows: GlAccountRow[],
  percentBase: number,
): ProfitLossSectionDto {
  const items: ProfitLossLineItemDto[] = rows
    .filter((r) => r.accType === accType)
    .map((r) => ({
      accountCode: r.accountCode,
      accountName: r.accountName,
      amount: r.amount,
      percent: percentOf(r.amount, percentBase),
      hasStockValue: r.hasStockValue ?? false,
    }));

  const total = round(items.reduce((s, i) => s + i.amount, 0));

  return {
    title,
    accType,
    items,
    total,
    percent: percentOf(total, percentBase),
  };
}

function buildSummaryRow(
  label: string,
  amount: number,
  percentBase: number,
): ProfitLossSummaryRowDto {
  return { label, amount, percent: percentOf(amount, percentBase) };
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function percentOf(amount: number, base: number): number {
  if (!base) return 0;
  return round((amount / base) * 100);
}
