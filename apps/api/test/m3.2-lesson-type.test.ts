import { BadRequestException } from "@nestjs/common";
import { LessonType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { normalizeLessonLiveUrl } from "#api/modules/learning-paths/utils/lesson.helpers";

describe("M3.2 lesson type", () => {
  it("clears the live URL for a basic lesson", () => {
    expect(
      normalizeLessonLiveUrl(LessonType.BASIC, "https://meet.google.com/example"),
    ).toBeNull();
  });

  it("keeps an optional valid HTTP(S) URL for a live lesson", () => {
    expect(
      normalizeLessonLiveUrl(LessonType.LIVE, "  https://meet.google.com/abc-defg-hij  "),
    ).toBe("https://meet.google.com/abc-defg-hij");
    expect(normalizeLessonLiveUrl(LessonType.LIVE, "")).toBeNull();
  });

  it("rejects an invalid live lesson URL", () => {
    expect(() => normalizeLessonLiveUrl(LessonType.LIVE, "not-a-url")).toThrow(
      BadRequestException,
    );
  });
});
