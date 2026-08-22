import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Grants a `staff` user visibility into one organization. Deliberately has no role
 * column — role is a single global attribute on the user, never per-organization.
 * `admin` users bypass this table entirely (see OrgAccessGuard).
 */
@Entity('organization_access')
export class OrganizationAccess {
  @PrimaryColumn({ name: 'user_id', type: 'int' })
  userId: number;

  @PrimaryColumn({ name: 'organization_id', type: 'int' })
  organizationId: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
