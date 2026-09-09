import { plainToInstance } from "class-transformer";
import { Difficulty, QuestionType } from "@prisma/client";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { GenerateTestDto } from "#api/modules/tests/dto/generate-test.dto";
import {
  CreateTestSetDto,
  TestQuestionContentDto,
} from "#api/modules/tests/dto/test-content.dto";

const validationOptions = { whitelist: true, forbidNonWhitelisted: true } as const;

describe("M6.6 Test Admin DTO parity", () => {
  it("allows an omitted Test target so an empty lesson can create Bộ đề 1", async () => {
    const dto = plainToInstance(GenerateTestDto, {
      questionCount: 1,
      difficulty: Difficulty.EASY,
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it.each(["difficulty", "difficultyRatioJson"])(
    "rejects legacy TestSet field %s",
    async (field) => {
      const dto = plainToInstance(CreateTestSetDto, {
        title: "Bộ Test",
        durationSeconds: 900,
        [field]: field === "difficulty" ? Difficulty.MIXED : { easy: 1 },
      });
      const errors = await validate(dto, validationOptions);
      expect(errors.map((error) => error.property)).toContain(field);
    },
  );

  it("rejects legacy per-question points", async () => {
    const dto = plainToInstance(TestQuestionContentDto, {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      questionJson: documentWithText("Số 2 là số chẵn."),
      correctAnswerJson: true,
      points: 10,
    });
    const errors = await validate(dto, validationOptions);
    expect(errors.map((error) => error.property)).toContain("points");
  });

  it.each(["durationSeconds", "targetQuizSetId"])(
    "keeps %s out of the Test AI generation payload",
    async (field) => {
      const dto = plainToInstance(GenerateTestDto, {
        targetTestSetId: "11111111-1111-4111-8111-111111111111",
        questionCount: 1,
        difficulty: Difficulty.EASY,
        [field]:
          field === "durationSeconds" ? 900 : "22222222-2222-4222-8222-222222222222",
      });
      const errors = await validate(dto, validationOptions);
      expect(errors.map((error) => error.property)).toContain(field);
    },
  );
});

function documentWithText(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}
