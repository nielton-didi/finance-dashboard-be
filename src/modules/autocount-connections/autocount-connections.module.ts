import { Module } from '@nestjs/common';
import { AutocountConnectionManagerService } from './autocount-connection-manager.service';
import { OrganizationAutocountCredentialsModule } from '../organizations/organization-autocount-credentials.module';

@Module({
  imports: [OrganizationAutocountCredentialsModule],
  providers: [AutocountConnectionManagerService],
  exports: [AutocountConnectionManagerService],
})
export class AutocountConnectionsModule {}
