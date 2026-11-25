import { Module } from '@nestjs/common';
import { AutocountConnectionsModule } from '../autocount-connections/autocount-connections.module';
import { BalanceSheetModule } from '../balance-sheet/balance-sheet.module';
import { CashFlowModule } from '../cash-flow/cash-flow.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProfitLossModule } from '../profit-loss/profit-loss.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AutocountConnectionsModule,
    OrganizationsModule,
    ProfitLossModule,
    BalanceSheetModule,
    CashFlowModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
