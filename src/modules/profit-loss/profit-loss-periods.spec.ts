import {
  enumerateBuckets,
  fromPeriodNo,
  isWholeMonths,
  periodLabel,
  shiftRangeToPriorYear,
  toPeriodNo,
} from './profit-loss-periods';

describe('AutoCount period numbers', () => {
  it('matches the PBalance numbering of a real database (Sep 2020 = 24249)', () => {
    expect(toPeriodNo('2020-09-02')).toBe(24249);
    expect(toPeriodNo('2020-11-30')).toBe(24251);
  });

  it('round-trips December, where a naive modulo lands in the next year', () => {
    expect(fromPeriodNo(toPeriodNo('2024-12-31'))).toEqual({
      year: 2024,
      month: 12,
    });
    expect(periodLabel(toPeriodNo('2024-12-31'))).toBe('Dec 2024');
  });
});

describe('isWholeMonths', () => {
  it.each([
    ['2026-01-01', '2026-01-31', true],
    ['2024-02-01', '2024-02-29', true],
    ['2024-02-01', '2024-02-28', false],
    ['2026-01-02', '2026-01-31', false],
  ])('%s to %s is %s', (from, to, expected) => {
    expect(isWholeMonths(from, to)).toBe(expected);
  });
});

describe('shiftRangeToPriorYear', () => {
  it('keeps a month-end a month-end in both directions across a leap year', () => {
    expect(shiftRangeToPriorYear('2025-02-01', '2025-02-28')).toEqual({
      fromDate: '2024-02-01',
      toDate: '2024-02-29',
    });
    expect(shiftRangeToPriorYear('2024-02-01', '2024-02-29')).toEqual({
      fromDate: '2023-02-01',
      toDate: '2023-02-28',
    });
  });

  it('clamps a leap-day start and leaves mid-month dates alone', () => {
    expect(shiftRangeToPriorYear('2024-02-29', '2024-06-15')).toEqual({
      fromDate: '2023-02-28',
      toDate: '2023-06-15',
    });
  });
});

describe('enumerateBuckets', () => {
  it('lists every month across a year boundary', () => {
    expect(
      enumerateBuckets('2025-11-10', '2026-01-05', 'monthly').map(
        (b) => b.label,
      ),
    ).toEqual(['Nov 2025', 'Dec 2025', 'Jan 2026']);
  });

  it('groups months into calendar quarters, clipped to the range', () => {
    expect(enumerateBuckets('2026-02-01', '2026-04-30', 'quarterly')).toEqual([
      {
        key: '2026-Q1',
        label: 'Q1 2026',
        fromPeriod: toPeriodNo('2026-02-01'),
        toPeriod: toPeriodNo('2026-03-01'),
      },
      {
        key: '2026-Q2',
        label: 'Q2 2026',
        fromPeriod: toPeriodNo('2026-04-01'),
        toPeriod: toPeriodNo('2026-04-01'),
      },
    ]);
  });
});
