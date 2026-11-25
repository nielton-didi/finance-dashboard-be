import {
  buildProfitLossStatement,
  GlAccountRow,
  percentOf,
  PNL_ACC_TYPES,
  PnlAccType,
  round,
} from '../profit-loss/profit-loss-statement.builder';
import { toPeriodNo } from '../profit-loss/profit-loss-periods';
import {
  applyStockValues,
  stockValuesAt,
  StockValueRow,
} from '../profit-loss/profit-loss-stock';
import {
  BalanceSheetGroupDto,
  BalanceSheetItemDto,
  BalanceSheetSectionDto,
  BalanceSheetStatementDto,
  BalanceSheetTotalDto,
} from './dto/balance-sheet.dto';

/** One GLMast account. Amounts are debit-positive, in home currency. */
export interface AccountBalanceRow {
  accountCode: string;
  accountName: string;
  accType: string;
  accTypeName: string;
  specialAccType: string | null;
  parentAccNo: string | null;
  /** AccGroup.Group: AS / FN are balance sheet groups, everything else is P&L. */
  groupCode: string | null;
  normalBalance: string | null;
  seq: number | null;
  /** From OBalance — balances brought in when the books were set up. */
  opening: number;
  /** Ledger movement before the current fiscal year. */
  priorNet: number;
  /** Ledger movement in the current fiscal year, up to the as-of date. */
  currentNet: number;
}

export interface BalanceSheetInput {
  companyName: string;
  asOfDate: string;
  fiscalYearStart: string;
  accounts: AccountBalanceRow[];
  stock: StockValueRow[];
  /** The period OBalance applies from, or null when there are no opening balances. */
  openingPeriod: number | null;
}

type GroupKey =
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

const GROUP_LABELS: Record<GroupKey, string> = {
  nonCurrentAssets: 'TOTAL NON-CURRENT ASSETS',
  currentAssets: 'TOTAL CURRENT ASSETS',
  equity: 'TOTAL EQUITY',
  nonCurrentLiabilities: 'TOTAL NON-CURRENT LIABILITIES',
  currentLiabilities: 'TOTAL CURRENT LIABILITIES',
};

const isDebitGroup = (group: GroupKey) =>
  group === 'nonCurrentAssets' || group === 'currentAssets';

/** Null for P&L accounts. Custom account types fall back to their AutoCount group. */
function groupOf(row: AccountBalanceRow): GroupKey | null {
  const known = GROUP_BY_ACC_TYPE[row.accType];
  if (known) return known;
  if (row.groupCode === 'AS') {
    return row.normalBalance === 'C' ? 'currentLiabilities' : 'currentAssets';
  }
  return row.groupCode === 'FN' ? 'nonCurrentLiabilities' : null;
}

