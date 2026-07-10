import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./common/prisma/prisma.module";
import { validateEnv } from "./config/env.validation";
import { AuthModule } from "./modules/auth/auth.module";
import { LearningPathsModule } from "./modules/learning-paths/learning-paths.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "apps/api/.env", "../../.env"],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    LearningPathsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
