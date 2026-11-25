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
