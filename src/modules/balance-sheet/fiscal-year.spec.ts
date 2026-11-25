import { fiscalYearStart } from './fiscal-year';

const CALENDAR = [{ fromDate: '2020-01-01', toDate: '2020-12-31' }];
const JULY = [
  { fromDate: '2024-07-01', toDate: '2025-06-30' },
  { fromDate: '2023-07-01', toDate: '2024-06-30' },
];

describe('fiscalYearStart', () => {
  it('uses the fiscal year that contains the date', () => {
    expect(fiscalYearStart(JULY, '2024-06-30')).toBe('2023-07-01');
    expect(fiscalYearStart(JULY, '2024-07-01')).toBe('2024-07-01');
  });

  it('continues the pattern past the last year AutoCount has opened', () => {
    expect(fiscalYearStart(CALENDAR, '2026-11-25')).toBe('2026-01-01');
    expect(fiscalYearStart(JULY, '2026-05-31')).toBe('2025-07-01');
    expect(fiscalYearStart(JULY, '2026-08-31')).toBe('2026-07-01');
  });

  it('continues from the end of an irregular first year', () => {
    const years = [{ fromDate: '2020-01-01', toDate: '2021-06-30' }];
    expect(fiscalYearStart(years, '2022-03-31')).toBe('2021-07-01');
  });

  it('falls back to the calendar year', () => {
    expect(fiscalYearStart([], '2026-03-31')).toBe('2026-01-01');
  });
});
