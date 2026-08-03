import type { TiptapContent, TiptapNode } from "#api/common/types/rich-text.types";
import type { LessonSummaryOutput } from "#api/modules/ai/types/lesson-summary.types";

export function mapLessonSummaryToTiptap(summary: LessonSummaryOutput): TiptapContent {
  const content: TiptapNode[] = [heading(summary.title, 1)];

  content.push(heading("Mục tiêu học tập", 2));
  content.push(bulletList(summary.objectives));

  for (const section of summary.sections) {
    content.push(heading(section.heading, 2));
    content.push(...paragraphs(section.content));

    if (section.keyFormulas.length > 0) {
      content.push(heading("Công thức quan trọng", 3));
      content.push(bulletList(section.keyFormulas));
    }
    if (section.examples.length > 0) {
      content.push(heading("Ví dụ", 3));
      content.push(bulletList(section.examples));
    }
  }

  if (summary.commonMistakes.length > 0) {
    content.push(heading("Lỗi thường gặp", 2));
    content.push(bulletList(summary.commonMistakes));
  }

  content.push(heading("Câu hỏi ôn tập", 2));
  content.push(bulletList(summary.reviewQuestions));

  return { type: "doc", content };
}

function heading(text: string, level: 1 | 2 | 3): TiptapNode {
  return {
    type: "heading",
    attrs: { level },
    content: [textNode(text)],
  };
}

function paragraphs(value: string): TiptapNode[] {
  return value
    .split(/\n+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({
      type: "paragraph",
      content: [textNode(text)],
    }));
}

function bulletList(items: string[]): TiptapNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: [textNode(item)],
        },
      ],
    })),
  };
}

function textNode(text: string): TiptapNode {
  return { type: "text", text };
}
