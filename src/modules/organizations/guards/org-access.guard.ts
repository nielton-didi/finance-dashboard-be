import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OrganizationAccessService } from '../organization-access.service';
import type { AuthenticatedRequest } from '../../../common/auth/authenticated-request';
import { Role } from '../../../common/auth/role';

/**
 * Guards any route with an :orgId param. `admin` always passes (implicit access to
 * every organization); `staff` must have an explicit grant in organization_access.
 */
@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(private readonly accessService: OrganizationAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) return false;
    if (user.role === Role.Admin) return true;

    const orgId = Number(request.params.orgId);
    if (!Number.isFinite(orgId)) return false;

    const hasAccess = await this.accessService.hasAccess(user.sub, orgId);
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }
    return true;
  }
}
