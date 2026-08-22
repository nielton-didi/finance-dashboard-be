import { IsInt } from 'class-validator';

export class GrantOrganizationAccessDto {
  @IsInt()
  organizationId: number;
}
