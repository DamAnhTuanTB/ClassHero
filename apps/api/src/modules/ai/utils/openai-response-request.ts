import type OpenAI from "openai";

import type { AiStructuredInput, AiTextInput } from "#api/modules/ai/types/ai-text.types";
import {
  supportsOpenAiReasoningEffort,
  supportsOpenAiTemperature,
} from "#api/modules/ai/utils/ai-openai-model-capabilities";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import {
  buildOpenAiPromptCacheFields,
  buildOpenAiTextPromptCacheFields,
} from "#api/modules/ai/utils/ai-prompt-cache";

export const OPENAI_PREVIEW_FILE_ID =
  "<file_id returned by the OpenAI Files API at runtime>";
export const OPENAI_PREVIEW_BINARY_DATA = "<binary data omitted from preview>";

export type OpenAiPreparedInputFile = {
  type: "input_file";
  file_id?: string;
  file_url?: string;
  filename?: string;
  file_data?: string;
  detail?: "low" | "high" | "auto";
};

export type OpenAiResponseInput = string | OpenAI.Responses.ResponseInput;

/**
 * Provider transport serializer shared by the real OpenAI call and request previews.
 * Provider-neutral item IDs and internal metadata deliberately stop at this boundary.
 */
export function buildOpenAiResponseInput(
  input: AiTextInput,
  inputFiles: OpenAiPreparedInputFile[] = [],
): OpenAiResponseInput {
  const text = buildAiUserPrompt(input);
  if (
    inputFiles.length === 0 &&
    !input.inputImages?.length &&
    !input.inputTextItems?.length
  ) {
    return text;
  }
  return [
    {
      role: "user",
      content: [
        ...inputFiles,
        ...(input.inputTextItems ?? []).map((item) => ({
          type: "input_text" as const,
          text: item.text,
        })),
        { type: "input_text" as const, text },
        ...(input.inputImages ?? []).map((image) => ({
          type: "input_image" as const,
          image_url: image.imageUrl,
          detail: image.detail ?? "auto",
        })),
      ],
    },
  ];
}

export function buildOpenAiStructuredResponseRequest<
  TModel extends string | null,
  TFormat,
>(input: {
  request: AiStructuredInput;
  model: TModel;
  structuredTextFormat: TFormat;
  responseInput?: OpenAiResponseInput;
}) {
  const { request, model, structuredTextFormat } = input;
  const responseInput = input.responseInput ?? buildOpenAiResponseInput(request);
  const promptCacheFields = model
    ? buildOpenAiPromptCacheFields({
        request,
        model,
        structuredTextFormat,
      })
    : {};
  const usesExplicitPromptCache =
    promptCacheFields.prompt_cache_options?.mode === "explicit";
  return {
    model,
    ...(usesExplicitPromptCache ? {} : { instructions: request.systemPrompt }),
    input: usesExplicitPromptCache
      ? buildExplicitPromptCacheInput(request.systemPrompt, responseInput)
      : responseInput,
    text: {
      format: structuredTextFormat,
    },
    ...promptCacheFields,
    ...(model !== null &&
    request.temperature !== undefined &&
    supportsOpenAiTemperature(model)
      ? { temperature: request.temperature }
      : {}),
    ...(model !== null && request.reasoningEffort && supportsOpenAiReasoningEffort(model)
      ? { reasoning: { effort: request.reasoningEffort } }
      : {}),
    ...(request.maxTokens === undefined ? {} : { max_output_tokens: request.maxTokens }),
  };
}

export function buildOpenAiTextResponseRequest(input: {
  request: AiTextInput;
  model: string;
  contractVersion: string;
  responseInput?: OpenAiResponseInput;
}) {
  const { request, model } = input;
  const responseInput = input.responseInput ?? buildOpenAiResponseInput(request);
  const promptCacheFields = buildOpenAiTextPromptCacheFields({
    request,
    model,
    contractVersion: input.contractVersion,
  });
  const usesExplicitPromptCache =
    promptCacheFields.prompt_cache_options?.mode === "explicit";
  return {
    model,
    ...(usesExplicitPromptCache ? {} : { instructions: request.systemPrompt }),
    input: usesExplicitPromptCache
      ? buildExplicitPromptCacheInput(request.systemPrompt, responseInput)
      : responseInput,
    ...promptCacheFields,
    ...(request.temperature === undefined || !supportsOpenAiTemperature(model)
      ? {}
      : { temperature: request.temperature }),
    ...(request.reasoningEffort && supportsOpenAiReasoningEffort(model)
      ? { reasoning: { effort: request.reasoningEffort } }
      : {}),
    ...(request.maxTokens === undefined ? {} : { max_output_tokens: request.maxTokens }),
  };
}

export function buildExplicitPromptCacheInput(
  systemPrompt: string,
  responseInput: OpenAiResponseInput,
): OpenAI.Responses.ResponseInput {
  const dynamicInput: OpenAI.Responses.ResponseInput =
    typeof responseInput === "string"
      ? [
          {
            role: "user",
            content: [{ type: "input_text", text: responseInput }],
          },
        ]
      : responseInput;

  return [
    {
      role: "developer",
      content: [
        {
          type: "input_text",
          text: systemPrompt,
          prompt_cache_breakpoint: { mode: "explicit" },
        },
      ],
    },
    ...dynamicInput,
  ];
}
