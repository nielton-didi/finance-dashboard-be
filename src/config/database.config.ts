import { registerAs } from '@nestjs/config';

export const appDbConfig = registerAs('appDb', () => ({
  host: process.env.APP_DB_HOST || 'localhost',
  port: parseInt(process.env.APP_DB_PORT || '1433', 10),
  username: process.env.APP_DB_USERNAME || '',
  password: process.env.APP_DB_PASSWORD || '',
  database: process.env.APP_DB_NAME || 'finance-dashboard-db',
}));

export const autocountPoolConfig = registerAs('autocountPool', () => ({
  maxCachedConnections: parseInt(
    process.env.AUTOCOUNT_POOL_MAX_CACHED ?? '50',
    10,
  ),
  idleEvictionMs: parseInt(
    process.env.AUTOCOUNT_POOL_IDLE_MS ?? String(20 * 60_000),
    10,
  ),
  sweepIntervalMs: parseInt(
    process.env.AUTOCOUNT_POOL_SWEEP_MS ?? String(60_000),
    10,
  ),
  perOrgMaxConnections: parseInt(
    process.env.AUTOCOUNT_POOL_PER_ORG_MAX ?? '5',
    10,
  ),
  connectionTimeoutMs: parseInt(
    process.env.AUTOCOUNT_CONNECTION_TIMEOUT_MS ?? '8000',
    10,
  ),
  requestTimeoutMs: parseInt(
    process.env.AUTOCOUNT_REQUEST_TIMEOUT_MS ?? '30000',
    10,
  ),
}));
