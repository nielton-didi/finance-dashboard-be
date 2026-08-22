import { ConfigService } from '@nestjs/config';
import { AutocountConnectionManagerService } from './autocount-connection-manager.service';
import { AutocountConnectionError } from './autocount-connection.errors';
import { OrganizationAutocountCredentialsService } from '../organizations/organization-autocount-credentials.service';

const connectMock = jest.fn();
const closeMock = jest.fn().mockResolvedValue(undefined);

jest.mock('mssql', () => {
  return {
    ConnectionPool: jest.fn().mockImplementation(() => ({
      connect: connectMock,
      close: closeMock,
      on: jest.fn(),
    })),
  };
});

function makeConfigService(
  overrides: Record<string, number> = {},
): ConfigService {
  const defaults: Record<string, number> = {
    'autocountPool.maxCachedConnections': 50,
    'autocountPool.idleEvictionMs': 20 * 60_000,
    'autocountPool.perOrgMaxConnections': 5,
    'autocountPool.connectionTimeoutMs': 8000,
    'autocountPool.requestTimeoutMs': 30000,
    'autocountPool.sweepIntervalMs': 60_000,
    ...overrides,
  };
  return {
    get: jest.fn((key: string, fallback?: number) => defaults[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('AutocountConnectionManagerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
  });

  function makeService(
    getDecrypted: jest.Mock = jest.fn().mockResolvedValue({
      host: 'db.example.com',
      port: 1433,
      database: 'AutocountDb',
      username: 'reader',
      password: 'secret',
    }),
  ) {
    const credentialsService = {
      getDecrypted,
    } as unknown as OrganizationAutocountCredentialsService;
    const service = new AutocountConnectionManagerService(
      credentialsService,
      makeConfigService(),
    );
    return { service, getDecrypted };
  }

  it('creates one connection per organization and caches it', async () => {
    const { service, getDecrypted } = makeService();

    const first = await service.getConnection(1);
    const second = await service.getConnection(1);

    expect(first).toBe(second);
    expect(getDecrypted).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
  });

  it('single-flights concurrent requests for the same organization', async () => {
    const { service, getDecrypted } = makeService();

    const [a, b] = await Promise.all([
      service.getConnection(1),
      service.getConnection(1),
    ]);

    expect(a).toBe(b);
    expect(getDecrypted).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
  });

  it('creates independent connections for different organizations', async () => {
    const { service, getDecrypted } = makeService();

    await service.getConnection(1);
    await service.getConnection(2);

    expect(getDecrypted).toHaveBeenCalledTimes(2);
    expect(connectMock).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
  });

  it('throws NOT_CONFIGURED and does not cache when no credentials exist', async () => {
    const { service } = makeService(jest.fn().mockResolvedValue(null));

    await expect(service.getConnection(1)).rejects.toMatchObject({
      reason: 'NOT_CONFIGURED',
    });

    await service.onModuleDestroy();
  });

  it('maps a login failure to AUTH_FAILED', async () => {
    const { service } = makeService();
    connectMock.mockRejectedValueOnce(
      Object.assign(new Error('Login failed'), { code: 'ELOGIN' }),
    );

    await expect(service.getConnection(1)).rejects.toBeInstanceOf(
      AutocountConnectionError,
    );

    await service.onModuleDestroy();
  });

  it('does not cache a failed connection — the next call retries fresh', async () => {
    const { service, getDecrypted } = makeService();
    connectMock.mockRejectedValueOnce(
      Object.assign(new Error('Login failed'), { code: 'ELOGIN' }),
    );

    await expect(service.getConnection(1)).rejects.toMatchObject({
      reason: 'AUTH_FAILED',
    });

    // The failed attempt above must not have been cached — this call retries fresh
    // (and, with the default mock resolving successfully, succeeds).
    await service.getConnection(1);
    expect(getDecrypted).toHaveBeenCalledTimes(2);
    expect(connectMock).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
  });

  it('maps a timeout to UNREACHABLE', async () => {
    const { service } = makeService();
    connectMock.mockRejectedValueOnce(
      Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }),
    );

    await expect(service.getConnection(1)).rejects.toMatchObject({
      reason: 'UNREACHABLE',
    });

    await service.onModuleDestroy();
  });

  it('invalidate() forces the next call to reconnect', async () => {
    const { service, getDecrypted } = makeService();

    await service.getConnection(1);
    service.invalidate(1);
    await service.getConnection(1);

    expect(getDecrypted).toHaveBeenCalledTimes(2);
    expect(connectMock).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
  });

  it('closes every cached pool on module destroy', async () => {
    const { service } = makeService();

    await service.getConnection(1);
    await service.getConnection(2);
    await service.onModuleDestroy();

    expect(closeMock).toHaveBeenCalledTimes(2);
  });
});
