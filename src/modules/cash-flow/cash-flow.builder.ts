import {
  AccountInfo,
  groupOf,
  isCashAccount,
  rollUpControlAccounts,
} from '../balance-sheet/accounts';
import { toPeriodNo } from '../profit-loss/profit-loss-periods';
import {
  buildProfitLossStatement,
  GlAccountRow,
  PNL_ACC_TYPES,
  PnlAccType,
  round,
} from '../profit-loss/profit-loss-statement.builder';
import {
  applyStockValues,
  stockValuesAt,
  StockValueRow,
} from '../profit-loss/profit-loss-stock';
import {
  CashFlowItemDto,
  CashFlowSectionDto,
  CashFlowStatementDto,
} from './dto/cash-flow.dto';

/** One GLMast account. Amounts are in home currency. */
export interface AccountMovementRow extends AccountInfo {
  /** AutoCount's own label: O(perating), I(nvesting) or F(inancing). */
  cashFlowCategory: string | null;
  /** Debit-positive balance brought in from OBalance. */
  opening: number;
  /** Debit-positive ledger movement before the period. */
  before: number;
  debit: number;
  credit: number;
}

export interface CashFlowInput {
  companyName: string;
  fromDate: string;
  toDate: string;
  accounts: AccountMovementRow[];
  stock: StockValueRow[];
}

export interface CashFlowResult {
  statement: CashFlowStatementDto;
  /** Accounts with movement whose section had to be defaulted. */
  unlabelled: AccountMovementRow[];
  /**
   * Accounts with movement labelled operating whose type says otherwise. Operating is the
   * column's default in AutoCount, so the label may never have been chosen.
   */
  questionable: AccountMovementRow[];
}

type Category = CashFlowSectionDto['key'];

const CATEGORY_BY_LABEL: Record<string, Category> = {
  O: 'operating',
  I: 'investing',
  F: 'financing',
};

function labelledCategory(row: AccountMovementRow): Category | undefined {
  return CATEGORY_BY_LABEL[row.cashFlowCategory?.trim() ?? ''];
}

/** Where an account goes when AutoCount has no label for it. */
function defaultCategory(row: AccountMovementRow): Category {
  if (row.accType === 'AP') return 'financing';
  switch (groupOf(row)) {
    case 'nonCurrentAssets':
      return 'investing';
    case 'nonCurrentLiabilities':
      return 'financing';
    case 'equity':
      return row.accType === 'CP' ? 'financing' : 'operating';
    default:
      return 'operating';
  }
}

const isReportedInProfitLoss = (row: AccountMovementRow) =>
  PNL_ACC_TYPES.includes(row.accType as PnlAccType);

/** Cash effect of a movement: debits use cash, credits provide it. */
const cashEffect = (row: AccountMovementRow) => row.credit - row.debit;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/**
 * Indirect method. The ledger always balances, so cash can only have moved by as much as
 * every other account moved the other way: starting from net profit, each remaining
 * account's change is listed under the activity AutoCount assigns it to. Nothing is
 * picked by name, so no account can be left out and the result always reconciles.
 */
