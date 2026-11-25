import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';
import { runAutocountQuery } from '../autocount-connections/autocount-query.util';
import { OrganizationsService } from '../organizations/organizations.service';
import {
  ProfitLossBreakdownQueryDto,
  ProfitLossDimensionsDto,
  ProfitLossQueryDto,
  ProfitLossRangeDto,
  ProfitLossTransactionsQueryDto,
  ProfitLossTrendQueryDto,
} from './dto/profit-loss-query.dto';
import {
  ProfitLossBreakdownDto,
  ProfitLossComparisonDto,
  ProfitLossFiltersDto,
  ProfitLossReportDto,
  ProfitLossTransactionDto,
  ProfitLossTransactionsDto,
  ProfitLossTrendDto,
} from './dto/profit-loss-statement.dto';
import {
  enumerateBuckets,
  isWholeMonths,
  periodLabel,
  shiftRangeToPriorYear,
  toPeriodNo,
} from './profit-loss-periods';
import {
  buildProfitLossStatement,
  GlAccountRow,
  round,
} from './profit-loss-statement.builder';
import {
  applyStockValues,
  carriedForwardFrom,
  StockValueRow,
} from './profit-loss-stock';
import {
  BUDGET_ACCOUNT_ROWS_SQL,
  BUDGET_NAME_SQL,
  BUDGETS_SQL,
  DEPARTMENTS_SQL,
  GL_ACCOUNT_PERIODS_SQL,
  PROJECTS_SQL,
  STOCK_VALUES_SQL,
  TRANSACTION_TOTALS_SQL,
  TRANSACTIONS_SQL,
} from './profit-loss.queries';

interface GlAccountPeriodRow extends GlAccountRow {
  /** Null when the account has no movement in the range. */
  periodNo: number | null;
}

interface LedgerData {
  rows: GlAccountPeriodRow[];
  stock: StockValueRow[];
}

const MAX_BREAKDOWN_MONTHS = 36;
const MAX_TRANSACTIONS = 1000;

