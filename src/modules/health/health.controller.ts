import { Controller, Get, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { APP_DB_CONNECTION } from '../../config/database.tokens';
import { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';
import { Public } from '../../common/decorators/public.decorator';

interface DbStatus {
  connected: boolean;
  error: string | null;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  appDb: DbStatus;
  autocountDb?: DbStatus;
  timestamp: string;
}

async function checkAppDb(dataSource: DataSource): Promise<DbStatus> {
  try {
    if (!dataSource.isInitialized) {
      return { connected: false, error: 'DataSource not initialized' };
    }
    await dataSource.query('SELECT 1');
    return { connected: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { connected: false, error: message };
  }
}

@Controller()
export class HealthController {
  constructor(
    @InjectDataSource(APP_DB_CONNECTION)
    private readonly appDataSource: DataSource,
    private readonly autocountConnections: AutocountConnectionManagerService,
  ) {}

  @Public()
  @Get('health')
  async check(@Query('orgId') orgId?: string): Promise<HealthResponse> {
    const appDb = await checkAppDb(this.appDataSource);

    let autocountDb: DbStatus | undefined;
    if (orgId) {
      try {
        await this.autocountConnections.getConnection(Number(orgId));
        autocountDb = { connected: true, error: null };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        autocountDb = { connected: false, error: message };
      }
    }

    return {
      status: appDb.connected ? 'ok' : 'degraded',
      appDb,
      autocountDb,
      timestamp: new Date().toISOString(),
    };
  }
}
