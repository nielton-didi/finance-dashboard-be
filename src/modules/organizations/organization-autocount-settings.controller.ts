import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { OrganizationAutocountCredentialsService } from './organization-autocount-credentials.service';
import { UpsertAutocountCredentialDto } from './dto/upsert-autocount-credential.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/role';
import { AutocountConnectionManagerService } from '../autocount-connections/autocount-connection-manager.service';

@Controller('organizations/:orgId/settings/database')
@RequirePermissions(Permission.OrganizationManage)
export class OrganizationAutocountSettingsController {
  constructor(
    private readonly credentialsService: OrganizationAutocountCredentialsService,
    private readonly connectionManager: AutocountConnectionManagerService,
  ) {}

  @Get()
  get(@Param('orgId', ParseIntPipe) orgId: number) {
    return this.credentialsService.getMasked(orgId);
  }

  @Put()
  async put(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() dto: UpsertAutocountCredentialDto,
  ) {
    const result = await this.credentialsService.upsert(orgId, dto);
    // Force the next request for this org to reconnect with the new credentials
    // instead of reusing a pool opened under the old ones.
    this.connectionManager.invalidate(orgId);
    return result;
  }

  @Post('test-connection')
  @HttpCode(200)
  async testConnection(@Param('orgId', ParseIntPipe) orgId: number) {
    this.connectionManager.invalidate(orgId);
    await this.connectionManager.getConnection(orgId);
    return { ok: true };
  }
}