@Injectable()
export class ProfitLossService {
  constructor(
    private readonly connectionManager: AutocountConnectionManagerService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async getStatement(
    organizationId: number,
    query: ProfitLossQueryDto,
  ): Promise<ProfitLossReportDto> {
    assertRange(query);
    const [organization, ledger] = await Promise.all([
      this.organizationsService.findOne(organizationId),
      this.fetchLedger(organizationId, query),
    ]);
    const comparison = await this.getComparison(
      organizationId,
      organization.name,
      query,
    );

    return {
      ...this.buildRange(ledger, organization.name, query),
      comparison,
      notes: buildNotes(ledger.stock, query, comparison),
    };
  }

  async getBreakdown(
    organizationId: number,
    query: ProfitLossBreakdownQueryDto,
  ): Promise<ProfitLossBreakdownDto> {
    assertRange(query);
    if (
      toPeriodNo(query.toDate) - toPeriodNo(query.fromDate) >=
      MAX_BREAKDOWN_MONTHS
    ) {
      throw new BadRequestException(
        `A period breakdown can cover at most ${MAX_BREAKDOWN_MONTHS} months`,
      );
    }

    const [organization, ledger] = await Promise.all([
      this.organizationsService.findOne(organizationId),
      this.fetchLedger(organizationId, query),
    ]);

    const columns = enumerateBuckets(
      query.fromDate,
      query.toDate,
      query.interval,
    ).map(({ key, label, fromPeriod, toPeriod }) => ({
      key,
      label,
      statement: buildProfitLossStatement(
        applyStockValues(
          sumByAccount(ledger.rows, fromPeriod, toPeriod),
          ledger.stock,
          fromPeriod,
          toPeriod,
        ),
        organization.name,
        query.fromDate,
        query.toDate,
      ),
    }));

    return {
      interval: query.interval,
      columns,
      total: this.buildRange(ledger, organization.name, query),
      notes: buildNotes(ledger.stock, query, null),
    };
  }

  async getTrend(
    organizationId: number,
    query: ProfitLossTrendQueryDto,
    /** Leaves out anything posted after this date. */
    upTo = `${query.year}-12-31`,
  ): Promise<ProfitLossTrendDto> {
    const rows = await this.fetchAccountPeriods(organizationId, {
      ...query,
      fromDate: `${query.year - 1}-01-01`,
      toDate: upTo,
    });

    const netSalesByPeriod = new Map<number, number>();
    for (const row of rows) {
      if (row.periodNo === null) continue;
      const sign = row.accType === 'SL' ? 1 : row.accType === 'SA' ? -1 : 0;
      if (sign === 0) continue;
      netSalesByPeriod.set(
        row.periodNo,
        (netSalesByPeriod.get(row.periodNo) ?? 0) + sign * row.amount,
      );
    }
    const netSales = (year: number, month: number) =>
      round(netSalesByPeriod.get(year * 12 + month) ?? 0);

    return {
      year: query.year,
      months: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        current: netSales(query.year, i + 1),
        prior: netSales(query.year - 1, i + 1),
      })),
    };
  }

  async getTransactions(
    organizationId: number,
    query: ProfitLossTransactionsQueryDto,
  ): Promise<ProfitLossTransactionsDto> {
    assertRange(query);
    if (Boolean(query.accountNo) === Boolean(query.accType)) {
      throw new BadRequestException(
        'Provide exactly one of accountNo or accType',
      );
    }

    const params = {
      ...rangeParams(query),
      accountNo: query.accountNo || null,
      accType: query.accType ?? null,
    };
    const pool = await this.connectionManager.getConnection(organizationId);
    const [rows, [totals]] = await Promise.all([
      runAutocountQuery<ProfitLossTransactionDto>(pool, TRANSACTIONS_SQL, {
        ...params,
        limit: MAX_TRANSACTIONS,
      }),
      runAutocountQuery<{
        totalCount: number;
        totalDebit: number;
        totalCredit: number;
      }>(pool, TRANSACTION_TOTALS_SQL, params),
    ]);

    return {
      rows,
      totalCount: totals.totalCount,
      openingDebit: 0,
      openingCredit: 0,
      totalDebit: round(totals.totalDebit),
      totalCredit: round(totals.totalCredit),
      truncated: totals.totalCount > rows.length,
    };
  }

  async getFilters(organizationId: number): Promise<ProfitLossFiltersDto> {
    const pool = await this.connectionManager.getConnection(organizationId);
    const [projects, departments, budgets] = await Promise.all([
      runAutocountQuery<{ code: string; name: string }>(pool, PROJECTS_SQL),
      runAutocountQuery<{ code: string; name: string }>(pool, DEPARTMENTS_SQL),
      runAutocountQuery<{ key: string; name: string }>(pool, BUDGETS_SQL),
    ]);
    return { projects, departments, budgets };
  }

  private async getComparison(
    organizationId: number,
    companyName: string,
    query: ProfitLossQueryDto,
  ): Promise<ProfitLossComparisonDto | null> {
    if (query.compareTo === 'prior_year') {
      const range = {
        ...query,
        ...shiftRangeToPriorYear(query.fromDate, query.toDate),
      };
      const ledger = await this.fetchLedger(organizationId, range);
      return {
        kind: 'prior_year',
        label: 'Prior Year',
        fromDate: range.fromDate,
        toDate: range.toDate,
        statement: this.buildRange(ledger, companyName, range),
      };
    }

    if (query.compareTo === 'budget') {
      const { fromDate, toDate } = query;
      const pool = await this.connectionManager.getConnection(organizationId);
      const [[budget], rows] = await Promise.all([
        runAutocountQuery<{ name: string }>(pool, BUDGET_NAME_SQL, {
          budgetKey: query.budgetKey,
        }),
        runAutocountQuery<GlAccountRow>(pool, BUDGET_ACCOUNT_ROWS_SQL, {
          ...dimensionParams(query),
          budgetKey: query.budgetKey,
          fromPeriod: toPeriodNo(fromDate),
          toPeriod: toPeriodNo(toDate),
        }),
      ]);
      if (!budget) {
        throw new NotFoundException(`Budget #${query.budgetKey} not found`);
      }
      return {
        kind: 'budget',
        label: `Budget: ${budget.name}`,
        fromDate,
        toDate,
        statement: buildProfitLossStatement(
          rows.map((row) => ({ ...row, amount: round(row.amount) })),
          companyName,
          fromDate,
          toDate,
        ),
      };
    }

    return null;
  }

  private buildRange(
    ledger: LedgerData,
    companyName: string,
    { fromDate, toDate }: { fromDate: string; toDate: string },
  ) {
    return buildProfitLossStatement(
      applyStockValues(
        sumByAccount(ledger.rows),
        ledger.stock,
        toPeriodNo(fromDate),
        toPeriodNo(toDate),
      ),
      companyName,
      fromDate,
      toDate,
    );
  }

  private async fetchLedger(
    organizationId: number,
    range: ProfitLossRangeDto,
  ): Promise<LedgerData> {
    const pool = await this.connectionManager.getConnection(organizationId);
    const [rows, stock] = await Promise.all([
      this.fetchAccountPeriods(organizationId, range),
      runAutocountQuery<StockValueRow>(pool, STOCK_VALUES_SQL, {
        ...dimensionParams(range),
        toPeriod: toPeriodNo(range.toDate),
      }),
    ]);
    return { rows, stock };
  }

  private async fetchAccountPeriods(
    organizationId: number,
    range: ProfitLossRangeDto,
  ): Promise<GlAccountPeriodRow[]> {
    const pool = await this.connectionManager.getConnection(organizationId);
    return runAutocountQuery<GlAccountPeriodRow>(
      pool,
      GL_ACCOUNT_PERIODS_SQL,
      rangeParams(range),
    );
  }
}

