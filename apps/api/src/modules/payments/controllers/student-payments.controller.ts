import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { MockPurchaseDto } from "#api/modules/payments/dto/mock-purchase.dto";
import { MockPaymentsService } from "#api/modules/payments/services/mock-payments.service";

@ApiTags("student-payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller("student/payments")
export class StudentPaymentsController {
  constructor(
    @Inject(MockPaymentsService)
    private readonly mockPaymentsService: MockPaymentsService,
  ) {}

  @Post("mock-success")
  @ApiOperation({ summary: "Mock successful buy-now payment for a student" })
  mockSuccess(@CurrentUser() user: AuthenticatedUser, @Body() dto: MockPurchaseDto) {
    return this.mockPaymentsService.purchaseForStudent(user.id, dto);
  }
}
