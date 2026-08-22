export enum Role {
  Admin = 'admin',
  Staff = 'staff',
}

export enum Permission {
  ReportView = 'report:view',
  OrganizationManage = 'organization:manage',
  UserManage = 'user:manage',
}

/**
 * Permissions are attached to roles, never to individual users — every user with a
 * given role has exactly the same permissions as every other user with that role.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.Admin]: [
    Permission.ReportView,
    Permission.OrganizationManage,
    Permission.UserManage,
  ],
  [Role.Staff]: [Permission.ReportView],
};
