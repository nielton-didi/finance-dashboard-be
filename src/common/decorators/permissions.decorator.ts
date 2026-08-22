import { SetMetadata } from '@nestjs/common';
import { Permission } from '../auth/role';

export const PERMISSIONS_KEY = 'permissions';

/** Requires the caller's role to grant ALL of the listed permissions (see ROLE_PERMISSIONS). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
