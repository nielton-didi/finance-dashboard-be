import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProfitLossRangeDto } from '../../profit-loss/dto/profit-loss-query.dto';

export class CashFlowQueryDto extends ProfitLossRangeDto {
  @IsOptional()
  @IsIn(['none', 'prior_year'])
  compareTo?: 'none' | 'prior_year';
}

export class CashFlowTransactionsQueryDto extends ProfitLossRangeDto {
  @IsString()
  @MaxLength(24)
  accountNo: string;
}
