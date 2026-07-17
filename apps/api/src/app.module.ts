import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "#api/app.controller";
import { AppService } from "#api/app.service";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { validateEnv } from "#api/config/env.validation";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { PaymentsModule } from "#api/modules/payments/payments.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "apps/api/.env", "../../.env"],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    FilesModule,
    JobsModule,
    LearningPathsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