const net = (row: AccountBalanceRow) =>
  row.opening + row.priorNet + row.currentNet;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function buildBalanceSheet(
  input: BalanceSheetInput,
): BalanceSheetStatementDto {
  const { companyName, asOfDate, fiscalYearStart } = input;
  const { assetAdjustments, profitAdjustment } = valueStock(input);
  const profit = splitProfit(input, profitAdjustment);

  const balances = rollUpControlAccounts(input.accounts).map((row) => ({
    row,
    group: groupOf(row),
    amount: net(row) + (assetAdjustments.get(row.accountCode) ?? 0),
    hasStockValue: assetAdjustments.has(row.accountCode),
  }));

  const natural = (b: (typeof balances)[number]) =>
    b.group && isDebitGroup(b.group) ? b.amount : -b.amount;

  // Summed before rounding, so displayed totals never drift from the ledger.
  const totalAssets = round(
    sum(
      balances
        .filter((b) => b.group && isDebitGroup(b.group))
        .map((b) => b.amount),
    ),
  );

  const buildGroup = (key: GroupKey): BalanceSheetGroupDto => {
    const bySection = new Map<
      string,
      BalanceSheetSectionDto & { seq: number }
    >();
    for (const b of balances) {
      if (b.group !== key) continue;
      const { accType, accTypeName, seq } = b.row;
      let section = bySection.get(accType);
      if (!section) {
        section = {
          accType,
          title: accTypeName.toUpperCase(),
          items: [],
          total: 0,
          percent: 0,
          seq: seq ?? 99,
        };
        bySection.set(accType, section);
      }
      section.items.push(
        item(
          {
            accountCode: b.row.accountCode,
            accountName: b.row.accountName,
            amount: natural(b),
            hasStockValue: b.hasStockValue,
          },
          totalAssets,
        ),
      );
    }

    if (key === 'equity') {
      const retained = bySection.get('RE') ?? {
        accType: 'RE',
        title: 'RETAINED EARNING',
        items: [],
        total: 0,
        percent: 0,
        seq: 99,
      };
      bySection.set('RE', retained);
      retained.items.push(...profitItems(profit, totalAssets));
    }

    const sections = [...bySection.values()]
      .sort((a, b) => a.seq - b.seq)
      .map(({ accType, title, items }) => {
        const total = round(sum(items.map((i) => i.amount)));
        return {
          accType,
          title,
          items,
          total,
          percent: percentOf(total, totalAssets),
        };
      });
    const amount = round(sum(sections.map((s) => s.total)));
    return {
      label: GROUP_LABELS[key],
      sections,
      amount,
      percent: percentOf(amount, totalAssets),
    };
  };

  const total = (label: string, amount: number): BalanceSheetTotalDto => ({
    label,
    amount: round(amount),
    percent: percentOf(round(amount), totalAssets),
  });

  const nonCurrentAssets = buildGroup('nonCurrentAssets');
  const currentAssets = buildGroup('currentAssets');
  const equity = buildGroup('equity');
  const nonCurrentLiabilities = buildGroup('nonCurrentLiabilities');
  const currentLiabilities = buildGroup('currentLiabilities');
  const liabilities = nonCurrentLiabilities.amount + currentLiabilities.amount;
  const assets = nonCurrentAssets.amount + currentAssets.amount;

  return {
    companyName,
    asOfDate,
    fiscalYearStart,
    nonCurrentAssets,
    currentAssets,
    totalAssets: total('TOTAL ASSETS', assets),
    equity,
    nonCurrentLiabilities,
    currentLiabilities,
    totalLiabilities: total('TOTAL LIABILITIES', liabilities),
    totalEquityAndLiabilities: total(
      'TOTAL EQUITY AND LIABILITIES',
      equity.amount + liabilities,
    ),
    outOfBalance: round(assets - liabilities - equity.amount),
    assetComposition: composeAssets(balances),
  };
}

/**
 * AutoCount keeps stock valuations outside the ledger: the valuation in force is shown as
 * an asset, and the same amount reaches accumulated profit through closing stock.
 *
 * Stock that was already in the opening balances must not be counted as profit again. It
 * can be there in two ways: as an opening balance on the stock account itself, or only as
 * a valuation for the period before the books opened, which leaves the other opening
 * balances short by exactly that amount.
 */
function valueStock({
  accounts,
  stock,
  asOfDate,
  openingPeriod,
}: BalanceSheetInput) {
  const assetAdjustments = new Map<string, number>();
  let profitAdjustment = 0;

  const openingByAccount = new Map(
    accounts.map((row) => [row.accountCode, row.opening]),
  );
  for (const valuation of stockValuesAt(stock, toPeriodNo(asOfDate))) {
    const accNo = valuation.balanceStockAccNo;
    const previous = assetAdjustments.get(accNo);
    // An opening balance on the account is replaced once, however many sets share it.
    const replaced =
      previous === undefined ? (openingByAccount.get(accNo) ?? 0) : 0;
    assetAdjustments.set(accNo, (previous ?? 0) + valuation.balance - replaced);
    profitAdjustment += valuation.balance - replaced;
  }

  if (openingPeriod !== null && toPeriodNo(asOfDate) >= openingPeriod) {
    const openingStock = sum(
      stockValuesAt(stock, openingPeriod - 1).map((s) => s.balance),
    );
    const openingGap = sum(accounts.map((row) => row.opening));
    if (openingStock !== 0 && round(openingGap + openingStock) === 0) {
      profitAdjustment -= openingStock;
    }
  }

  return { assetAdjustments, profitAdjustment };
}

interface ProfitSplit {
  broughtForward: number;
  currentYear: number;
  currentYearOther: number;
}

/**
 * AutoCount never posts profit to retained earnings: the balance sheet adds up every P&L
 * account. The current year's figure comes from the P&L builder, so it always equals the
 * Profit & Loss report; whatever else has accumulated was earned before this year.
 */
