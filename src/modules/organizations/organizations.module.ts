import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationAccess } from './entities/organization-access.entity';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationAccessService } from './organization-access.service';
import { OrganizationAutocountSettingsController } from './organization-autocount-settings.controller';
import { OrgAccessGuard } from './guards/org-access.guard';
import { APP_DB_CONNECTION } from '../../config/database.tokens';
import { OrganizationAutocountCredentialsModule } from './organization-autocount-credentials.module';
import { AutocountConnectionsModule } from '../autocount-connections/autocount-connections.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Organization, OrganizationAccess],
      APP_DB_CONNECTION,
    ),
    OrganizationAutocountCredentialsModule,
    AutocountConnectionsModule,
  ],
  controllers: [
    OrganizationsController,
    OrganizationAutocountSettingsController,
  ],
  providers: [OrganizationsService, OrganizationAccessService, OrgAccessGuard],
  exports: [OrganizationsService, OrganizationAccessService, OrgAccessGuard],
})
export class OrganizationsModule {}
