import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  ValidateNested,
} from "class-validator";
import { AiChatScopeType } from "@prisma/client";
import {
  ADMIN_AI_CHAT_SIMULATION_SURFACES,
  type AdminAiChatSimulationSurface,
} from "#api/modules/ai-chat/types/ai-chat.types";
import {
  AI_CHAT_ACTIVITY_STATES,
  type AiChatActivityState,
} from "#api/modules/ai-chat/utils/ai-chat-activity-policy";

const ADMIN_AI_CHAT_TARGET_TYPES = [
  "QUIZ_QUESTION",
  "FLASHCARD",
  "TEST_QUESTION",
] as const;

class AdminAiChatSimulationContextDto {
  @IsOptional()
  @IsUUID()
  surfaceLessonId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(604_800)
  videoPlaybackSeconds?: number;

  @IsOptional()
  @IsIn(ADMIN_AI_CHAT_SIMULATION_SURFACES)
  simulationSurface?: AdminAiChatSimulationSurface;

  @IsOptional()
  @IsIn(AI_CHAT_ACTIVITY_STATES)
  activityState?: AiChatActivityState;

  @IsOptional()
  @IsIn(ADMIN_AI_CHAT_TARGET_TYPES)
  targetType?: (typeof ADMIN_AI_CHAT_TARGET_TYPES)[number];

  @IsOptional()
  @IsUUID()
  targetId?: string;
}

export class AdminAiChatConfigurationOverrideDto {
  @IsOptional()
  @IsUUID()
  primaryCatalogItemId?: string;

  @IsOptional()
  @IsUUID()
  fallbackCatalogItemId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(2)
  temperature?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  reasoningEffort?: string | null;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(2_000_000)
  maxInputTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(100_000)
  maxOutputTokens?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(2)
  fallbackTemperature?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  fallbackReasoningEffort?: string | null;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(100_000)
  fallbackMaxOutputTokens?: number | null;
}

export class CreateAdminAiChatMessageDto extends AdminAiChatSimulationContextDto {
  @IsEnum(AiChatScopeType)
  scopeType!: AiChatScopeType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  learningPathIds: string[] = [];

  @ValidateIf(
    (dto: CreateAdminAiChatMessageDto) => dto.scopeType === AiChatScopeType.LESSON,
  )
  @IsUUID()
  lessonId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  attachmentFileIds: string[] = [];

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminAiChatConfigurationOverrideDto)
  configurationOverride?: AdminAiChatConfigurationOverrideDto;
}

export class ContinueAdminAiChatMessageDto extends AdminAiChatSimulationContextDto {
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

export class UpdateAdminAiChatSessionConfigurationDto {
  @ValidateIf(
    (dto: UpdateAdminAiChatSessionConfigurationDto) => dto.configurationOverride !== null,
  )
  @ValidateNested()
  @Type(() => AdminAiChatConfigurationOverrideDto)
  configurationOverride!: AdminAiChatConfigurationOverrideDto | null;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ListAdminAiChatSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class ListAdminAiChatMessagesQueryDto {
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

export class AdminAiChatScopeOptionsQueryDto {
  @IsOptional()
  @IsUUID()
  learningPathId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
