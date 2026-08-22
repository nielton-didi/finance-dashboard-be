import {
  buildProfitLossStatement,
  GlAccountRow,
} from './profit-loss-statement.builder';

const ROWS: GlAccountRow[] = [
  {
    accountCode: '500-0000',
    accountName: 'Sales',
    accType: 'SL',
    amount: 200_000,
  },
  {
    accountCode: '500-0001',
    accountName: 'Sales Returns',
    accType: 'SA',
    amount: 20_000,
  },
  {
    accountCode: '600-0000',
    accountName: 'Cost of Sales',
    accType: 'CO',
    amount: 80_000,
  },
  {
    accountCode: '700-0000',
    accountName: 'Interest Income',
    accType: 'OI',
    amount: 5_000,
  },
  {
    accountCode: '900-0000',
    accountName: 'Rent',
    accType: 'EP',
    amount: 30_000,
  },
];

describe('buildProfitLossStatement', () => {
  const statement = buildProfitLossStatement(
    ROWS,
    'Acme Sdn Bhd',
    '2026-01-01',
    '2026-01-31',
  );

  it('carries through the header fields', () => {
    expect(statement.companyName).toBe('Acme Sdn Bhd');
    expect(statement.fromDate).toBe('2026-01-01');
    expect(statement.toDate).toBe('2026-01-31');
  });

  it('groups rows into the correct sections', () => {
    expect(statement.sales.items).toHaveLength(1);
    expect(statement.sales.total).toBe(200_000);
    expect(statement.salesAdjustments.total).toBe(20_000);
    expect(statement.costOfGoodsSold.total).toBe(80_000);
    expect(statement.otherIncomes.total).toBe(5_000);
    expect(statement.expenses.total).toBe(30_000);
  });

  it('computes NET SALES as sales minus sales adjustments', () => {
    expect(statement.netSales.amount).toBe(180_000);
  });

  it('computes GROSS PROFIT as net sales minus cost of goods sold', () => {
    expect(statement.grossProfit.amount).toBe(100_000);
  });

  it('computes NET PROFIT as gross profit plus other incomes minus expenses', () => {
    expect(statement.netProfit.amount).toBe(75_000);
  });

  it('computes percentages relative to gross sales', () => {
    expect(statement.sales.items[0].percent).toBe(100);
    expect(statement.costOfGoodsSold.percent).toBe(40);
  });

  it('returns 0% everywhere when there is no gross sales to divide by', () => {
    const zeroSalesStatement = buildProfitLossStatement(
      [
        {
          accountCode: '900-0000',
          accountName: 'Rent',
          accType: 'EP',
          amount: 100,
        },
      ],
      'Acme Sdn Bhd',
      '2026-01-01',
      '2026-01-31',
    );
    expect(zeroSalesStatement.expenses.percent).toBe(0);
    expect(zeroSalesStatement.expenses.items[0].percent).toBe(0);
  });
});
