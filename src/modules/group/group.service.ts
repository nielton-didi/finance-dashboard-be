import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';
import { AutocountConnectionError } from '../autocount-connections/autocount-connection.errors';
import { runAutocountQuery } from '../autocount-connections/autocount-query.util';
import { BalanceSheetService } from '../balance-sheet/balance-sheet.service';
import { BalanceSheetStatementDto } from '../balance-sheet/dto/balance-sheet.dto';
import { performanceRanges } from '../dashboard/dashboard-ranges';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProfitLossStatementDto } from '../profit-loss/dto/profit-loss-statement.dto';
import { shiftRangeToPriorYear } from '../profit-loss/profit-loss-periods';
import { ProfitLossService } from '../profit-loss/profit-loss.service';
import {
  GroupConsolidatedQueryDto,
  GroupOverviewQueryDto,
} from './dto/group-query.dto';
import {
  GroupCompanyDto,
  GroupConsolidatedDto,
  GroupConsolidatedMetricsDto,
  GroupExclusionDto,
  GroupOverviewDto,
  GroupOverviewMetricsDto,
  GroupPeriodDto,
  GroupReportDto,
} from './dto/group.dto';
import {
  CompanyIdentity,
  findNotes,
  findWarnings,
  mapWithLimit,
  totalOf,
} from './group-totals';

/** Companies read at once; each uses a few connections of its own. */
const CONCURRENT_COMPANIES = 5;

/** The retained earnings account is always kept in the home currency. */
const COMPANY_IDENTITY_SQL = `
  SELECT
    CONVERT(nvarchar(128), SERVERPROPERTY('ServerName')) + '/' + DB_NAME() AS [database],
    (
      SELECT TOP 1 CurrencyCode FROM GLMast
      WHERE SpecialAccType = 'SRE' ORDER BY AccNo
    ) AS currency
`;

const NO_PERIOD: GroupPeriodDto = { netSales: 0, grossProfit: 0, netProfit: 0 };

const NO_OVERVIEW: GroupOverviewMetricsDto = {
  mtd: NO_PERIOD,
  ytd: NO_PERIOD,
  ttm: NO_PERIOD,
};

const NO_CONSOLIDATED: GroupConsolidatedMetricsDto = {
  ...NO_PERIOD,
  totalAssets: 0,
  equity: 0,
  cash: 0,
};

interface CompanyFigures<T> {
  current: T;
  prior: T;
  /** Only where the figures depend on it. */
  fiscalYearStart: string | null;
}

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly connectionManager: AutocountConnectionManagerService,
    private readonly profitLossService: ProfitLossService,
    private readonly balanceSheetService: BalanceSheetService,
  ) {}

  async getOverview(
    user: JwtPayload,
    { asOfDate }: GroupOverviewQueryDto,
  ): Promise<GroupOverviewDto> {
    const report = await this.collect(user, NO_OVERVIEW, async (id, name) => {
      const fiscalYearStart = await this.balanceSheetService.getFiscalYearStart(
        id,
        asOfDate,
      );
      const { current, prior } = performanceRanges(asOfDate, fiscalYearStart);
      const statements = await this.profitLossService.getStatements(id, name, [
        current.mtd,
        current.ytd,
        current.ttm,
        prior.mtd,
        prior.ytd,
        prior.ttm,
      ]);
      const [mtd, ytd, ttm, priorMtd, priorYtd, priorTtm] =
        statements.map(periodOf);
      return {
        current: { mtd, ytd, ttm },
        prior: { mtd: priorMtd, ytd: priorYtd, ttm: priorTtm },
        fiscalYearStart,
      };
    });
    return { asOfDate, ...report };
  }

  async getConsolidated(
    user: JwtPayload,
    { fromDate, toDate }: GroupConsolidatedQueryDto,
  ): Promise<GroupConsolidatedDto> {
    if (fromDate > toDate) {
      throw new BadRequestException('fromDate must not be after toDate');
    }
    const prior = shiftRangeToPriorYear(fromDate, toDate);

    const report = await this.collect(
      user,
      NO_CONSOLIDATED,
      async (id, name) => {
        const [[statement, priorStatement], sheet] = await Promise.all([
          this.profitLossService.getStatements(id, name, [
            { fromDate, toDate },
            prior,
          ]),
          this.balanceSheetService.getStatement(id, {
            asOfDate: toDate,
            compareTo: 'prior_year',
          }),
        ]);
        return {
          current: { ...periodOf(statement), ...positionOf(sheet) },
          prior: {
            ...periodOf(priorStatement),
            // Always present: the balance sheet was requested with a comparison.
            ...positionOf(sheet.comparison!.statement),
          },
          fiscalYearStart: null,
        };
      },
    );
    return { fromDate, toDate, ...report };
  }

  /**
   * Reads every organization the user may see. One that can't be read is reported and left
   * out, so a single customer's server being down doesn't take the whole group with it.
   */
  private async collect<T extends object>(
    user: JwtPayload,
    empty: T,
    read: (organizationId: number, name: string) => Promise<CompanyFigures<T>>,
  ): Promise<GroupReportDto<T>> {
    const organizations = await this.organizationsService.findAllForUser(user);
    const companies: GroupCompanyDto<T>[] = [];
    const identities: CompanyIdentity[] = [];
    const excluded: GroupExclusionDto[] = [];

    const results = await mapWithLimit(
      organizations,
      CONCURRENT_COMPANIES,
      async ({ id, name }) => {
        try {
          const [figures, identity] = await Promise.all([
            read(id, name),
            this.fetchIdentity(id),
          ]);
          return { figures, identity };
        } catch (error) {
          return { reason: this.reasonFor(id, error) };
        }
      },
    );

    results.forEach((result, index) => {
      const { id, name }: Organization = organizations[index];
      if (result.figures === undefined) {
        excluded.push({ organizationId: id, name, reason: result.reason });
        return;
      }
      const { current, prior, fiscalYearStart } = result.figures;
      companies.push({ organizationId: id, name, current, prior });
      identities.push({ name, fiscalYearStart, ...result.identity });
    });

    return {
      companies,
      total: totalOf(companies, empty),
      excluded,
      warnings: findWarnings(identities),
      notes: findNotes(identities),
    };
  }

  private async fetchIdentity(
    organizationId: number,
  ): Promise<Pick<CompanyIdentity, 'database' | 'currency'>> {
    const pool = await this.connectionManager.getConnection(organizationId);
    const [identity] = await runAutocountQuery<
      Pick<CompanyIdentity, 'database' | 'currency'>
    >(pool, COMPANY_IDENTITY_SQL);
    return identity;
  }

  private reasonFor(
    organizationId: number,
    error: unknown,
  ): GroupExclusionDto['reason'] {
    if (error instanceof AutocountConnectionError) return error.reason;
    // The details stay in the log: a query error can quote the customer's schema.
    this.logger.error(
      `Group figures failed for organization #${organizationId}`,
      error instanceof Error ? error.stack : String(error),
    );
    return 'UNKNOWN';
  }
}

function periodOf(statement: ProfitLossStatementDto): GroupPeriodDto {
  return {
    netSales: statement.netSales.amount,
    grossProfit: statement.grossProfit.amount,
    netProfit: statement.netProfitAfterTax.amount,
  };
}

function positionOf(sheet: BalanceSheetStatementDto) {
  return {
    totalAssets: sheet.totalAssets.amount,
    equity: sheet.equity.amount,
    cash: sheet.assetComposition.find((c) => c.key === 'cash')?.amount ?? 0,
  };
}
