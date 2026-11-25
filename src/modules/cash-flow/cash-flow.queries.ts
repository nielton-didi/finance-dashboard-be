/** Conventions are the same as in profit-loss.queries.ts. */
const DIMENSIONS = `
  (@projectNo IS NULL OR d.ProjNo = @projectNo)
  AND (@deptNo IS NULL OR d.DeptNo = @deptNo)
`;

/**
 * Every account's balance before a period and its movement during it. Opening balances
 * are not cash flows, so they count as already there even when the books were opened
 * during the period.
 */
export const ACCOUNT_MOVEMENTS_SQL = `
  SELECT
    m.AccNo AS accountCode,
    ISNULL(m.Description, '') AS accountName,
    m.AccType AS accType,
    NULLIF(m.SpecialAccType, '') AS specialAccType,
    NULLIF(m.ParentAccNo, '') AS parentAccNo,
    m.CashFlowCategory AS cashFlowCategory,
    g.[Group] AS groupCode,
    g.NormalBalance AS normalBalance,
    ISNULL(ob.Net, 0) AS opening,
    ISNULL(l.BeforeNet, 0) AS before,
    ISNULL(l.DR, 0) AS debit,
    ISNULL(l.CR, 0) AS credit
  FROM GLMast m
  LEFT JOIN AccGroup g ON g.AccType = m.AccType
  LEFT JOIN (
    SELECT d.AccNo, SUM(ISNULL(d.HomeDR, 0) - ISNULL(d.HomeCR, 0)) AS Net
    FROM OBalance d
    WHERE d.PeriodNo <= @toPeriod AND ${DIMENSIONS}
    GROUP BY d.AccNo
  ) ob ON ob.AccNo = m.AccNo
  LEFT JOIN (
    SELECT
      d.AccNo,
      SUM(CASE WHEN d.TransDate < CAST(@fromDate AS date)
        THEN ISNULL(d.HomeDR, 0) - ISNULL(d.HomeCR, 0) ELSE 0 END) AS BeforeNet,
      SUM(CASE WHEN d.TransDate >= CAST(@fromDate AS date)
        THEN ISNULL(d.HomeDR, 0) ELSE 0 END) AS DR,
      SUM(CASE WHEN d.TransDate >= CAST(@fromDate AS date)
        THEN ISNULL(d.HomeCR, 0) ELSE 0 END) AS CR
    FROM GLDTL d
    WHERE d.TransDate < DATEADD(day, 1, CAST(@toDate AS date)) AND ${DIMENSIONS}
    GROUP BY d.AccNo
  ) l ON l.AccNo = m.AccNo
  ORDER BY m.AccNo
`;

/** An account in a period, with the individual debtors or creditors it includes. */
const ACCOUNT_IN_PERIOD = `
  d.TransDate >= CAST(@fromDate AS date)
  AND d.TransDate < DATEADD(day, 1, CAST(@toDate AS date))
  AND ${DIMENSIONS}
  AND (
    m.AccNo = @accountNo
    OR (m.ParentAccNo = @accountNo AND m.SpecialAccType IN ('SDR', 'SCR'))
  )
`;

export const MOVEMENT_TRANSACTIONS_SQL = `
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
  WHERE ${ACCOUNT_IN_PERIOD}
  ORDER BY d.TransDate DESC, d.GLDtlKey DESC
`;

export const MOVEMENT_TRANSACTION_TOTALS_SQL = `
  SELECT
    COUNT(*) AS totalCount,
    ISNULL(SUM(d.HomeDR), 0) AS totalDebit,
    ISNULL(SUM(d.HomeCR), 0) AS totalCredit
  FROM GLDTL d
  JOIN GLMast m ON m.AccNo = d.AccNo
  WHERE ${ACCOUNT_IN_PERIOD}
`;
