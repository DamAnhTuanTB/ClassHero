import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { UpdateLessonDto } from "#api/modules/learning-paths/dto/update-lesson.dto";

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
});

describe("M3.2 video chapters DTO", () => {
  it("accepts a valid custom video chapter collection", async () => {
    const payload = {
      customVideoSettings: {
        chapters: [
          { time: 0, title: "Giới thiệu" },
          { time: 69, title: "1. Đơn thức và đơn thức thu gọn" },
          { time: 911, title: "2. Đơn thức đồng dạng" },
          { time: 1695, title: "Bài tập" },
        ],
      },
    };

    const result = await validationPipe.transform(payload, {
      type: "body",
      metatype: UpdateLessonDto,
    });

    expect(result.customVideoSettings?.chapters).toEqual(
      payload.customVideoSettings.chapters,
    );
  });

  it("rejects negative chapter timestamps", async () => {
    await expect(
      validationPipe.transform(
        {
          customVideoSettings: {
            chapters: [{ time: -1, title: "Giới thiệu" }],
          },
        },
        {
          type: "body",
          metatype: UpdateLessonDto,
        },
      ),
    ).rejects.toThrow();
  });
});