/** Collapses per-month rows to one per account, keeping accounts with no movement. */
function sumByAccount(
  rows: GlAccountPeriodRow[],
  fromPeriod = -Infinity,
  toPeriod = Infinity,
): GlAccountRow[] {
  const byAccount = new Map<string, GlAccountRow>();
  for (const row of rows) {
    const { accountCode, accountName, accType, periodNo } = row;
    const account = byAccount.get(accountCode) ?? {
      accountCode,
      accountName,
      accType,
      amount: 0,
    };
    if (periodNo !== null && periodNo >= fromPeriod && periodNo <= toPeriod) {
      account.amount += row.amount;
    }
    byAccount.set(accountCode, account);
  }
  return [...byAccount.values()].map((row) => ({
    ...row,
    amount: round(row.amount),
  }));
}

function buildNotes(
  stock: StockValueRow[],
  { fromDate, toDate }: ProfitLossRangeDto,
  comparison: ProfitLossComparisonDto | null,
): string[] {
  const notes: string[] = [];
  const wholeMonths = isWholeMonths(fromDate, toDate);

  if (stock.length > 0) {
    if (!wholeMonths) {
      notes.push(
        'Opening and closing stock are month-end valuations, so cost of goods sold is approximate for a range that does not cover whole months.',
      );
    }
    const valuedAt = carriedForwardFrom(stock, toPeriodNo(toDate));
    if (valuedAt !== null) {
      notes.push(
        `No stock value is recorded for ${periodLabel(toPeriodNo(toDate))}; closing stock uses the ${periodLabel(valuedAt)} valuation.`,
      );
    }
  }
  if (comparison?.kind === 'budget' && !wholeMonths) {
    notes.push(
      'Budgets are monthly: the budget column covers every full month the selected range touches.',
    );
  }
  return notes;
}

function assertRange({ fromDate, toDate }: ProfitLossRangeDto): void {
  if (fromDate > toDate) {
    throw new BadRequestException('fromDate must not be after toDate');
  }
}

function dimensionParams({ projectNo, deptNo }: ProfitLossDimensionsDto) {
  return { projectNo: projectNo || null, deptNo: deptNo || null };
}

function rangeParams(range: ProfitLossRangeDto) {
  return {
    ...dimensionParams(range),
    fromDate: range.fromDate,
    toDate: range.toDate,
  };
}
