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
import { BalanceSheetService } from './balance-sheet.service';
import {
  BalanceSheetQueryDto,
  BalanceSheetTransactionsQueryDto,
} from './dto/balance-sheet-query.dto';

@Controller('organizations/:orgId/balance-sheet')
@RequirePermissions(Permission.ReportView)
@UseGuards(OrgAccessGuard)
export class BalanceSheetController {
  constructor(private readonly balanceSheetService: BalanceSheetService) {}

  @Get()
  getStatement(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query() query: BalanceSheetQueryDto,
  ) {
    return this.balanceSheetService.getStatement(orgId, query);
  }

  @Get('transactions')
  getTransactions(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query() query: BalanceSheetTransactionsQueryDto,
  ) {
    return this.balanceSheetService.getTransactions(orgId, query);
  }
}
