import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthModule } from "#api/modules/auth/auth.module";
import { StudentPaymentsController } from "#api/modules/payments/controllers/student-payments.controller";
import { WebhookPaymentsController } from "#api/modules/payments/controllers/webhook-payments.controller";
import { MockPaymentsService } from "#api/modules/payments/services/mock-payments.service";
import { PayosService } from "#api/modules/payments/services/payos.service";
import { StudentPaymentsService } from "#api/modules/payments/services/student-payments.service";
import { WebhookPaymentsService } from "#api/modules/payments/services/webhook-payments.service";

@Module({
  imports: [AuthModule, JwtModule.register({}), ConfigModule],
  controllers: [StudentPaymentsController, WebhookPaymentsController],
  providers: [
    MockPaymentsService,
    PayosService,
    StudentPaymentsService,
    WebhookPaymentsService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [PayosService],
})
export class PaymentsModule {}
