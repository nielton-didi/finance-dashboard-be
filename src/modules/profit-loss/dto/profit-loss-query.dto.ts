import { IsDateString } from 'class-validator';

export class ProfitLossQueryDto {
  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;
}
