export class BalanceSheetItemDto {
  /** Null for lines that are calculated rather than held in an account. */
  accountCode: string | null;
  /** Identifies a calculated line across statements. */
  calculated:
    | 'retained_brought_forward'
    | 'current_year_profit'
    | 'current_year_other'
    | null;
  accountName: string;
  amount: number;
  /** Percentage of total assets. */
  percent: number;
  /** Includes a stock valuation, which has no ledger lines behind it. */
  hasStockValue: boolean;
}

/** One AutoCount account type, e.g. FIXED ASSETS. */
export class BalanceSheetSectionDto {
  accType: string;
  title: string;
  items: BalanceSheetItemDto[];
  total: number;
  percent: number;
}

export class BalanceSheetGroupDto {
  label: string;
  sections: BalanceSheetSectionDto[];
  amount: number;
  percent: number;
}

export class BalanceSheetTotalDto {
  label: string;
  amount: number;
  percent: number;
}

export class BalanceSheetStatementDto {
  companyName: string;
  asOfDate: string;
  fiscalYearStart: string;
  nonCurrentAssets: BalanceSheetGroupDto;
  currentAssets: BalanceSheetGroupDto;
  totalAssets: BalanceSheetTotalDto;
  equity: BalanceSheetGroupDto;
  nonCurrentLiabilities: BalanceSheetGroupDto;
  currentLiabilities: BalanceSheetGroupDto;
  totalLiabilities: BalanceSheetTotalDto;
  totalEquityAndLiabilities: BalanceSheetTotalDto;
  /** Total assets less total equity and liabilities. Zero when the sheet balances. */
  outOfBalance: number;
  assetComposition: { key: string; label: string; amount: number }[];
}

export class BalanceSheetReportDto extends BalanceSheetStatementDto {
  comparison: {
    kind: 'prior_year';
    label: string;
    asOfDate: string;
    statement: BalanceSheetStatementDto;
  } | null;
  notes: string[];
}
