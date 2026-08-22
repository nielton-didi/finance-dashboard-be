import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OrgAccessGuard } from './org-access.guard';
import { OrganizationAccessService } from '../organization-access.service';
import { Role } from '../../../common/auth/role';

function contextFor(
  user: { sub: number; role: Role } | undefined,
  orgId: string,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { orgId } }),
    }),
  } as unknown as ExecutionContext;
}

describe('OrgAccessGuard', () => {
  it('always allows admin, without checking the access table', async () => {
    const hasAccess = jest.fn();
    const guard = new OrgAccessGuard({
      hasAccess,
    } as unknown as OrganizationAccessService);

    const result = await guard.canActivate(
      contextFor({ sub: 1, role: Role.Admin }, '42'),
    );

    expect(result).toBe(true);
    expect(hasAccess).not.toHaveBeenCalled();
  });

  it('allows staff with a granted access row', async () => {
    const hasAccess = jest.fn().mockResolvedValue(true);
    const guard = new OrgAccessGuard({
      hasAccess,
    } as unknown as OrganizationAccessService);

    const result = await guard.canActivate(
      contextFor({ sub: 2, role: Role.Staff }, '42'),
    );

    expect(result).toBe(true);
    expect(hasAccess).toHaveBeenCalledWith(2, 42);
  });

  it('rejects staff without a granted access row', async () => {
    const hasAccess = jest.fn().mockResolvedValue(false);
    const guard = new OrgAccessGuard({
      hasAccess,
    } as unknown as OrganizationAccessService);

    await expect(
      guard.canActivate(contextFor({ sub: 2, role: Role.Staff }, '42')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects when there is no authenticated user', async () => {
    const hasAccess = jest.fn();
    const guard = new OrgAccessGuard({
      hasAccess,
    } as unknown as OrganizationAccessService);

    const result = await guard.canActivate(contextFor(undefined, '42'));
    expect(result).toBe(false);
  });
});
