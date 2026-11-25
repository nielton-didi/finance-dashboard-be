import {
  CompanyIdentity,
  findNotes,
  findWarnings,
  mapWithLimit,
  sumAmounts,
} from './group-totals';

function company(overrides: Partial<CompanyIdentity> = {}): CompanyIdentity {
  return {
    name: 'A',
    database: 'server/A',
    currency: 'MYR',
    fiscalYearStart: '2026-01-01',
    ...overrides,
  };
}

describe('sumAmounts', () => {
  const empty = { sales: 0, ytd: { profit: 0 } };

  it('adds nested amounts field by field', () => {
    expect(
      sumAmounts(
        [
          { sales: 0.1, ytd: { profit: -5 } },
          { sales: 0.2, ytd: { profit: 8 } },
        ],
        empty,
      ),
    ).toEqual({ sales: 0.3, ytd: { profit: 3 } });
  });

  it('is all zeros for no companies', () => {
    expect(sumAmounts([], empty)).toEqual(empty);
  });
});

describe('findWarnings', () => {
  it('is empty for separate databases in one currency', () => {
    expect(
      findWarnings([company(), company({ name: 'B', database: 'server/B' })]),
    ).toEqual([]);
  });

  it('names organizations that share a database', () => {
    const [warning] = findWarnings([company(), company({ name: 'B' })]);
    expect(warning).toContain('counted 2 times: A, B');
  });

  it('warns about mixed currencies, ignoring unknown ones', () => {
    const others = [
      company({ database: 'server/B', currency: 'SGD' }),
      company({ database: 'server/C', currency: null }),
    ];
    expect(findWarnings([company(), ...others])[0]).toContain('MYR, SGD');
    expect(findWarnings([company(), others[1]])).toEqual([]);
  });
});

describe('findNotes', () => {
  it('mentions differing fiscal years', () => {
    expect(findNotes([company()])).toHaveLength(1);
    expect(
      findNotes([company(), company({ fiscalYearStart: '2026-07-01' })]),
    ).toHaveLength(2);
  });
});

describe('mapWithLimit', () => {
  it('keeps order and never exceeds the limit', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithLimit([5, 1, 4, 2, 3], 2, async (n) => {
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setTimeout(resolve, n));
      running--;
      return n * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBe(2);
  });
});
