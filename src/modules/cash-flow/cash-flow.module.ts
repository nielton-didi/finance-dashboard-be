import { Module } from '@nestjs/common';
import { AutocountConnectionsModule } from '../autocount-connections/autocount-connections.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CashFlowController } from './cash-flow.controller';
import { CashFlowService } from './cash-flow.service';

@Module({
  imports: [AutocountConnectionsModule, OrganizationsModule],
  controllers: [CashFlowController],
  providers: [CashFlowService],
})
export class CashFlowModule {}
