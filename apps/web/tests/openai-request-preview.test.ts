import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error -- Node's native TypeScript runner requires the explicit extension.
import { replaceOpenAiRequestPrompts } from "../features/admin/ai-generation/utils/openai-request-preview.ts";

test("keeps an explicit-cache system prompt only in the developer message", () => {
  const request = replaceOpenAiRequestPrompts(
    {
      model: "gpt-5.6-luna",
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: "SYSTEM OLD",
              prompt_cache_breakpoint: { mode: "explicit" },
            },
          ],
        },
        {
          role: "user",
          content: [
            { type: "input_file", file_id: "file-1" },
            { type: "input_text", text: "MANIFEST" },
            { type: "input_text", text: "USER OLD" },
          ],
        },
      ],
      prompt_cache_options: { mode: "explicit", ttl: "30m" },
    },
    {
      previewSystemPrompt: "SYSTEM OLD",
      previewUserPrompt: "USER OLD",
      systemPrompt: "SYSTEM NEW",
      userPrompt: "USER NEW",
    },
  );

  assert.equal(Object.hasOwn(request, "instructions"), false);
  assert.equal(countOccurrences(JSON.stringify(request), "SYSTEM NEW"), 1);
  assert.equal(countOccurrences(JSON.stringify(request), "USER NEW"), 1);
  assert.equal(JSON.stringify(request).includes("SYSTEM OLD"), false);
  assert.equal(JSON.stringify(request).includes("USER OLD"), false);
  assert.equal(JSON.stringify(request).includes("MANIFEST"), true);
});

test("updates legacy instructions without introducing a developer message", () => {
  const request = replaceOpenAiRequestPrompts(
    {
      model: "gpt-5.4-mini",
      instructions: "SYSTEM OLD",
      input: "USER OLD",
    },
    {
      previewSystemPrompt: "SYSTEM OLD",
      previewUserPrompt: "USER OLD",
      systemPrompt: "SYSTEM NEW",
      userPrompt: "USER NEW",
    },
  );

  assert.equal(request.instructions, "SYSTEM NEW");
  assert.equal(request.input, "USER NEW");
  assert.equal(countOccurrences(JSON.stringify(request), "SYSTEM NEW"), 1);
});

test("does not replace unrelated empty text items when the preview user prompt is empty", () => {
  const request = replaceOpenAiRequestPrompts(
    {
      instructions: "SYSTEM",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "" },
            { id: "user_prompt", type: "input_text", text: "" },
          ],
        },
      ],
    },
    {
      previewSystemPrompt: "SYSTEM",
      previewUserPrompt: "",
      systemPrompt: "SYSTEM",
      userPrompt: "USER NEW",
    },
  );

  const content = (
    request.input as Array<{ content: Array<{ id?: string; text: string }> }>
  )[0]?.content;
  assert.equal(content?.[0]?.text, "");
  assert.equal(content?.[1]?.text, "USER NEW");
});

function countOccurrences(value: string, search: string) {
  return value.split(search).length - 1;
}
