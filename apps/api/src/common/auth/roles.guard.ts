import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { AuthenticatedRequest } from "#api/common/auth/authenticated-request";
import { ROLES_KEY } from "#api/common/auth/roles.decorator";
import { throwForbidden, throwUnauthorized } from "#api/common/errors/api-exception";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throwUnauthorized("UNAUTHORIZED", "Bạn cần đăng nhập để thực hiện thao tác này");
    }

    if (!roles.includes(request.user.role)) {
      throwForbidden("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này");
    }

    return true;
  }
}
