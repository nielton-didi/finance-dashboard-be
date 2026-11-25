import { Module } from '@nestjs/common';
import { AutocountConnectionsModule } from '../autocount-connections/autocount-connections.module';
import { BalanceSheetModule } from '../balance-sheet/balance-sheet.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProfitLossModule } from '../profit-loss/profit-loss.module';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';

@Module({
  imports: [
    AutocountConnectionsModule,
    OrganizationsModule,
    ProfitLossModule,
    BalanceSheetModule,
  ],
  controllers: [GroupController],
  providers: [GroupService],
})
export class GroupModule {}