export function buildCashFlow(input: CashFlowInput): CashFlowResult {
  const { companyName, fromDate, toDate, stock } = input;
  const accounts = rollUpControlAccounts(input.accounts, (control, row) => {
    control.opening += row.opening;
    control.before += row.before;
    control.debit += row.debit;
    control.credit += row.credit;
  });
  const cash = accounts.filter(isCashAccount);
  const others = accounts.filter((row) => !isCashAccount(row));
  const profitLoss = others.filter((row) => groupOf(row) === null);

  const { netProfit, stockInProfit } = computeProfit(input, profitLoss);
  const items: Record<Category, CashFlowItemDto[]> = {
    operating: [
      {
        id: 'net_profit',
        kind: 'net_profit',
        accountCode: null,
        label: 'Net profit/(loss) after tax',
        amount: netProfit,
      },
    ],
    investing: [],
    financing: [],
  };
  const unlabelled: AccountMovementRow[] = [];
  const questionable: AccountMovementRow[] = [];
  const categoryOf = (row: AccountMovementRow): Category => {
    const labelled = labelledCategory(row);
    const moved = round(row.debit) !== 0 || round(row.credit) !== 0;
    if (labelled) {
      if (
        moved &&
        labelled === 'operating' &&
        defaultCategory(row) !== 'operating'
      ) {
        questionable.push(row);
      }
      return labelled;
    }
    if (moved) unlabelled.push(row);
    return defaultCategory(row);
  };

  // Profit is operating as a whole. A P&L account that AutoCount labels otherwise (say,
  // loan interest as financing) is taken back out and shown in its own section.
  let reclassified = 0;
  for (const row of profitLoss) {
    const reported = isReportedInProfitLoss(row);
    const category = reported
      ? (labelledCategory(row) ?? 'operating')
      : categoryOf(row);
    if (reported && category === 'operating') continue;
    if (reported) reclassified -= cashEffect(row);
    items[category].push(
      accountItem(row, row.accountName, round(cashEffect(row))),
    );
  }
  items.operating.push({
    id: 'reclassified',
    kind: 'reclassified',
    accountCode: null,
    label: 'Less: items shown under investing and financing',
    amount: round(reclassified),
  });

  const depreciation: CashFlowItemDto[] = [];
  const changes: Record<Category, CashFlowItemDto[]> = {
    operating: [],
    investing: [],
    financing: [],
  };
  const stockAccounts = new Set(stock.map((row) => row.balanceStockAccNo));

  for (const row of others) {
    if (groupOf(row) === null) continue;
    if (row.specialAccType === 'SAD') {
      // Charging depreciation credits accumulated depreciation without using cash, so it
      // is added back. Debits release it on disposal, which belongs with the asset.
      depreciation.push({
        id: `${row.accountCode}:depreciation`,
        kind: 'depreciation',
        accountCode: row.accountCode,
        label: `Depreciation: ${row.accountName}`,
        amount: round(row.credit),
      });
      changes[categoryOf(row)].push(
        accountItem(
          row,
          `Disposals: ${row.accountName}`,
          round(-row.debit),
          ':disposals',
        ),
      );
      continue;
    }
    if (stockAccounts.has(row.accountCode)) continue;
    changes[categoryOf(row)].push(
      accountItem(row, changeLabel(row), round(cashEffect(row))),
    );
  }

  // Valuations reach profit without touching the ledger, so the same amount comes back
  // out here, along with anything that was posted to the stock account itself.
  const stockRows = others.filter((row) => stockAccounts.has(row.accountCode));
  if (stockRows.length > 0 || stockInProfit !== 0) {
    changes.operating.push({
      id: 'stock',
      kind: 'stock',
      accountCode: null,
      label: '(Increase)/decrease in stock',
      amount: round(sum(stockRows.map(cashEffect)) - stockInProfit),
    });
  }

  items.operating.push(...depreciation, ...changes.operating);
  items.investing.push(...changes.investing);
  items.financing.push(...changes.financing);

  const operating = section('operating', 'OPERATING ACTIVITIES', items);
  const investing = section('investing', 'INVESTING ACTIVITIES', items);
  const financing = section('financing', 'FINANCING ACTIVITIES', items);
  const netChange = round(operating.total + investing.total + financing.total);

  const opening = (row: AccountMovementRow) => row.opening + row.before;
  const closing = (row: AccountMovementRow) =>
    opening(row) + row.debit - row.credit;
  const openingCash = round(sum(cash.map(opening)));
  const closingCash = round(sum(cash.map(closing)));

  return {
    unlabelled,
    questionable,
    statement: {
      companyName,
      fromDate,
      toDate,
      operating,
      investing,
      financing,
      netChange,
      openingCash,
      closingCash,
      cashAccounts: cash.map((row) => ({
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: round(closing(row)),
      })),
      unreconciled: round(closingCash - openingCash - netChange),
    },
  };
}

/** Net profit exactly as the P&L reports it, and how much of it is stock valuation. */
function computeProfit(
  { companyName, fromDate, toDate, stock }: CashFlowInput,
  profitLoss: AccountMovementRow[],
) {
  const rows = profitLoss
    .filter(isReportedInProfitLoss)
    .map((row): GlAccountRow => ({
      accountCode: row.accountCode,
      accountName: row.accountName,
      accType: row.accType as PnlAccType,
      amount: round(
        row.normalBalance === 'C' ? cashEffect(row) : -cashEffect(row),
      ),
    }));
  const profitOf = (statementRows: GlAccountRow[]) =>
    buildProfitLossStatement(statementRows, companyName, fromDate, toDate)
      .netProfitAfterTax.amount;

  const netProfit = profitOf(
    applyStockValues(rows, stock, toPeriodNo(fromDate), toPeriodNo(toDate)),
  );
  return { netProfit, stockInProfit: round(netProfit - profitOf(rows)) };
}

function changeLabel(row: AccountMovementRow): string {
  const group = groupOf(row);
  if (group === 'currentAssets') {
    return `(Increase)/decrease in ${row.accountName}`;
  }
  if (group === 'nonCurrentAssets') {
    return `(Purchase)/disposal of ${row.accountName}`;
  }
  return `Increase/(decrease) in ${row.accountName}`;
}

function accountItem(
  row: AccountMovementRow,
  label: string,
  amount: number,
  idSuffix = '',
): CashFlowItemDto {
  return {
    id: `${row.accountCode}${idSuffix}`,
    kind: 'account',
    accountCode: row.accountCode,
    label,
    amount,
  };
}

function section(
  key: Category,
  title: string,
  items: Record<Category, CashFlowItemDto[]>,
): CashFlowSectionDto {
  return {
    key,
    title,
    items: items[key],
    totalLabel: `NET CASH FROM ${title}`,
    total: round(sum(items[key].map((item) => item.amount))),
  };
}

/** Whether any stock set has a valuation that the period's figures depend on. */
export function usesStockValues(
  stock: StockValueRow[],
  toDate: string,
): boolean {
  return stockValuesAt(stock, toPeriodNo(toDate)).length > 0;
}
