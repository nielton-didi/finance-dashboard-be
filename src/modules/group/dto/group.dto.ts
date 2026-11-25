import type { AutocountConnectionErrorReason } from '../../autocount-connections/autocount-connection.errors';

export class GroupPeriodDto {
  netSales: number;
  grossProfit: number;
  netProfit: number;
}

export class GroupOverviewMetricsDto {
  mtd: GroupPeriodDto;
  /** Since the start of each company's own fiscal year. */
  ytd: GroupPeriodDto;
  ttm: GroupPeriodDto;
}

export class GroupConsolidatedMetricsDto {
  netSales: number;
  grossProfit: number;
  netProfit: number;
  totalAssets: number;
  equity: number;
  cash: number;
}

export class GroupCompanyDto<T> {
  organizationId: number;
  name: string;
  current: T;
  prior: T;
}

/** An organization whose figures could not be read; left out of every total. */
export class GroupExclusionDto {
  organizationId: number;
  name: string;
  reason: AutocountConnectionErrorReason;
}

export class GroupReportDto<T> {
  companies: GroupCompanyDto<T>[];
  total: { current: T; prior: T };
  excluded: GroupExclusionDto[];
  /** Why the totals may need care, e.g. a database counted twice. */
  warnings: string[];
  notes: string[];
}

export class GroupOverviewDto extends GroupReportDto<GroupOverviewMetricsDto> {
  asOfDate: string;
}

export class GroupConsolidatedDto extends GroupReportDto<GroupConsolidatedMetricsDto> {
  fromDate: string;
  toDate: string;
}
