import { IsDateString, Matches } from 'class-validator';

export class DashboardQueryDto {
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'asOfDate must be YYYY-MM-DD' })
  asOfDate: string;
}
