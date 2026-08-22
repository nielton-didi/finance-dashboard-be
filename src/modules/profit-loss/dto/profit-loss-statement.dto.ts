/** One account row in a section, e.g. 500-0000 SALES 180,460.00 81.33% */
export class ProfitLossLineItemDto {
  accountCode: string;
  accountName: string;
  amount: number;
  /** Percentage of total gross sales (matches the "%" column in the source system). */
  percent: number;
}

/** A grouping section (SALES, SALES ADJUSTMENTS, COST OF GOODS SOLD, OTHER INCOMES, EXPENSES). */
export class ProfitLossSectionDto {
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
  netProfit: ProfitLossSummaryRowDto;
}
