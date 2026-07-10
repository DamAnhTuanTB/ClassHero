import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "#api/common/auth/authenticated-request";
import { throwUnauthorized } from "#api/common/errors/api-exception";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throwUnauthorized("UNAUTHORIZED", "Bạn cần đăng nhập để thực hiện thao tác này");
    }

    return request.user;
  },
);
