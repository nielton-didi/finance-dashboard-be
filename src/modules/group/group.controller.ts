import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '../../common/auth/role';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import {
  GroupConsolidatedQueryDto,
  GroupOverviewQueryDto,
} from './dto/group-query.dto';
import { GroupService } from './group.service';

/** Not scoped to one organization: the service only reads those the user may see. */
@Controller('group')
@RequirePermissions(Permission.ReportView)
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Get('overview')
  getOverview(
    @CurrentUser() user: JwtPayload,
    @Query() query: GroupOverviewQueryDto,
  ) {
    return this.groupService.getOverview(user, query);
  }

  @Get('consolidated')
  getConsolidated(
    @CurrentUser() user: JwtPayload,
    @Query() query: GroupConsolidatedQueryDto,
  ) {
    return this.groupService.getConsolidated(user, query);
  }
}
