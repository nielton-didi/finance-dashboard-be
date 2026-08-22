import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProfitLossService } from './profit-loss.service';
import { ProfitLossQueryDto } from './dto/profit-loss-query.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/role';
import { OrgAccessGuard } from '../organizations/guards/org-access.guard';

@Controller('organizations/:orgId/profit-loss')
@RequirePermissions(Permission.ReportView)
@UseGuards(OrgAccessGuard)
export class ProfitLossController {
  constructor(private readonly profitLossService: ProfitLossService) {}

  @Get()
  getStatement(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query() query: ProfitLossQueryDto,
  ) {
    return this.profitLossService.getStatement(orgId, query);
  }
}
