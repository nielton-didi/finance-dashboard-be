import { Injectable } from '@nestjs/common';
import { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';
import { runAutocountQuery } from '../autocount-connections/autocount-query.util';
import { BalanceSheetService } from '../balance-sheet/balance-sheet.service';
import { BalanceSheetStatementDto } from '../balance-sheet/dto/balance-sheet.dto';
import { CashFlowService } from '../cash-flow/cash-flow.service';
import { ProfitLossStatementDto } from '../profit-loss/dto/profit-loss-statement.dto';
import { round } from '../profit-loss/profit-loss-statement.builder';
import { ProfitLossService } from '../profit-loss/profit-loss.service';
import { performance, performanceRanges } from './dashboard-ranges';
import { RECENT_DOCUMENTS_SQL } from './dashboard.queries';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  DashboardDocumentDto,
  DashboardDto,
  DashboardMetricsDto,
} from './dto/dashboard.dto';

const TOP_EXPENSES = 6;
const RECENT_DOCUMENTS = 10;
/** Lines to look through for recent documents; one document can have many. */
const RECENT_LINES = 500;

/**
 * Puts the three reports together. Balance sheet and cash flow figures come from their own
 * services and P&L figures from the same statement builder, so every number here matches
 * the report it summarizes.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly connectionManager: AutocountConnectionManagerService,
    private readonly profitLossService: ProfitLossService,
    private readonly balanceSheetService: BalanceSheetService,
    private readonly cashFlowService: CashFlowService,
  ) {}

  async getDashboard(
    organizationId: number,
    { asOfDate }: DashboardQueryDto,
  ): Promise<DashboardDto> {
    // Also settles the fiscal year, which the other figures depend on.
    const balanceSheet = await this.balanceSheetService.getStatement(
      organizationId,
      { asOfDate, compareTo: 'prior_year' },
    );
    const { companyName, fiscalYearStart } = balanceSheet;
    const ranges = performanceRanges(asOfDate, fiscalYearStart);
    const { current, prior } = ranges;

    const [statements, cashFlow, trend, recentDocuments] = await Promise.all([
      this.profitLossService.getStatements(organizationId, companyName, [
        current.mtd,
        current.ytd,
        current.ttm,
        prior.mtd,
        prior.ytd,
        prior.ttm,
      ]),
      this.cashFlowService.getStatement(organizationId, current.ytd),
      this.profitLossService.getTrend(
        organizationId,
        { year: Number(asOfDate.slice(0, 4)) },
        asOfDate,
      ),
      this.fetchRecentDocuments(organizationId, asOfDate),
    ]);

    const metrics = (
      [mtd, ytd, ttm]: ProfitLossStatementDto[],
      sheet: BalanceSheetStatementDto,
    ): DashboardMetricsDto => ({
      mtd: performance(mtd),
      ytd: performance(ytd),
      ttm: performance(ttm),
      position: position(sheet),
    });

    const expenses = [...statements[1].expenses.items]
      .filter((item) => item.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
    const otherExpenses = expenses.slice(TOP_EXPENSES);

    return {
      companyName,
      asOfDate,
      fiscalYearStart,
      current: metrics(statements.slice(0, 3), balanceSheet),
      prior: metrics(
        statements.slice(3),
        // Always present: the balance sheet above was requested with a comparison.
        balanceSheet.comparison!.statement,
      ),
      trend,
      topExpenses: expenses
        .slice(0, TOP_EXPENSES)
        .map(({ accountCode, accountName, amount }) => ({
          accountCode,
          accountName,
          amount,
        })),
      otherExpenses: {
        count: otherExpenses.length,
        amount: round(otherExpenses.reduce((sum, e) => sum + e.amount, 0)),
      },
      cashFlow: {
        operating: cashFlow.operating.total,
        investing: cashFlow.investing.total,
        financing: cashFlow.financing.total,
        netChange: cashFlow.netChange,
      },
      recentDocuments,
      outOfBalance: balanceSheet.outOfBalance,
      unreconciled: cashFlow.unreconciled,
      notes: balanceSheet.notes,
    };
  }

  private async fetchRecentDocuments(
    organizationId: number,
    asOfDate: string,
  ): Promise<DashboardDocumentDto[]> {
    const pool = await this.connectionManager.getConnection(organizationId);
    const rows = await runAutocountQuery<
      Omit<DashboardDocumentDto, 'key'> & { lastKey: string }
    >(pool, RECENT_DOCUMENTS_SQL, {
      asOfDate,
      limit: RECENT_DOCUMENTS,
      lineLimit: RECENT_LINES,
    });
    return rows.map(({ lastKey, amount, ...row }) => ({
      ...row,
      key: String(lastKey),
      amount: round(amount),
    }));
  }
}

function position(
  sheet: BalanceSheetStatementDto,
): DashboardMetricsDto['position'] {
  const asset = (key: string) =>
    sheet.assetComposition.find((c) => c.key === key)?.amount ?? 0;
  return {
    cash: asset('cash'),
    tradeDebtors: asset('debtors'),
    stock: asset('stock'),
    currentAssets: sheet.currentAssets.amount,
    currentLiabilities: sheet.currentLiabilities.amount,
    workingCapital: round(
      sheet.currentAssets.amount - sheet.currentLiabilities.amount,
    ),
    totalAssets: sheet.totalAssets.amount,
    totalLiabilities: sheet.totalLiabilities.amount,
    equity: sheet.equity.amount,
  };
}
