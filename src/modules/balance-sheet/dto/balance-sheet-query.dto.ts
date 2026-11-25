import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ProfitLossDimensionsDto } from '../../profit-loss/dto/profit-loss-query.dto';

export class BalanceSheetAsOfDto extends ProfitLossDimensionsDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'asOfDate must be YYYY-MM-DD' })
  asOfDate: string;
}

export class BalanceSheetQueryDto extends BalanceSheetAsOfDto {
  @IsOptional()
  @IsIn(['none', 'prior_year'])
  compareTo?: 'none' | 'prior_year';
}

export class BalanceSheetTransactionsQueryDto extends BalanceSheetAsOfDto {
  @IsString()
  @MaxLength(24)
  accountNo: string;
}
