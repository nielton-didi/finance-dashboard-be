import * as sql from 'mssql';

/** Runs a read-only, parameterized query against an already-connected Autocount pool. */
export async function runAutocountQuery<T = unknown>(
  pool: sql.ConnectionPool,
  query: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const request = pool.request();
  for (const [name, value] of Object.entries(params)) {
    request.input(name, value);
  }
  const result = await request.query(query);
  return result.recordset as T[];
}
