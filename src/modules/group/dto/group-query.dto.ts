import { IsDateString, Matches } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class GroupOverviewQueryDto {
  @IsDateString({ strict: true })
  @Matches(ISO_DATE, { message: 'asOfDate must be YYYY-MM-DD' })
  asOfDate: string;
}

export class GroupConsolidatedQueryDto {
  @IsDateString({ strict: true })
  @Matches(ISO_DATE, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate: string;

  @IsDateString({ strict: true })
  @Matches(ISO_DATE, { message: 'toDate must be YYYY-MM-DD' })
  toDate: string;
}
