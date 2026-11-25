import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import type { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';
import { AutocountConnectionError } from '../autocount-connections/autocount-connection.errors';
import type { BalanceSheetService } from '../balance-sheet/balance-sheet.service';
import type { OrganizationsService } from '../organizations/organizations.service';
import { buildProfitLossStatement } from '../profit-loss/profit-loss-statement.builder';
import type {
  DateRange,
  ProfitLossService,
} from '../profit-loss/profit-loss.service';
import { GroupService } from './group.service';

const USER = { sub: 1 } as JwtPayload;
const SALES: Record<number, number> = { 1: 100, 2: 250 };

function createService(failures: Record<number, Error> = {}) {
  const failIfNeeded = (id: number) => {
    if (failures[id]) throw failures[id];
  };
  const findAllForUser = jest.fn().mockResolvedValue([
    { id: 1, name: 'One' },
    { id: 2, name: 'Two' },
  ]);
  const service = new GroupService(
    { findAllForUser } as unknown as OrganizationsService,
    {
      getConnection: (id: number) =>
        Promise.resolve({
          request: () => ({
            input: () => undefined,
            query: () =>
              Promise.resolve({
                recordset: [{ database: `server/${id}`, currency: 'MYR' }],
              }),
          }),
        }),
    } as unknown as AutocountConnectionManagerService,
    {
      getStatements: async (id: number, name: string, ranges: DateRange[]) => {
        await Promise.resolve();
        failIfNeeded(id);
        return ranges.map(({ fromDate, toDate }) =>
          buildProfitLossStatement(
            [
              {
                accountCode: 'S',
                accountName: 'S',
                accType: 'SL',
                amount: SALES[id],
              },
            ],
            name,
            fromDate,
            toDate,
          ),
        );
      },
    } as unknown as ProfitLossService,
    {
      getFiscalYearStart: () => Promise.resolve('2026-01-01'),
    } as unknown as BalanceSheetService,
  );
  jest.spyOn(service['logger'], 'error').mockImplementation();
  return { service, findAllForUser };
}

describe('GroupService', () => {
  it('reads only the organizations the user may see, and totals them', async () => {
    const { service, findAllForUser } = createService();
    const report = await service.getOverview(USER, { asOfDate: '2026-06-30' });
    expect(findAllForUser).toHaveBeenCalledWith(USER);
    expect(report.companies.map((c) => c.name)).toEqual(['One', 'Two']);
    expect(report.total.current.ytd.netSales).toBe(350);
    expect(report.excluded).toEqual([]);
  });

  it('leaves out an unreachable company and keeps the rest', async () => {
    const { service } = createService({
      1: new AutocountConnectionError(1, 'UNREACHABLE', 'down'),
    });
    const report = await service.getOverview(USER, { asOfDate: '2026-06-30' });
    expect(report.total.current.mtd.netSales).toBe(250);
    expect(report.excluded).toEqual([
      { organizationId: 1, name: 'One', reason: 'UNREACHABLE' },
    ]);
  });

  it('does not pass query error details on', async () => {
    const { service } = createService({ 2: new Error('Invalid object GLDTL') });
    const report = await service.getOverview(USER, { asOfDate: '2026-06-30' });
    expect(report.excluded).toEqual([
      { organizationId: 2, name: 'Two', reason: 'UNKNOWN' },
    ]);
    expect(JSON.stringify(report)).not.toContain('GLDTL');
  });

  it('rejects a reversed range', async () => {
    const { service } = createService();
    await expect(
      service.getConsolidated(USER, {
        fromDate: '2026-02-01',
        toDate: '2026-01-01',
      }),
    ).rejects.toThrow('fromDate must not be after toDate');
  });
});
