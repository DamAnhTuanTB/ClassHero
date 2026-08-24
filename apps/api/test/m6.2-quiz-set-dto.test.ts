import { ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  CreateQuizSetBodyDto,
  UpdateQuizSetBodyDto,
} from "../src/modules/quiz/controllers/admin-quiz.controller";

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe("M6.2 quiz set DTO", () => {
  it("accepts title as the complete create contract", async () => {
    await expect(
      validationPipe.transform(
        { title: "Bộ câu hỏi 1" },
        { type: "body", metatype: CreateQuizSetBodyDto },
      ),
    ).resolves.toEqual({ title: "Bộ câu hỏi 1" });
  });

  it.each([CreateQuizSetBodyDto, UpdateQuizSetBodyDto])(
    "rejects the removed difficulty field for %s",
    async (metatype) => {
      await expect(
        validationPipe.transform(
          { title: "Bộ câu hỏi 1", difficulty: "MIXED" },
          { type: "body", metatype },
        ),
      ).rejects.toThrow();
    },
  );
});
