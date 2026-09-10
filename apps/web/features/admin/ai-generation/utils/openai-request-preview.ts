type OpenAiRequestPromptValues = {
  previewSystemPrompt: string;
  previewUserPrompt: string;
  systemPrompt: string;
  userPrompt: string;
};

/**
 * Updates editable prompts without changing the provider transport shape.
 * Explicit-cache requests keep the system prompt in the developer message,
 * while legacy requests keep it in `instructions`.
 */
export function replaceOpenAiRequestPrompts<TRequest extends Record<string, unknown>>(
  request: TRequest,
  prompts: OpenAiRequestPromptValues,
): TRequest {
  const displayedRequest: Record<string, unknown> = { ...request };

  if (Object.hasOwn(request, "instructions")) {
    displayedRequest.instructions = prompts.systemPrompt;
  }
  if (Object.hasOwn(request, "input")) {
    displayedRequest.input = replaceInputPrompts(request.input, prompts);
  }

  return displayedRequest as TRequest;
}

function replaceInputPrompts(
  input: unknown,
  prompts: OpenAiRequestPromptValues,
): unknown {
  if (typeof input === "string") {
    if (!prompts.previewUserPrompt) return prompts.userPrompt;
    const promptIndex = input.indexOf(prompts.previewUserPrompt);
    if (promptIndex < 0) return input;
    return `${input.slice(0, promptIndex)}${prompts.userPrompt}${input.slice(promptIndex + prompts.previewUserPrompt.length)}`;
  }
  if (!Array.isArray(input)) return input;

  return input.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return message;
    }
    const record = message as Record<string, unknown>;
    if (!Array.isArray(record.content)) return message;
    const isDeveloperMessage = record.role === "developer";

    return {
      ...record,
      content: record.content.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const content = item as Record<string, unknown>;
        if (content.type !== "input_text") return item;

        if (isDeveloperMessage && content.text === prompts.previewSystemPrompt) {
          return { ...content, text: prompts.systemPrompt };
        }
        if (
          !isDeveloperMessage &&
          (content.id === "user_prompt" ||
            (prompts.previewUserPrompt.length > 0 &&
              content.text === prompts.previewUserPrompt))
        ) {
          return { ...content, text: prompts.userPrompt };
        }
        return item;
      }),
    };
  });
}
