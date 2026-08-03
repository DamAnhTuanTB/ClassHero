import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { CreatePaymentDto } from "#api/modules/payments/dto/create-payment.dto";
import { MockPurchaseDto } from "#api/modules/payments/dto/mock-purchase.dto";
import { MockPaymentsService } from "#api/modules/payments/services/mock-payments.service";
import { StudentPaymentsService } from "#api/modules/payments/services/student-payments.service";

@ApiTags("student-payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller("student/payments")
export class StudentPaymentsController {
  constructor(
    @Inject(MockPaymentsService)
    private readonly mockPaymentsService: MockPaymentsService,
    @Inject(StudentPaymentsService)
    private readonly studentPaymentsService: StudentPaymentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a payment order via payOS for a learning path" })
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.studentPaymentsService.createPaymentOrder(user.id, dto);
  }

  @Get(":paymentId")
  @ApiOperation({ summary: "Get payment status and enrollment info" })
  getPaymentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.studentPaymentsService.getPaymentStatus(paymentId, user.id);
  }

  @Post("mock-success")
  @ApiOperation({ summary: "Mock successful buy-now payment for a student" })
  mockSuccess(@CurrentUser() user: AuthenticatedUser, @Body() dto: MockPurchaseDto) {
    return this.mockPaymentsService.purchaseForStudent(user.id, dto);
  }
}
