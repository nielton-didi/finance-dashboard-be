import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { OrganizationAutocountCredentialsService } from '../organizations/organization-autocount-credentials.service';
import { AutocountConnectionError } from './autocount-connection.errors';

interface CacheEntry {
  poolPromise: Promise<sql.ConnectionPool>;
  lastUsedAt: number;
}

/**
 * Every request is scoped to one organization's Autocount database, queried live —
 * there is no sync/cache layer for the DATA, only for the underlying DB CONNECTIONS
 * (opening a fresh TCP connection + login per request would be slow and could exhaust
 * connections on the customer's SQL Server). This manager caches one pool per
 * organization, evicts idle ones, and never uses TypeORM for this path — Autocount
 * access is 100% raw parameterized queries, no entities/migrations, so the mssql
 * package's own ConnectionPool is the right-sized tool.
 */
@Injectable()
export class AutocountConnectionManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(AutocountConnectionManagerService.name);
  private readonly entries = new Map<number, CacheEntry>();
  private readonly sweepHandle: NodeJS.Timeout;

  private readonly maxCachedConnections: number;
  private readonly idleEvictionMs: number;
  private readonly perOrgMaxConnections: number;
  private readonly connectionTimeoutMs: number;
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly credentialsService: OrganizationAutocountCredentialsService,
    private readonly configService: ConfigService,
  ) {
    this.maxCachedConnections = this.configService.get<number>(
      'autocountPool.maxCachedConnections',
      50,
    );
    this.idleEvictionMs = this.configService.get<number>(
      'autocountPool.idleEvictionMs',
      20 * 60_000,
    );
    this.perOrgMaxConnections = this.configService.get<number>(
      'autocountPool.perOrgMaxConnections',
      5,
    );
    this.connectionTimeoutMs = this.configService.get<number>(
      'autocountPool.connectionTimeoutMs',
      8000,
    );
    this.requestTimeoutMs = this.configService.get<number>(
      'autocountPool.requestTimeoutMs',
      30000,
    );

    const sweepIntervalMs = this.configService.get<number>(
      'autocountPool.sweepIntervalMs',
      60_000,
    );
    this.sweepHandle = setInterval(
      () => this.sweepIdle(),
      sweepIntervalMs,
    ).unref();
  }

  async getConnection(organizationId: number): Promise<sql.ConnectionPool> {
    const existing = this.entries.get(organizationId);
    if (existing) {
      existing.lastUsedAt = Date.now();
      this.touchLru(organizationId);
      return existing.poolPromise;
    }

    this.evictIfOverCapacity();

    const poolPromise = this.createPool(organizationId).catch((err) => {
      this.entries.delete(organizationId);
      throw err;
    });
    this.entries.set(organizationId, {
      poolPromise,
      lastUsedAt: Date.now(),
    });
    return poolPromise;
  }

  /** Call after an organization's stored credentials change, to force a fresh connection. */
  invalidate(organizationId: number): void {
    this.evict(organizationId, 'credentials-updated');
  }

  private async createPool(
    organizationId: number,
  ): Promise<sql.ConnectionPool> {
    const credentials =
      await this.credentialsService.getDecrypted(organizationId);
    if (!credentials) {
      throw new AutocountConnectionError(
        organizationId,
        'NOT_CONFIGURED',
        `No Autocount connection configured for organization #${organizationId}`,
      );
    }

    const pool = new sql.ConnectionPool({
      server: credentials.host,
      port: credentials.port,
      user: credentials.username,
      password: credentials.password,
      database: credentials.database,
      connectionTimeout: this.connectionTimeoutMs,
      requestTimeout: this.requestTimeoutMs,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      pool: {
        min: 0,
        max: this.perOrgMaxConnections,
        idleTimeoutMillis: 30_000,
      },
    });

    pool.on('error', (err: Error) => {
      this.logger.error(
        `Autocount pool background error for organization #${organizationId}: ${err.message}`,
      );
      this.evict(organizationId, 'pool-error');
    });

    try {
      await pool.connect();
    } catch (err: unknown) {
      await pool.close().catch(() => undefined);
      const code = (err as { code?: string })?.code;
      const reason =
        code === 'ELOGIN'
          ? 'AUTH_FAILED'
          : code === 'ETIMEOUT' || code === 'ESOCKET'
            ? 'UNREACHABLE'
            : 'UNKNOWN';
      const message = err instanceof Error ? err.message : String(err);
      throw new AutocountConnectionError(
        organizationId,
        reason,
        `Could not connect to Autocount database for organization #${organizationId}: ${message}`,
        err,
      );
    }

    return pool;
  }

  private touchLru(organizationId: number): void {
    const entry = this.entries.get(organizationId);
    if (!entry) return;
    this.entries.delete(organizationId);
    this.entries.set(organizationId, entry);
  }

  private evictIfOverCapacity(): void {
    while (this.entries.size >= this.maxCachedConnections) {
      const [oldest] = this.entries.keys();
      if (oldest === undefined) break;
      this.evict(oldest, 'capacity');
    }
  }

  private sweepIdle(): void {
    const now = Date.now();
    for (const [organizationId, entry] of this.entries) {
      if (now - entry.lastUsedAt > this.idleEvictionMs) {
        this.evict(organizationId, 'idle');
      }
    }
  }

  private evict(organizationId: number, reason: string): void {
    const entry = this.entries.get(organizationId);
    if (!entry) return;
    this.entries.delete(organizationId);
    entry.poolPromise
      .then((pool) => pool.close())
      .catch(() => undefined)
      .finally(() =>
        this.logger.debug(
          `Closed Autocount pool for organization #${organizationId} (${reason})`,
        ),
      );
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.sweepHandle);
    const closes = [...this.entries.values()].map((entry) =>
      entry.poolPromise.then((pool) => pool.close()).catch(() => undefined),
    );
    this.entries.clear();
    await Promise.all(closes);
  }
}
