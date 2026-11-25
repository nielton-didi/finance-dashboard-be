export class CashFlowItemDto {
  /** Stable across periods, so statements can be lined up. */
  id: string;
  kind: 'net_profit' | 'reclassified' | 'depreciation' | 'stock' | 'account';
  /** Null for lines that are calculated from several accounts. */
  accountCode: string | null;
  label: string;
  /** Positive is cash in, negative is cash out. */
  amount: number;
}

export class CashFlowSectionDto {
  key: 'operating' | 'investing' | 'financing';
  title: string;
  items: CashFlowItemDto[];
  totalLabel: string;
  total: number;
}

export class CashFlowStatementDto {
  companyName: string;
  fromDate: string;
  toDate: string;
  operating: CashFlowSectionDto;
  investing: CashFlowSectionDto;
  financing: CashFlowSectionDto;
  netChange: number;
  openingCash: number;
  closingCash: number;
  /** Closing balance of each bank and cash account; adds up to closingCash. */
  cashAccounts: { accountCode: string; accountName: string; amount: number }[];
  /** Closing cash less (opening cash + net change). Zero when it reconciles. */
  unreconciled: number;
}

export class CashFlowReportDto extends CashFlowStatementDto {
  comparison: {
    kind: 'prior_year';
    label: string;
    fromDate: string;
    toDate: string;
    statement: CashFlowStatementDto;
  } | null;
  notes: string[];
}
