import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import {
  type AiChatStreamingResponse,
  writeAiChatStream,
} from "#api/modules/ai-chat/controllers/ai-chat-stream-response";
import {
  AdminAiChatScopeOptionsQueryDto,
  ContinueAdminAiChatMessageDto,
  CreateAdminAiChatMessageDto,
  ListAdminAiChatMessagesQueryDto,
  ListAdminAiChatSessionsQueryDto,
  UpdateAdminAiChatSessionConfigurationDto,
} from "#api/modules/ai-chat/dto/admin-ai-chat.dto";
import { RenameAiChatConversationDto } from "#api/modules/ai-chat/dto/ai-chat.dto";
import { AdminAiChatAccessService } from "#api/modules/ai-chat/services/admin-ai-chat-access.service";
import { AiChatService } from "#api/modules/ai-chat/services/ai-chat.service";

@ApiTags("admin-ai-chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/ai-chat")
export class AdminAiChatController {
  constructor(
    @Inject(AiChatService) private readonly chat: AiChatService,
    @Inject(AdminAiChatAccessService)
    private readonly access: AdminAiChatAccessService,
  ) {}

  @Get("scope-options")
  scopeOptions(@Query() query: AdminAiChatScopeOptionsQueryDto) {
    return this.access.listScopeOptions(query);
  }

  @Get("lessons/:lessonId/context-options")
  lessonContextOptions(@Param("lessonId") lessonId: string) {
    return this.access.listLessonSimulationContext(lessonId);
  }

  @Get("sessions")
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminAiChatSessionsQueryDto,
  ) {
    return this.chat.listAdminSessions(user.id, query);
  }

  @Get("sessions/:sessionId")
  get(@CurrentUser() user: AuthenticatedUser, @Param("sessionId") sessionId: string) {
    return this.chat.getAdminSession(user.id, sessionId);
  }

  @Get("sessions/:sessionId/messages")
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Query() query: ListAdminAiChatMessagesQueryDto,
  ) {
    return this.chat.listAdminMessages(user.id, sessionId, query);
  }

  @Get("sessions/:sessionId/messages/:assistantMessageId/trace")
  trace(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Param("assistantMessageId") assistantMessageId: string,
  ) {
    return this.chat.getAdminTurnTrace(user.id, sessionId, assistantMessageId);
  }

  @Patch("sessions/:sessionId/configuration")
  configuration(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: UpdateAdminAiChatSessionConfigurationDto,
  ) {
    return this.chat.updateAdminSessionConfiguration(user.id, sessionId, dto);
  }

  @Patch("sessions/:sessionId")
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: RenameAiChatConversationDto,
  ) {
    return this.chat.renameAdminSession(user.id, sessionId, dto);
  }

  @Delete("sessions/:sessionId")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("sessionId") sessionId: string) {
    return this.chat.deleteAdminSession(user.id, sessionId);
  }

  @Post("sessions/messages/stream")
  @ApiOperation({ summary: "Create an Admin simulation and stream the shared chat" })
  async createAndStream(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdminAiChatMessageDto,
    @Res() response: AiChatStreamingResponse,
  ) {
    const turn = await this.chat.prepareAdminTurn(user.id, dto);
    await writeAiChatStream(response, this.chat.streamTurn(turn));
  }

  @Post("sessions/:sessionId/messages/stream")
  @ApiOperation({ summary: "Continue an Admin simulation through shared chat" })
  async continueAndStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("sessionId") sessionId: string,
    @Body() dto: ContinueAdminAiChatMessageDto,
    @Res() response: AiChatStreamingResponse,
  ) {
    const turn = await this.chat.prepareAdminTurn(user.id, dto, sessionId);
    await writeAiChatStream(response, this.chat.streamTurn(turn));
  }
}
