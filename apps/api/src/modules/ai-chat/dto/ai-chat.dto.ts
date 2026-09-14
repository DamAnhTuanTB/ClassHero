import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { AiChatScopeType } from "@prisma/client";
import {
  AI_CHAT_ACTIVE_ACTIVITY_TYPES,
  type AiChatActiveActivityType,
} from "#api/modules/ai-chat/types/ai-chat.types";

export class ListAiChatConversationsQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsEnum(AiChatScopeType)
  scopeType?: AiChatScopeType;

  @IsOptional()
  @IsUUID()
  learningPathId?: string;
}

export class ListAiChatMessagesQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class SendAiChatMessageDto {
  @IsOptional()
  @IsEnum(AiChatScopeType)
  scopeType?: AiChatScopeType;

  @ValidateIf((dto: SendAiChatMessageDto) => dto.scopeType === AiChatScopeType.COURSE)
  @IsUUID()
  learningPathId?: string;

  @IsOptional()
  @IsUUID()
  surfaceLessonId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  preferredLessonIds: string[] = [];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(604_800)
  videoPlaybackSeconds?: number;

  @IsOptional()
  @IsIn(AI_CHAT_ACTIVE_ACTIVITY_TYPES)
  activityType?: AiChatActiveActivityType;

  @IsOptional()
  @IsUUID()
  activityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetType?: string;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  attachmentFileIds: string[] = [];
}

export class RenameAiChatConversationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;
}
