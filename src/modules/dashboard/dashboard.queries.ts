export const RANGE_COUNT = 6;

const ranges = Array.from({ length: RANGE_COUNT }, (_, i) => i);

/**
 * Every P&L account's movement in several date ranges from one pass over the ledger, with
 * parameters @from0 / @to0 and so on. Signs follow GL_ACCOUNT_PERIODS_SQL in
 * profit-loss.queries.ts, so the figures match the Profit & Loss report.
 */
export const PNL_RANGES_SQL = `
  SELECT
    m.AccNo AS accountCode,
    ISNULL(m.Description, '') AS accountName,
    m.AccType AS accType,
    ${ranges
      .map(
        (i) =>
          `ISNULL(CASE WHEN g.NormalBalance = 'C' THEN -l.Net${i} ELSE l.Net${i} END, 0) AS amount${i}`,
      )
      .join(',\n    ')}
  FROM GLMast m
  JOIN AccGroup g ON g.AccType = m.AccType
  LEFT JOIN (
    SELECT
      d.AccNo,
      ${ranges
        .map(
          (i) => `SUM(CASE
        WHEN d.TransDate >= CAST(@from${i} AS date)
          AND d.TransDate < DATEADD(day, 1, CAST(@to${i} AS date))
        THEN ISNULL(d.HomeDR, 0) - ISNULL(d.HomeCR, 0) ELSE 0 END) AS Net${i}`,
        )
        .join(',\n      ')}
    FROM GLDTL d
    WHERE d.TransDate >= CAST(@earliest AS date)
      AND d.TransDate < DATEADD(day, 1, CAST(@latest AS date))
    GROUP BY d.AccNo
  ) l ON l.AccNo = m.AccNo
  WHERE m.AccType IN ('SL', 'SA', 'CO', 'OI', 'EP', 'TX')
  ORDER BY m.AccNo
`;

/**
 * The latest documents. A document posts several ledger lines, so recent lines are
 * collapsed by reference; its amount is everything it debited.
 */
export const RECENT_DOCUMENTS_SQL = `
  SELECT TOP (@limit)
    MAX(r.GLDtlKey) AS lastKey,
    CONVERT(char(10), r.TransDate, 23) AS date,
    NULLIF(r.RefNo1, '') AS reference,
    r.JournalType AS journalType,
    MIN(r.Description) AS description,
    SUM(ISNULL(r.HomeDR, 0)) AS amount
  FROM (
    SELECT TOP (@lineLimit)
      d.GLDtlKey, d.TransDate, d.RefNo1, d.JournalType, d.Description, d.HomeDR
    FROM GLDTL d
    WHERE d.TransDate < DATEADD(day, 1, CAST(@asOfDate AS date))
    ORDER BY d.TransDate DESC, d.GLDtlKey DESC
  ) r
  GROUP BY r.TransDate, r.RefNo1, r.JournalType,
    CASE WHEN NULLIF(r.RefNo1, '') IS NULL THEN r.GLDtlKey ELSE 0 END
  ORDER BY r.TransDate DESC, MAX(r.GLDtlKey) DESC
`;
