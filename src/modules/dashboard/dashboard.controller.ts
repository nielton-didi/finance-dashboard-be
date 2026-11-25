import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '../../common/auth/role';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OrgAccessGuard } from '../organizations/guards/org-access.guard';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Controller('organizations/:orgId/dashboard')
@RequirePermissions(Permission.ReportView)
@UseGuards(OrgAccessGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getDashboard(orgId, query);
  }
}
