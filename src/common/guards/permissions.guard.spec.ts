import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission, Role } from '../auth/role';

function contextWithUser(
  role: Role | undefined,
  reflectorReturn: Permission[] | undefined,
): { context: ExecutionContext; reflector: Reflector } {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(reflectorReturn),
  } as unknown as Reflector;

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { sub: 1, role } : undefined }),
    }),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('PermissionsGuard', () => {
  it('allows the request when no permissions are required', () => {
    const { context, reflector } = contextWithUser(Role.Staff, undefined);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows staff to view reports', () => {
    const { context, reflector } = contextWithUser(Role.Staff, [
      Permission.ReportView,
    ]);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies staff from managing organizations', () => {
    const { context, reflector } = contextWithUser(Role.Staff, [
      Permission.OrganizationManage,
    ]);
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows admin everything', () => {
    const { context, reflector } = contextWithUser(Role.Admin, [
      Permission.OrganizationManage,
      Permission.UserManage,
      Permission.ReportView,
    ]);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies when there is no authenticated user', () => {
    const { context, reflector } = contextWithUser(undefined, [
      Permission.ReportView,
    ]);
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(context)).toBe(false);
  });
});
