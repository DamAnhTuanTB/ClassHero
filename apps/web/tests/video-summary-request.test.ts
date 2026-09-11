import assert from "node:assert/strict";
import test from "node:test";

const modulePath = "../features/admin/lessons/utils/video-summary-request.ts";
const { prepareVideoSummaryPreviewRequest } = await import(modulePath);

test("dựng preview video từ cấu hình mới nhất thay vì prompt và draft tự sinh cũ", () => {
  const result = prepareVideoSummaryPreviewRequest(
    {
      style: "academic",
      styleInstructions: "Trình bày chặt chẽ",
      length: "detailed",
      targetWordCount: 900,
      extraInstructions: "Nhấn mạnh công thức",
      model: "gpt-5.6-luna",
      reasoningEffort: "high",
      maxOutputTokens: 20_000,
      systemInstructions: "system prompt tự sinh từ preview cũ",
      userPrompt: "user prompt tự sinh từ preview cũ",
      requestDraftId: "draft-cũ",
      requestHash: "hash-cũ",
    },
    { preserveSystemPrompt: false, preserveUserPrompt: false },
  );

  assert.deepEqual(result, {
    style: "academic",
    styleInstructions: "Trình bày chặt chẽ",
    length: "detailed",
    targetWordCount: 900,
    extraInstructions: "Nhấn mạnh công thức",
    model: "gpt-5.6-luna",
    reasoningEffort: "high",
    maxOutputTokens: 20_000,
    systemInstructions: undefined,
    userPrompt: undefined,
  });
});

test("giữ nguyên prompt admin đã chỉnh sửa khi dựng preview mới", () => {
  const result = prepareVideoSummaryPreviewRequest(
    {
      style: "concise",
      length: "short",
      systemInstructions: "Quy tắc riêng của admin",
      userPrompt: "Yêu cầu riêng của admin",
    },
    { preserveSystemPrompt: true, preserveUserPrompt: true },
  );

  assert.equal(result.systemInstructions, "Quy tắc riêng của admin");
  assert.equal(result.userPrompt, "Yêu cầu riêng của admin");
});
