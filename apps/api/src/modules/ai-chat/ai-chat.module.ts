import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { StudentAiChatController } from "#api/modules/ai-chat/controllers/student-ai-chat.controller";
import { AdminAiChatController } from "#api/modules/ai-chat/controllers/admin-ai-chat.controller";
import { AdminAiChatAccessService } from "#api/modules/ai-chat/services/admin-ai-chat-access.service";
import { AiChatAccessService } from "#api/modules/ai-chat/services/ai-chat-access.service";
import { AiChatAttachmentService } from "#api/modules/ai-chat/services/ai-chat-attachment.service";
import { AiChatPolicyService } from "#api/modules/ai-chat/services/ai-chat-policy.service";
import { AiChatPromptService } from "#api/modules/ai-chat/services/ai-chat-prompt.service";
import { AiChatRetrievalService } from "#api/modules/ai-chat/services/ai-chat-retrieval.service";
import { AiChatScopeManifestService } from "#api/modules/ai-chat/services/ai-chat-scope-manifest.service";
import { AiChatService } from "#api/modules/ai-chat/services/ai-chat.service";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";

@Module({
  imports: [AuthModule, FilesModule, JwtModule.register({}), PrismaModule],
  controllers: [StudentAiChatController, AdminAiChatController],
  providers: [
    AiChatAccessService,
    AdminAiChatAccessService,
    AiChatAttachmentService,
    AiChatPolicyService,
    AiChatPromptService,
    AiChatRetrievalService,
    AiChatScopeManifestService,
    AiChatService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AiChatModule {}
