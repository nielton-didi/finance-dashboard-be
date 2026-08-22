import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationAutocountCredential } from './entities/organization-autocount-credential.entity';
import { OrganizationAutocountCredentialsService } from './organization-autocount-credentials.service';
import { APP_DB_CONNECTION } from '../../config/database.tokens';

/**
 * Kept as its own module (separate from OrganizationsModule) so that
 * AutocountConnectionsModule can depend on just the credential lookup without
 * creating a cycle with OrganizationsModule (which itself depends on
 * AutocountConnectionsModule to invalidate cached connections after a credential update).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [OrganizationAutocountCredential],
      APP_DB_CONNECTION,
    ),
  ],
  providers: [OrganizationAutocountCredentialsService],
  exports: [OrganizationAutocountCredentialsService],
})
export class OrganizationAutocountCredentialsModule {}
