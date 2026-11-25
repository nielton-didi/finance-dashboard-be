/** What GLMast and AccGroup say about an account. */
export interface AccountInfo {
  accountCode: string;
  accountName: string;
  accType: string;
  specialAccType: string | null;
  parentAccNo: string | null;
  /** AccGroup.Group: AS / FN are balance sheet groups, everything else is P&L. */
  groupCode: string | null;
  normalBalance: string | null;
}

export type GroupKey =
  | 'nonCurrentAssets'
  | 'currentAssets'
  | 'equity'
  | 'nonCurrentLiabilities'
  | 'currentLiabilities';

const GROUP_BY_ACC_TYPE: Record<string, GroupKey> = {
  FA: 'nonCurrentAssets',
  OA: 'nonCurrentAssets',
  CA: 'currentAssets',
  CL: 'currentLiabilities',
  CP: 'equity',
  RE: 'equity',
  LL: 'nonCurrentLiabilities',
  OL: 'nonCurrentLiabilities',
};

export const isDebitGroup = (group: GroupKey) =>
  group === 'nonCurrentAssets' || group === 'currentAssets';

/** Null for P&L accounts. Custom account types fall back to their AutoCount group. */
export function groupOf(row: AccountInfo): GroupKey | null {
  const known = GROUP_BY_ACC_TYPE[row.accType];
  if (known) return known;
  if (row.groupCode === 'AS') {
    return row.normalBalance === 'C' ? 'currentLiabilities' : 'currentAssets';
  }
  return row.groupCode === 'FN' ? 'nonCurrentLiabilities' : null;
}

/** Bank (SBK) and cash in hand (SCH) accounts. */
export const isCashAccount = ({ specialAccType }: AccountInfo) =>
  specialAccType === 'SBK' || specialAccType === 'SCH';

/** SDR / SCR are individual debtors and creditors, each its own GLMast account. */
const SUBSIDIARY_TYPES = new Set(['SDR', 'SCR']);

/** Folds individual debtors and creditors into their control account. */
export function rollUpControlAccounts<T extends AccountInfo>(
  accounts: T[],
  merge: (control: T, row: T) => void,
): T[] {
  const byCode = new Map(accounts.map((row) => [row.accountCode, { ...row }]));
  const controlOf = (row: T): T => {
    const visited = new Set<string>();
    let current = row;
    while (
      SUBSIDIARY_TYPES.has(current.specialAccType ?? '') &&
      current.parentAccNo &&
      !visited.has(current.accountCode)
    ) {
      visited.add(current.accountCode);
      const parent = byCode.get(current.parentAccNo);
      if (!parent) break;
      current = parent;
    }
    return current;
  };

  for (const row of accounts) {
    const control = controlOf(row);
    if (control.accountCode === row.accountCode) continue;
    merge(control, row);
    byCode.delete(row.accountCode);
  }
  return [...byCode.values()];
}
