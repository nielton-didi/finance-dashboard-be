import { round } from '../profit-loss/profit-loss-statement.builder';
import { GroupCompanyDto } from './dto/group.dto';

/** What identifies a company's books, beyond the name it was given here. */
export interface CompanyIdentity {
  name: string;
  /** Server and database the figures were read from. */
  database: string;
  /** Home currency, or null when AutoCount doesn't say. */
  currency: string | null;
  fiscalYearStart: string | null;
}

/** Any (nested) set of amounts. */
interface Amounts {
  [key: string]: number | Amounts;
}

/** Adds sets of amounts up field by field. `empty` is the result for no companies. */
export function sumAmounts<T extends object>(sets: T[], empty: T): T {
  const result: Amounts = {};
  for (const [key, zero] of Object.entries(empty) as [
    string,
    number | Amounts,
  ][]) {
    const values = sets.map((set) => (set as Amounts)[key]);
    result[key] =
      typeof zero === 'number'
        ? round((values as number[]).reduce((sum, value) => sum + value, 0))
        : sumAmounts(values as Amounts[], zero);
  }
  return result as T;
}

export function totalOf<T extends object>(
  companies: GroupCompanyDto<T>[],
  empty: T,
): { current: T; prior: T } {
  return {
    current: sumAmounts(
      companies.map((company) => company.current),
      empty,
    ),
    prior: sumAmounts(
      companies.map((company) => company.prior),
      empty,
    ),
  };
}

/** Reasons the totals would mislead if they were read without care. */
export function findWarnings(companies: CompanyIdentity[]): string[] {
  const warnings: string[] = [];

  const byDatabase = new Map<string, string[]>();
  for (const { database, name } of companies) {
    byDatabase.set(database, [...(byDatabase.get(database) ?? []), name]);
  }
  for (const names of byDatabase.values()) {
    if (names.length < 2) continue;
    warnings.push(
      `These organizations read the same AutoCount database, so it is counted ${names.length} times: ${names.join(', ')}.`,
    );
  }

  const currencies = new Set(
    companies.flatMap(({ currency }) => currency ?? []),
  );
  if (currencies.size > 1) {
    warnings.push(
      `The companies use different home currencies (${[...currencies].sort().join(', ')}). The totals add them up without converting.`,
    );
  }

  return warnings;
}

export function findNotes(companies: CompanyIdentity[]): string[] {
  const notes = [
    'Totals add the companies together. Transactions between them are not eliminated.',
  ];
  const yearStarts = new Set(
    companies.flatMap(({ fiscalYearStart }) => fiscalYearStart ?? []),
  );
  if (yearStarts.size > 1) {
    notes.push(
      "The companies' fiscal years start on different dates, so their year to date figures cover different periods.",
    );
  }
  return notes;
}

/** Like Promise.all over `items`, but with at most `limit` running at a time. */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
