import { BadRequestException, Injectable } from '@nestjs/common';
import { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';
import { runAutocountQuery } from '../autocount-connections/autocount-query.util';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProfitLossRangeDto } from '../profit-loss/dto/profit-loss-query.dto';
import {
  ProfitLossTransactionDto,
  ProfitLossTransactionsDto,
} from '../profit-loss/dto/profit-loss-statement.dto';
import {
  isWholeMonths,
  periodLabel,
  shiftRangeToPriorYear,
  toPeriodNo,
} from '../profit-loss/profit-loss-periods';
import { round } from '../profit-loss/profit-loss-statement.builder';
import {
  carriedForwardFrom,
  StockValueRow,
} from '../profit-loss/profit-loss-stock';
import { STOCK_VALUES_SQL } from '../profit-loss/profit-loss.queries';
import {
  AccountMovementRow,
  buildCashFlow,
  CashFlowResult,
  usesStockValues,
} from './cash-flow.builder';
import {
  ACCOUNT_MOVEMENTS_SQL,
  MOVEMENT_TRANSACTION_TOTALS_SQL,
  MOVEMENT_TRANSACTIONS_SQL,
} from './cash-flow.queries';
import {
  CashFlowQueryDto,
  CashFlowTransactionsQueryDto,
} from './dto/cash-flow-query.dto';
import { CashFlowReportDto } from './dto/cash-flow.dto';

const MAX_TRANSACTIONS = 1000;
const MAX_LISTED_ACCOUNTS = 10;

@Injectable()
export class CashFlowService {
  constructor(
    private readonly connectionManager: AutocountConnectionManagerService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async getStatement(
    organizationId: number,
    query: CashFlowQueryDto,
  ): Promise<CashFlowReportDto> {
    assertRange(query);
    const { name } = await this.organizationsService.findOne(organizationId);
    const priorRange = shiftRangeToPriorYear(query.fromDate, query.toDate);
    const [current, prior] = await Promise.all([
      this.load(organizationId, name, query),
      query.compareTo === 'prior_year'
        ? this.load(organizationId, name, { ...query, ...priorRange })
        : null,
    ]);

    return {
      ...current.statement,
      comparison: prior && {
        kind: 'prior_year',
        label: 'Prior Year',
        ...priorRange,
        statement: prior.statement,
      },
      notes: buildNotes(current, query),
    };
  }

  async getTransactions(
    organizationId: number,
    query: CashFlowTransactionsQueryDto,
  ): Promise<ProfitLossTransactionsDto> {
    assertRange(query);
    const params = { ...rangeParams(query), accountNo: query.accountNo };
    const pool = await this.connectionManager.getConnection(organizationId);
    const [rows, [totals]] = await Promise.all([
      runAutocountQuery<ProfitLossTransactionDto>(
        pool,
        MOVEMENT_TRANSACTIONS_SQL,
        { ...params, limit: MAX_TRANSACTIONS },
      ),
      runAutocountQuery<{
        totalCount: number;
        totalDebit: number;
        totalCredit: number;
      }>(pool, MOVEMENT_TRANSACTION_TOTALS_SQL, params),
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

  private async load(
    organizationId: number,
    companyName: string,
    range: ProfitLossRangeDto,
  ): Promise<CashFlowResult & { stock: StockValueRow[] }> {
    const pool = await this.connectionManager.getConnection(organizationId);
    const { fromDate, toDate, projectNo, deptNo } = rangeParams(range);
    const toPeriod = toPeriodNo(toDate);
    const [accounts, stock] = await Promise.all([
      runAutocountQuery<AccountMovementRow>(pool, ACCOUNT_MOVEMENTS_SQL, {
        fromDate,
        toDate,
        projectNo,
        deptNo,
        toPeriod,
      }),
      runAutocountQuery<StockValueRow>(pool, STOCK_VALUES_SQL, {
        projectNo,
        deptNo,
        toPeriod,
      }),
    ]);
    return {
      ...buildCashFlow({ companyName, fromDate, toDate, accounts, stock }),
      stock,
    };
  }
}

function assertRange({ fromDate, toDate }: ProfitLossRangeDto): void {
  if (fromDate > toDate) {
    throw new BadRequestException('fromDate must not be after toDate');
  }
}

function rangeParams({
  fromDate,
  toDate,
  projectNo,
  deptNo,
}: ProfitLossRangeDto) {
  return {
    fromDate,
    toDate,
    projectNo: projectNo || null,
    deptNo: deptNo || null,
  };
}

function buildNotes(
  {
    stock,
    unlabelled,
    questionable,
  }: CashFlowResult & { stock: StockValueRow[] },
  { fromDate, toDate, projectNo, deptNo }: ProfitLossRangeDto,
): string[] {
  const notes: string[] = [];

  if (usesStockValues(stock, toDate)) {
    if (!isWholeMonths(fromDate, toDate)) {
      notes.push(
        'Stock values are month-end valuations, so net profit and the change in stock are approximate for a range that does not cover whole months. Net cash is not affected.',
      );
    }
    const valuedAt = carriedForwardFrom(stock, toPeriodNo(toDate));
    if (valuedAt !== null) {
      notes.push(
        `No stock value is recorded for ${periodLabel(toPeriodNo(toDate))}; closing stock uses the ${periodLabel(valuedAt)} valuation.`,
      );
    }
  }

  if (unlabelled.length > 0) {
    notes.push(
      `These accounts have no cash flow category in AutoCount, so they are placed by account type: ${listAccounts(unlabelled)}.`,
    );
  }
  if (questionable.length > 0) {
    notes.push(
      `AutoCount labels these accounts as operating, its default, although their type suggests investing or financing: ${listAccounts(questionable)}. Check their cash flow category in AutoCount.`,
    );
  }

  if (projectNo || deptNo) {
    notes.push(
      'Only entries tagged with the selected project or department are included, so a filtered cash flow may not reconcile.',
    );
  }
  return notes;
}

function listAccounts(rows: AccountMovementRow[]): string {
  const listed = rows
    .slice(0, MAX_LISTED_ACCOUNTS)
    .map((row) => `${row.accountCode} ${row.accountName}`)
    .join(', ');
  const more = rows.length - MAX_LISTED_ACCOUNTS;
  return more > 0 ? `${listed} and ${more} more` : listed;
}
