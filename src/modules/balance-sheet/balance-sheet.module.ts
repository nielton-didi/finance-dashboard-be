import { Module } from '@nestjs/common';
import { AutocountConnectionsModule } from '../autocount-connections/autocount-connections.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BalanceSheetController } from './balance-sheet.controller';
import { BalanceSheetService } from './balance-sheet.service';

@Module({
  imports: [AutocountConnectionsModule, OrganizationsModule],
  controllers: [BalanceSheetController],
  providers: [BalanceSheetService],
})
export class BalanceSheetModule {}
