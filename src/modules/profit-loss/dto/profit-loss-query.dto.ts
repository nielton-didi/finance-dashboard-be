import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PNL_ACC_TYPES } from '../profit-loss-statement.builder';
import type { PnlAccType } from '../profit-loss-statement.builder';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Dimension filters shared by every P&L endpoint (AutoCount Project / Dept). */
export class ProfitLossDimensionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  projectNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  deptNo?: string;
}

export class ProfitLossRangeDto extends ProfitLossDimensionsDto {
  @IsDateString({ strict: true })
  @Matches(ISO_DATE, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate: string;

  @IsDateString({ strict: true })
  @Matches(ISO_DATE, { message: 'toDate must be YYYY-MM-DD' })
  toDate: string;
}

export const COMPARE_TO = ['none', 'prior_year', 'budget'] as const;
export type CompareTo = (typeof COMPARE_TO)[number];

export class ProfitLossQueryDto extends ProfitLossRangeDto {
  @IsOptional()
  @IsIn(COMPARE_TO)
  compareTo?: CompareTo;

  /** AutoCount Budget.BudgetKey — a bigint, so kept as a string of digits. */
  @ValidateIf((dto: ProfitLossQueryDto) => dto.compareTo === 'budget')
  @Matches(/^\d{1,18}$/, {
    message: 'budgetKey is required when compareTo is budget',
  })
  budgetKey?: string;
}

export const BREAKDOWN_INTERVALS = ['monthly', 'quarterly'] as const;
export type BreakdownInterval = (typeof BREAKDOWN_INTERVALS)[number];

export class ProfitLossBreakdownQueryDto extends ProfitLossRangeDto {
  @IsIn(BREAKDOWN_INTERVALS)
  interval: BreakdownInterval;
}

export class ProfitLossTrendQueryDto extends ProfitLossDimensionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year: number;
}

export class ProfitLossTransactionsQueryDto extends ProfitLossRangeDto {
  /** Exactly one of accountNo / accType is required (enforced in the service). */
  @IsOptional()
  @IsString()
  @MaxLength(24)
  accountNo?: string;

  @IsOptional()
  @IsIn(PNL_ACC_TYPES)
  accType?: PnlAccType;
}
