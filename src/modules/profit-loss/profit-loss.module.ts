import { Module } from '@nestjs/common';
import { ProfitLossController } from './profit-loss.controller';
import { ProfitLossService } from './profit-loss.service';
import { AutocountConnectionsModule } from '../autocount-connections/autocount-connections.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [AutocountConnectionsModule, OrganizationsModule],
  controllers: [ProfitLossController],
  providers: [ProfitLossService],
  exports: [ProfitLossService],
})
export class ProfitLossModule {}
