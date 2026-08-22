import { Injectable } from '@nestjs/common';
import { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';
import { runAutocountQuery } from '../autocount-connections/autocount-query.util';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProfitLossQueryDto } from './dto/profit-loss-query.dto';
import { ProfitLossStatementDto } from './dto/profit-loss-statement.dto';
import {
  buildProfitLossStatement,
  GlAccountRow,
  round,
} from './profit-loss-statement.builder';

/**
 * GLDTL has no account category of its own — GLMast.AccType classifies each account,
 * and AccGroup.NormalBalance (D/C) tells us which side (DR or CR) is that account's
 * "natural" balance, so revenue-type accounts (SL, OI) net as CR-DR while cost/expense
 * accounts (SA, CO, EP) net as DR-CR. Both nets come out positive for a normal balance.
 */
const GL_ACCOUNT_ROWS_SQL = `
  SELECT
     d.AccNo AS accountCode,
     m.Description AS accountName,
     m.AccType AS accType,
     SUM(CASE WHEN g.NormalBalance = 'C' THEN d.CR - d.DR ELSE d.DR - d.CR END) AS amount
  FROM GLDTL d
  JOIN GLMast m ON m.AccNo = d.AccNo
  JOIN AccGroup g ON g.AccType = m.AccType
  WHERE d.TransDate BETWEEN @fromDate AND @toDate
    AND m.AccType IN ('SL', 'SA', 'CO', 'OI', 'EP')
  GROUP BY d.AccNo, m.Description, m.AccType
  ORDER BY d.AccNo
`;

@Injectable()
export class ProfitLossService {
  constructor(
    private readonly connectionManager: AutocountConnectionManagerService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async getStatement(
    organizationId: number,
    query: ProfitLossQueryDto,
  ): Promise<ProfitLossStatementDto> {
    const [organization, rows] = await Promise.all([
      this.organizationsService.findOne(organizationId),
      this.fetchGlAccountRows(organizationId, query.fromDate, query.toDate),
    ]);

    return buildProfitLossStatement(
      rows,
      organization.name,
      query.fromDate,
      query.toDate,
    );
  }

  private async fetchGlAccountRows(
    organizationId: number,
    fromDate: string,
    toDate: string,
  ): Promise<GlAccountRow[]> {
    const pool = await this.connectionManager.getConnection(organizationId);
    const rows = await runAutocountQuery<GlAccountRow>(
      pool,
      GL_ACCOUNT_ROWS_SQL,
      {
        fromDate,
        toDate,
      },
    );
    return rows.map((row) => ({ ...row, amount: round(row.amount) }));
  }
}
