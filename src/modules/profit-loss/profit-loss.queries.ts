/**
 * Every query is read-only and fully parameterized. Shared conventions:
 * - Dates are compared as [fromDate, toDate + 1 day) via CAST(... AS date), which is
 *   independent of the customer server's DATEFORMAT and of any time part on TransDate.
 * - Amounts are HomeDR / HomeCR (home currency): DR / CR are in the account's own
 *   currency, so they cannot be added up across accounts.
 * - A NULL @projectNo / @deptNo means "no filter".
 */
const GLDTL_FILTER = `
  d.TransDate >= CAST(@fromDate AS date)
  AND d.TransDate < DATEADD(day, 1, CAST(@toDate AS date))
  AND (@projectNo IS NULL OR d.ProjNo = @projectNo)
  AND (@deptNo IS NULL OR d.DeptNo = @deptNo)
`;

const PNL_ACC_TYPES_SQL = `('SL', 'SA', 'CO', 'OI', 'EP', 'TX')`;

/**
 * GLDTL has no account category of its own — GLMast.AccType classifies each account,
 * and AccGroup.NormalBalance (D/C) tells us which side (DR or CR) is that account's
 * "natural" balance, so revenue-type accounts (SL, OI) net as CR-DR while cost/expense
 * accounts (SA, CO, EP, TX) net as DR-CR. Both come out positive for a normal balance.
 *
 * Returns one row per account per month with movement, and one row with a NULL periodNo
 * for accounts with none — so every P&L account is always present in the statement.
 */
export const GL_ACCOUNT_PERIODS_SQL = `
  SELECT
    m.AccNo AS accountCode,
    ISNULL(m.Description, '') AS accountName,
    m.AccType AS accType,
    p.PeriodNo AS periodNo,
    ISNULL(
      CASE WHEN g.NormalBalance = 'C' THEN p.CR - p.DR ELSE p.DR - p.CR END,
      0
    ) AS amount
  FROM GLMast m
  JOIN AccGroup g ON g.AccType = m.AccType
  LEFT JOIN (
    SELECT
      d.AccNo,
      YEAR(d.TransDate) * 12 + MONTH(d.TransDate) AS PeriodNo,
      SUM(ISNULL(d.HomeDR, 0)) AS DR,
      SUM(ISNULL(d.HomeCR, 0)) AS CR
    FROM GLDTL d
    WHERE ${GLDTL_FILTER}
    GROUP BY d.AccNo, YEAR(d.TransDate) * 12 + MONTH(d.TransDate)
  ) p ON p.AccNo = m.AccNo
  WHERE m.AccType IN ${PNL_ACC_TYPES_SQL}
  ORDER BY m.AccNo, p.PeriodNo
`;

/** Budget amounts are entered per account in its natural balance, so need no netting. */
export const BUDGET_ACCOUNT_ROWS_SQL = `
  SELECT
    m.AccNo AS accountCode,
    ISNULL(m.Description, '') AS accountName,
    m.AccType AS accType,
    ISNULL(b.Amount, 0) AS amount
  FROM GLMast m
  LEFT JOIN (
    SELECT AccNO, SUM(ISNULL(Amount, 0)) AS Amount
    FROM BudgetPBalance
    WHERE BudgetKey = CAST(@budgetKey AS bigint)
      AND PeriodNo BETWEEN @fromPeriod AND @toPeriod
      AND (@projectNo IS NULL OR ProjNo = @projectNo)
      AND (@deptNo IS NULL OR DeptNo = @deptNo)
    GROUP BY AccNO
  ) b ON b.AccNO = m.AccNo
  WHERE m.AccType IN ${PNL_ACC_TYPES_SQL}
  ORDER BY m.AccNo
`;

export const BUDGET_NAME_SQL = `
  SELECT BudgetName AS name FROM Budget WHERE BudgetKey = CAST(@budgetKey AS bigint)
`;

export const STOCK_VALUES_SQL = `
  SELECT
    s.StockSetKey AS stockSetKey,
    s.OpenStock AS openStockAccNo,
    s.CloseStock AS closeStockAccNo,
    s.BalanceStock AS balanceStockAccNo,
    p.PeriodNo AS periodNo,
    SUM(ISNULL(p.Balance, 0)) AS balance
  FROM StockPBalance p
  JOIN StockSet s ON s.StockSetKey = p.StockSetKey
  WHERE p.PeriodNo <= @toPeriod
    AND (@projectNo IS NULL OR p.ProjNo = @projectNo)
    AND (@deptNo IS NULL OR p.DeptNo = @deptNo)
  GROUP BY s.StockSetKey, s.OpenStock, s.CloseStock, s.BalanceStock, p.PeriodNo
`;

const TRANSACTION_FILTER = `
  ${GLDTL_FILTER}
  AND m.AccType IN ${PNL_ACC_TYPES_SQL}
  AND (@accountNo IS NULL OR d.AccNo = @accountNo)
  AND (@accType IS NULL OR m.AccType = @accType)
`;

export const TRANSACTIONS_SQL = `
  SELECT TOP (@limit)
    CAST(d.GLDtlKey AS varchar(20)) AS [key],
    CONVERT(char(10), d.TransDate, 23) AS date,
    d.AccNo AS accountCode,
    ISNULL(m.Description, '') AS accountName,
    d.Description AS description,
    NULLIF(d.RefNo1, '') AS reference,
    d.JournalType AS journalType,
    d.ProjNo AS projectNo,
    d.DeptNo AS deptNo,
    ISNULL(d.HomeDR, 0) AS debit,
    ISNULL(d.HomeCR, 0) AS credit
  FROM GLDTL d
  JOIN GLMast m ON m.AccNo = d.AccNo
  WHERE ${TRANSACTION_FILTER}
  ORDER BY d.TransDate DESC, d.GLDtlKey DESC
`;

export const TRANSACTION_TOTALS_SQL = `
  SELECT
    COUNT(*) AS totalCount,
    ISNULL(SUM(d.HomeDR), 0) AS totalDebit,
    ISNULL(SUM(d.HomeCR), 0) AS totalCredit
  FROM GLDTL d
  JOIN GLMast m ON m.AccNo = d.AccNo
  WHERE ${TRANSACTION_FILTER}
`;

export const PROJECTS_SQL = `
  SELECT ProjNo AS code, ISNULL(Description, '') AS name FROM Project ORDER BY ProjNo
`;

export const DEPARTMENTS_SQL = `
  SELECT DeptNo AS code, ISNULL(Description, '') AS name FROM Dept ORDER BY DeptNo
`;

export const BUDGETS_SQL = `
  SELECT CAST(BudgetKey AS varchar(20)) AS [key], BudgetName AS name
  FROM Budget
  ORDER BY BudgetName
`;
