import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { appDbConfig, autocountPoolConfig } from './config/database.config';
import { APP_DB_CONNECTION } from './config/database.tokens';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AutocountConnectionsModule } from './modules/autocount-connections/autocount-connections.module';
import { BalanceSheetModule } from './modules/balance-sheet/balance-sheet.module';
import { CashFlowModule } from './modules/cash-flow/cash-flow.module';
import { ProfitLossModule } from './modules/profit-loss/profit-loss.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appDbConfig, autocountPoolConfig],
      envFilePath: '.env',
    }),

    // App DB — the database we control (finance-dashboard-db)
    TypeOrmModule.forRootAsync({
      name: APP_DB_CONNECTION,
      useFactory: () => ({
        type: 'mssql',
        host: process.env.APP_DB_HOST || 'localhost',
        port: parseInt(process.env.APP_DB_PORT || '1433', 10),
        username: process.env.APP_DB_USERNAME || '',
        password: process.env.APP_DB_PASSWORD || '',
        database: process.env.APP_DB_NAME || 'finance-dashboard-db',
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
        entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
        synchronize: false,
        retryAttempts: 3,
        retryDelay: 3000,
      }),
    }),

    CommonModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AutocountConnectionsModule,
    ProfitLossModule,
    BalanceSheetModule,
    CashFlowModule,
    AuditLogModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
