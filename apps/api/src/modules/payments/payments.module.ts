import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthModule } from "#api/modules/auth/auth.module";
import { StudentPaymentsController } from "#api/modules/payments/controllers/student-payments.controller";
import { MockPaymentsService } from "#api/modules/payments/services/mock-payments.service";

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [StudentPaymentsController],
  providers: [MockPaymentsService, JwtAuthGuard, RolesGuard],
})
export class PaymentsModule {}
