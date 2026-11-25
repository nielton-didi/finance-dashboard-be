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
import { CashFlowService } from './cash-flow.service';
import {
  CashFlowQueryDto,
  CashFlowTransactionsQueryDto,
} from './dto/cash-flow-query.dto';

@Controller('organizations/:orgId/cash-flow')
@RequirePermissions(Permission.ReportView)
@UseGuards(OrgAccessGuard)
export class CashFlowController {
  constructor(private readonly cashFlowService: CashFlowService) {}

  @Get()
  getStatement(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query() query: CashFlowQueryDto,
  ) {
    return this.cashFlowService.getStatement(orgId, query);
  }

  @Get('transactions')
  getTransactions(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query() query: CashFlowTransactionsQueryDto,
  ) {
    return this.cashFlowService.getTransactions(orgId, query);
  }
}
