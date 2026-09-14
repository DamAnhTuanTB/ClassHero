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
  ListAiChatConversationsQueryDto,
  ListAiChatMessagesQueryDto,
  RenameAiChatConversationDto,
  SendAiChatMessageDto,
} from "#api/modules/ai-chat/dto/ai-chat.dto";
import { AiChatService } from "#api/modules/ai-chat/services/ai-chat.service";
import {
  type AiChatStreamingResponse,
  writeAiChatStream,
} from "#api/modules/ai-chat/controllers/ai-chat-stream-response";

@ApiTags("student-ai-chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller("student/ai-chat")
export class StudentAiChatController {
  constructor(@Inject(AiChatService) private readonly chat: AiChatService) {}

  @Get("settings")
  @ApiOperation({ summary: "Get the effective student AI chat limits" })
  settings(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.getRuntimeSettings(user.id);
  }

  @Get("conversations")
  @ApiOperation({ summary: "List the student's unified AI chat history" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAiChatConversationsQueryDto,
  ) {
    return this.chat.listConversations(user.id, query);
  }

  @Get("conversations/:conversationId")
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.chat.getConversation(user.id, conversationId);
  }

  @Get("conversations/:conversationId/messages")
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Query() query: ListAiChatMessagesQueryDto,
  ) {
    return this.chat.listMessages(user.id, conversationId, query);
  }

  @Patch("conversations/:conversationId")
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: RenameAiChatConversationDto,
  ) {
    return this.chat.renameConversation(user.id, conversationId, dto);
  }

  @Delete("conversations/:conversationId")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
  ) {
    return this.chat.deleteConversation(user.id, conversationId);
  }

  @Post("conversations/messages/stream")
  @ApiOperation({ summary: "Create an AI conversation and stream its first answer" })
  async createAndStream(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendAiChatMessageDto,
    @Res() response: AiChatStreamingResponse,
  ) {
    const turn = await this.chat.prepareTurn(user.id, dto);
    await writeAiChatStream(response, this.chat.streamTurn(turn));
  }

  @Post("conversations/:conversationId/messages/stream")
  @ApiOperation({ summary: "Continue an AI conversation and stream the answer" })
  async continueAndStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: SendAiChatMessageDto,
    @Res() response: AiChatStreamingResponse,
  ) {
    const turn = await this.chat.prepareTurn(user.id, dto, conversationId);
    await writeAiChatStream(response, this.chat.streamTurn(turn));
  }
}
