import type { PnlAccType } from '../profit-loss-statement.builder';

/** One account row in a section, e.g. 500-0000 SALES 180,460.00 81.33% */
export class ProfitLossLineItemDto {
  accountCode: string;
  accountName: string;
  amount: number;
  /** Percentage of total gross sales (matches the "%" column in the source system). */
  percent: number;
  /**
   * True when the amount includes a stock valuation (StockPBalance), which has no
   * ledger lines behind it — so it cannot be drilled into.
   */
  hasStockValue: boolean;
}

/** A grouping section (SALES, SALES ADJUSTMENTS, COST OF GOODS SOLD, OTHER INCOMES, EXPENSES, TAXATION). */
export class ProfitLossSectionDto {
  accType: PnlAccType;
  title: string;
  items: ProfitLossLineItemDto[];
  total: number;
  percent: number;
}

/** A single computed row, e.g. NET SALES, GROSS PROFIT/(LOSS), NET PROFIT/(LOSS). */
export class ProfitLossSummaryRowDto {
  label: string;
  amount: number;
  percent: number;
}

export class ProfitLossStatementDto {
  companyName: string;
  fromDate: string;
  toDate: string;
  sales: ProfitLossSectionDto;
  salesAdjustments: ProfitLossSectionDto;
  netSales: ProfitLossSummaryRowDto;
  costOfGoodsSold: ProfitLossSectionDto;
  grossProfit: ProfitLossSummaryRowDto;
  otherIncomes: ProfitLossSectionDto;
  expenses: ProfitLossSectionDto;
  /** Before taxation. */
  netProfit: ProfitLossSummaryRowDto;
  taxation: ProfitLossSectionDto;
  netProfitAfterTax: ProfitLossSummaryRowDto;
}

export class ProfitLossComparisonDto {
  kind: 'prior_year' | 'budget';
  label: string;
  fromDate: string;
  toDate: string;
  statement: ProfitLossStatementDto;
}

export class ProfitLossReportDto extends ProfitLossStatementDto {
  comparison: ProfitLossComparisonDto | null;
  /** Caveats the reader needs in order to interpret the figures. */
  notes: string[];
}

export class ProfitLossBreakdownColumnDto {
  key: string;
  label: string;
  statement: ProfitLossStatementDto;
}

export class ProfitLossBreakdownDto {
  interval: 'monthly' | 'quarterly';
  columns: ProfitLossBreakdownColumnDto[];
  total: ProfitLossStatementDto;
  notes: string[];
}

export class ProfitLossTrendDto {
  year: number;
  /** Twelve entries, January first. */
  months: { month: number; current: number; prior: number }[];
}

export class ProfitLossTransactionDto {
  key: string;
  date: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  reference: string | null;
  journalType: string;
  projectNo: string | null;
  deptNo: string | null;
  debit: number;
  credit: number;
}

export class ProfitLossTransactionsDto {
  rows: ProfitLossTransactionDto[];
  /** Totals cover every matching line, even when `rows` is truncated. */
  totalCount: number;
  totalDebit: number;
  totalCredit: number;
  truncated: boolean;
}

export class ProfitLossFiltersDto {
  projects: { code: string; name: string }[];
  departments: { code: string; name: string }[];
  budgets: { key: string; name: string }[];
}
