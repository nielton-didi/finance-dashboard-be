import { Injectable } from '@nestjs/common';
import { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';
import { runAutocountQuery } from '../autocount-connections/autocount-query.util';
import { OrganizationsService } from '../organizations/organizations.service';
import {
  ProfitLossTransactionDto,
  ProfitLossTransactionsDto,
} from '../profit-loss/dto/profit-loss-statement.dto';
import {
  isMonthEnd,
  periodLabel,
  shiftDateToPriorYear,
  toPeriodNo,
} from '../profit-loss/profit-loss-periods';
import { round } from '../profit-loss/profit-loss-statement.builder';
import {
  carriedForwardFrom,
  StockValueRow,
} from '../profit-loss/profit-loss-stock';
import { STOCK_VALUES_SQL } from '../profit-loss/profit-loss.queries';
import { AccountBalanceRow, buildBalanceSheet } from './balance-sheet.builder';
import {
  ACCOUNT_BALANCES_SQL,
  BALANCE_TRANSACTION_TOTALS_SQL,
  BALANCE_TRANSACTIONS_SQL,
  FISCAL_YEARS_SQL,
  OPENING_BALANCE_SQL,
  OPENING_PERIOD_SQL,
} from './balance-sheet.queries';
import {
  BalanceSheetAsOfDto,
  BalanceSheetQueryDto,
  BalanceSheetTransactionsQueryDto,
} from './dto/balance-sheet-query.dto';
import {
  BalanceSheetReportDto,
  BalanceSheetStatementDto,
} from './dto/balance-sheet.dto';
import { fiscalYearStart, FiscalYearRow } from './fiscal-year';

const MAX_TRANSACTIONS = 1000;

@Injectable()
export class BalanceSheetService {
  constructor(
    private readonly connectionManager: AutocountConnectionManagerService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async getStatement(
    organizationId: number,
    query: BalanceSheetQueryDto,
  ): Promise<BalanceSheetReportDto> {
    const { name } = await this.organizationsService.findOne(organizationId);
    const priorDate = shiftDateToPriorYear(query.asOfDate);
    const [current, prior] = await Promise.all([
      this.load(organizationId, name, query),
      query.compareTo === 'prior_year'
        ? this.load(organizationId, name, { ...query, asOfDate: priorDate })
        : null,
    ]);

    return {
      ...current.statement,
      comparison: prior && {
        kind: 'prior_year',
        label: 'Prior Year',
        asOfDate: priorDate,
        statement: prior.statement,
      },
      notes: buildNotes(current.stock, query),
    };
  }

  async getTransactions(
    organizationId: number,
    query: BalanceSheetTransactionsQueryDto,
  ): Promise<ProfitLossTransactionsDto> {
    const params = {
      ...asOfParams(query),
      accountNo: query.accountNo,
    };
    const pool = await this.connectionManager.getConnection(organizationId);
    const [rows, [totals], [opening]] = await Promise.all([
      runAutocountQuery<ProfitLossTransactionDto>(
        pool,
        BALANCE_TRANSACTIONS_SQL,
        { ...params, limit: MAX_TRANSACTIONS },
      ),
      runAutocountQuery<{
        totalCount: number;
        totalDebit: number;
        totalCredit: number;
      }>(pool, BALANCE_TRANSACTION_TOTALS_SQL, params),
      runAutocountQuery<{ debit: number; credit: number }>(
        pool,
        OPENING_BALANCE_SQL,
        params,
      ),
    ]);

    return {
      rows,
      totalCount: totals.totalCount,
      openingDebit: round(opening.debit),
      openingCredit: round(opening.credit),
      totalDebit: round(totals.totalDebit + opening.debit),
      totalCredit: round(totals.totalCredit + opening.credit),
      truncated: totals.totalCount > rows.length,
    };
  }

  private async load(
    organizationId: number,
    companyName: string,
    query: BalanceSheetAsOfDto,
  ): Promise<{ statement: BalanceSheetStatementDto; stock: StockValueRow[] }> {
    const pool = await this.connectionManager.getConnection(organizationId);
    const { asOfDate } = query;
    const params = asOfParams(query);

    const years = await runAutocountQuery<FiscalYearRow>(
      pool,
      FISCAL_YEARS_SQL,
    );
    const yearStart = fiscalYearStart(years, asOfDate);

    const [accounts, stock, [opening]] = await Promise.all([
      runAutocountQuery<AccountBalanceRow>(pool, ACCOUNT_BALANCES_SQL, {
        ...params,
        fiscalYearStart: yearStart,
      }),
      runAutocountQuery<StockValueRow>(pool, STOCK_VALUES_SQL, {
        projectNo: params.projectNo,
        deptNo: params.deptNo,
        toPeriod: params.asOfPeriod,
      }),
      runAutocountQuery<{ openingPeriod: number | null }>(
        pool,
        OPENING_PERIOD_SQL,
      ),
    ]);

    return {
      stock,
      statement: buildBalanceSheet({
        companyName,
        asOfDate,
        fiscalYearStart: yearStart,
        accounts,
        stock,
        openingPeriod: opening.openingPeriod,
      }),
    };
  }
}

function asOfParams({ asOfDate, projectNo, deptNo }: BalanceSheetAsOfDto) {
  return {
    asOfDate,
    asOfPeriod: toPeriodNo(asOfDate),
    projectNo: projectNo || null,
    deptNo: deptNo || null,
  };
}

function buildNotes(
  stock: StockValueRow[],
  { asOfDate, projectNo, deptNo }: BalanceSheetAsOfDto,
): string[] {
  const notes: string[] = [];
  if (stock.length > 0) {
    const period = toPeriodNo(asOfDate);
    const valuedAt = carriedForwardFrom(stock, period);
    if (valuedAt !== null) {
      notes.push(
        `No stock value is recorded for ${periodLabel(period)}; stock uses the ${periodLabel(valuedAt)} valuation.`,
      );
    } else if (!isMonthEnd(asOfDate)) {
      notes.push(
        `Stock is the month-end valuation for ${periodLabel(period)}, not the value on the selected date.`,
      );
    }
  }
  if (projectNo || deptNo) {
    notes.push(
      'Only entries tagged with the selected project or department are included, so a filtered balance sheet may not balance.',
    );
  }
  return notes;
}
