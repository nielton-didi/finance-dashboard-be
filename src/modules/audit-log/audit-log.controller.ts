import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/role';

@Controller('organizations/:orgId/audit-log')
@RequirePermissions(Permission.OrganizationManage)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(@Param('orgId', ParseIntPipe) orgId: number) {
    return this.auditLogService.findAllForOrganization(orgId);
  }
}
