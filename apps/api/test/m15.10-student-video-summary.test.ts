import { ReviewStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { serializeStudentVideoSummary } from "#api/modules/student-learning/serializers/student-lesson.serializers";

const approvedSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  lessonId: "00000000-0000-4000-8000-000000000002",
  contentJson: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Video" }] }],
  },
  reviewStatus: ReviewStatus.APPROVED,
  staleAt: null,
  updatedAt: new Date("2026-09-10T00:00:00.000Z"),
  deletedAt: null,
};

describe("M15.10 student video summary serialization", () => {
  it("returns only the safe fields of an approved current summary", () => {
    expect(serializeStudentVideoSummary(approvedSummary)).toEqual({
      id: approvedSummary.id,
      lessonId: approvedSummary.lessonId,
      contentJson: approvedSummary.contentJson,
      updatedAt: approvedSummary.updatedAt,
    });
  });

  it("removes legacy summary blocks before student delivery", () => {
    const contentJson = {
      type: "lesson_summary_blocks",
      version: 5,
      data: {
        title: "Video cũ",
        objectives: ["Nội dung chính"],
        sections: [
          {
            order: 1,
            displayHeading: "Phần một",
            blocks: [
              { type: "knowledge", title: "Kiến thức", content: "Nội dung" },
              { type: "summary", content: "- Tổng kết cũ" },
            ],
          },
        ],
      },
    };

    expect(
      serializeStudentVideoSummary({ ...approvedSummary, contentJson })?.contentJson,
    ).toMatchObject({
      version: 6,
      data: {
        sections: [
          {
            blocks: [{ type: "knowledge" }],
          },
        ],
      },
    });
  });

  it.each([
    { label: "hidden", value: { ...approvedSummary, reviewStatus: ReviewStatus.HIDDEN } },
    { label: "stale", value: { ...approvedSummary, staleAt: new Date() } },
    { label: "deleted", value: { ...approvedSummary, deletedAt: new Date() } },
  ])("does not expose a $label summary", ({ value }) => {
    expect(serializeStudentVideoSummary(value)).toBeNull();
  });
});
