/** Conventions are the same as in profit-loss.queries.ts. */
const UP_TO_AS_OF = `
  d.TransDate < DATEADD(day, 1, CAST(@asOfDate AS date))
  AND (@projectNo IS NULL OR d.ProjNo = @projectNo)
  AND (@deptNo IS NULL OR d.DeptNo = @deptNo)
`;

const OPENING_FILTER = `
  o.PeriodNo <= @asOfPeriod
  AND (@projectNo IS NULL OR o.ProjNo = @projectNo)
  AND (@deptNo IS NULL OR o.DeptNo = @deptNo)
`;

/**
 * Every account's balance at a date, split so that profit can be divided at the start of
 * the fiscal year. AccGroup is LEFT JOINed: an account must not vanish from the sheet
 * (and unbalance it) because its type has no group.
 */
export const ACCOUNT_BALANCES_SQL = `
  SELECT
    m.AccNo AS accountCode,
    ISNULL(m.Description, '') AS accountName,
    m.AccType AS accType,
    ISNULL(t.Description, m.AccType) AS accTypeName,
    NULLIF(m.SpecialAccType, '') AS specialAccType,
    NULLIF(m.ParentAccNo, '') AS parentAccNo,
    g.[Group] AS groupCode,
    g.NormalBalance AS normalBalance,
    g.Seq AS seq,
    ISNULL(ob.Net, 0) AS opening,
    ISNULL(l.PriorNet, 0) AS priorNet,
    ISNULL(l.CurrentNet, 0) AS currentNet
  FROM GLMast m
  LEFT JOIN AccGroup g ON g.AccType = m.AccType
  LEFT JOIN AccType t ON t.AccType = m.AccType
  LEFT JOIN (
    SELECT o.AccNo, SUM(ISNULL(o.HomeDR, 0) - ISNULL(o.HomeCR, 0)) AS Net
    FROM OBalance o
    WHERE ${OPENING_FILTER}
    GROUP BY o.AccNo
  ) ob ON ob.AccNo = m.AccNo
  LEFT JOIN (
    SELECT
      d.AccNo,
      SUM(CASE WHEN d.TransDate < CAST(@fiscalYearStart AS date)
        THEN ISNULL(d.HomeDR, 0) - ISNULL(d.HomeCR, 0) ELSE 0 END) AS PriorNet,
      SUM(CASE WHEN d.TransDate >= CAST(@fiscalYearStart AS date)
        THEN ISNULL(d.HomeDR, 0) - ISNULL(d.HomeCR, 0) ELSE 0 END) AS CurrentNet
    FROM GLDTL d
    WHERE ${UP_TO_AS_OF}
    GROUP BY d.AccNo
  ) l ON l.AccNo = m.AccNo
  ORDER BY m.AccNo
`;

export const FISCAL_YEARS_SQL = `
  SELECT
    CONVERT(char(10), FromDate, 23) AS fromDate,
    CONVERT(char(10), ToDate, 23) AS toDate
  FROM FiscalYear
`;

export const OPENING_PERIOD_SQL = `
  SELECT MIN(PeriodNo) AS openingPeriod FROM OBalance
`;

/** An account with the individual debtors or creditors that roll up into it. */
const ACCOUNT_AND_SUBSIDIARIES = `
  m.AccNo = @accountNo
  OR (m.ParentAccNo = @accountNo AND m.SpecialAccType IN ('SDR', 'SCR'))
`;

export const BALANCE_TRANSACTIONS_SQL = `
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
  WHERE ${UP_TO_AS_OF} AND (${ACCOUNT_AND_SUBSIDIARIES})
  ORDER BY d.TransDate DESC, d.GLDtlKey DESC
`;

export const BALANCE_TRANSACTION_TOTALS_SQL = `
  SELECT
    COUNT(*) AS totalCount,
    ISNULL(SUM(d.HomeDR), 0) AS totalDebit,
    ISNULL(SUM(d.HomeCR), 0) AS totalCredit
  FROM GLDTL d
  JOIN GLMast m ON m.AccNo = d.AccNo
  WHERE ${UP_TO_AS_OF} AND (${ACCOUNT_AND_SUBSIDIARIES})
`;

export const OPENING_BALANCE_SQL = `
  SELECT
    ISNULL(SUM(o.HomeDR), 0) AS debit,
    ISNULL(SUM(o.HomeCR), 0) AS credit
  FROM OBalance o
  JOIN GLMast m ON m.AccNo = o.AccNo
  WHERE ${OPENING_FILTER} AND (${ACCOUNT_AND_SUBSIDIARIES})
`;
