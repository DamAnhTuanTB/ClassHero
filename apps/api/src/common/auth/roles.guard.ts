import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { AuthenticatedRequest } from "./authenticated-request";
import { ROLES_KEY } from "./roles.decorator";

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
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Bạn cần đăng nhập để thực hiện thao tác này",
      });
    }

    if (!roles.includes(request.user.role)) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    return true;
  }
}
