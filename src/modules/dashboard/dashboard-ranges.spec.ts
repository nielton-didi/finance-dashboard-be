import { performanceRanges } from './dashboard-ranges';

describe('performanceRanges', () => {
  it('covers the month, fiscal year and twelve months to a date', () => {
    const { current, prior } = performanceRanges('2026-11-25', '2026-07-01');
    expect(current).toEqual({
      mtd: { fromDate: '2026-11-01', toDate: '2026-11-25' },
      ytd: { fromDate: '2026-07-01', toDate: '2026-11-25' },
      ttm: { fromDate: '2025-11-26', toDate: '2026-11-25' },
    });
    expect(prior).toEqual({
      mtd: { fromDate: '2025-11-01', toDate: '2025-11-25' },
      ytd: { fromDate: '2025-07-01', toDate: '2025-11-25' },
      ttm: { fromDate: '2024-11-26', toDate: '2025-11-25' },
    });
  });

  it('keeps twelve whole months at a month-end, either side of a leap day', () => {
    const { current, prior } = performanceRanges('2025-02-28', '2025-01-01');
    expect(current.ttm).toEqual({
      fromDate: '2024-03-01',
      toDate: '2025-02-28',
    });
    expect(prior.ttm).toEqual({ fromDate: '2023-03-01', toDate: '2024-02-29' });
    expect(prior.mtd).toEqual({ fromDate: '2024-02-01', toDate: '2024-02-29' });
  });
});
