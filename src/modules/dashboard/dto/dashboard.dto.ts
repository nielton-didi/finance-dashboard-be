import type { ProfitLossTrendDto } from '../../profit-loss/dto/profit-loss-statement.dto';

export class DashboardPerformanceDto {
  fromDate: string;
  toDate: string;
  netSales: number;
  grossProfit: number;
  /** After tax, as on the Profit & Loss report. */
  netProfit: number;
}

export class DashboardMetricsDto {
  mtd: DashboardPerformanceDto;
  /** Since the start of the fiscal year. */
  ytd: DashboardPerformanceDto;
  /** The twelve months ending on the as-of date. */
  ttm: DashboardPerformanceDto;
  position: {
    cash: number;
    tradeDebtors: number;
    stock: number;
    currentAssets: number;
    currentLiabilities: number;
    workingCapital: number;
    totalAssets: number;
    totalLiabilities: number;
    equity: number;
  };
}

export class DashboardDocumentDto {
  key: string;
  date: string;
  reference: string | null;
  journalType: string;
  description: string | null;
  amount: number;
}

export class DashboardDto {
  companyName: string;
  asOfDate: string;
  fiscalYearStart: string;
  current: DashboardMetricsDto;
  prior: DashboardMetricsDto;
  trend: ProfitLossTrendDto;
  /** Year to date, largest first. */
  topExpenses: { accountCode: string; accountName: string; amount: number }[];
  otherExpenses: { count: number; amount: number };
  /** Year to date. */
  cashFlow: {
    operating: number;
    investing: number;
    financing: number;
    netChange: number;
  };
  recentDocuments: DashboardDocumentDto[];
  /** Zero when the balance sheet balances and the cash flow reconciles. */
  outOfBalance: number;
  unreconciled: number;
  notes: string[];
}