function splitProfit(
  {
    accounts,
    stock,
    companyName,
    asOfDate,
    fiscalYearStart,
  }: BalanceSheetInput,
  profitAdjustment: number,
): ProfitSplit {
  const pnlAccounts = accounts.filter((row) => groupOf(row) === null);
  const reported = (row: AccountBalanceRow) =>
    PNL_ACC_TYPES.includes(row.accType as PnlAccType);

  const rows = pnlAccounts.filter(reported).map((row): GlAccountRow => ({
    accountCode: row.accountCode,
    accountName: row.accountName,
    accType: row.accType as PnlAccType,
    amount: round(row.normalBalance === 'C' ? -row.currentNet : row.currentNet),
  }));
  const currentYear = buildProfitLossStatement(
    applyStockValues(
      rows,
      stock,
      toPeriodNo(fiscalYearStart),
      toPeriodNo(asOfDate),
    ),
    companyName,
    fiscalYearStart,
    asOfDate,
  ).netProfitAfterTax.amount;

  // Extraordinary items and appropriations (e.g. dividends), which the P&L leaves out.
  const currentYearOther = -sum(
    pnlAccounts.filter((row) => !reported(row)).map((row) => row.currentNet),
  );
  const accumulated = -sum(pnlAccounts.map(net)) + profitAdjustment;

  return {
    broughtForward: accumulated - currentYear - currentYearOther,
    currentYear,
    currentYearOther,
  };
}

function profitItems(
  profit: ProfitSplit,
  totalAssets: number,
): BalanceSheetItemDto[] {
  const calculated = (
    key: NonNullable<BalanceSheetItemDto['calculated']>,
    accountName: string,
    amount: number,
  ) => ({
    ...item(
      { accountCode: null, accountName, amount, hasStockValue: false },
      totalAssets,
    ),
    calculated: key,
  });

  return [
    calculated(
      'retained_brought_forward',
      'Accumulated profit/(loss) brought forward',
      profit.broughtForward,
    ),
    calculated(
      'current_year_profit',
      'Current year profit/(loss) after tax',
      profit.currentYear,
    ),
    calculated(
      'current_year_other',
      'Extraordinary items and appropriations',
      profit.currentYearOther,
    ),
  ];
}

function item(
  fields: Pick<
    BalanceSheetItemDto,
    'accountCode' | 'accountName' | 'amount' | 'hasStockValue'
  >,
  totalAssets: number,
): BalanceSheetItemDto {
  const amount = round(fields.amount);
  return {
    ...fields,
    calculated: null,
    amount,
    percent: percentOf(amount, totalAssets),
  };
}

/** SDR / SCR are individual debtors and creditors, each its own GLMast account. */
const SUBSIDIARY_TYPES = new Set(['SDR', 'SCR']);

/** Folds individual debtors and creditors into their control account. */
function rollUpControlAccounts(
  accounts: AccountBalanceRow[],
): AccountBalanceRow[] {
  const byCode = new Map(accounts.map((row) => [row.accountCode, { ...row }]));
  const controlOf = (row: AccountBalanceRow): AccountBalanceRow => {
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
    control.opening += row.opening;
    control.priorNet += row.priorNet;
    control.currentNet += row.currentNet;
    byCode.delete(row.accountCode);
  }
  return [...byCode.values()];
}

function composeAssets(
  balances: {
    row: AccountBalanceRow;
    group: GroupKey | null;
    amount: number;
    hasStockValue: boolean;
  }[],
): BalanceSheetStatementDto['assetComposition'] {
  const categories = [
    { key: 'fixed', label: 'Fixed assets', amount: 0 },
    { key: 'other', label: 'Other assets', amount: 0 },
    { key: 'stock', label: 'Stock', amount: 0 },
    { key: 'debtors', label: 'Trade debtors', amount: 0 },
    { key: 'cash', label: 'Cash and bank', amount: 0 },
    { key: 'otherCurrent', label: 'Other current assets', amount: 0 },
  ];
  const add = (key: string, amount: number) => {
    categories.find((c) => c.key === key)!.amount += amount;
  };

  for (const { row, group, amount, hasStockValue } of balances) {
    if (!group || !isDebitGroup(group)) continue;
    const special = row.specialAccType ?? '';
    if (row.accType === 'FA') add('fixed', amount);
    else if (group === 'nonCurrentAssets') add('other', amount);
    else if (special === 'SBS' || hasStockValue) add('stock', amount);
    else if (special === 'SDC' || special === 'SDR') add('debtors', amount);
    else if (special === 'SBK' || special === 'SCH') add('cash', amount);
    else add('otherCurrent', amount);
  }
  return categories.map((c) => ({ ...c, amount: round(c.amount) }));
}
