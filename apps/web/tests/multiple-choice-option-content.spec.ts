import { expect, test } from "@playwright/test";

import { removeTrailingOptionPeriod } from "@/lib/tiptap-rich-content";
import type { TiptapTextDocument } from "@/types/rich-text";

test("removes only the final sentence period from a multiple-choice option", () => {
  const document: TiptapTextDocument = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "inlineMath", attrs: { latex: "112^\\circ" } },
          { type: "text", text: "." },
        ],
      },
    ],
  };

  expect(removeTrailingOptionPeriod(document)).toEqual({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "inlineMath", attrs: { latex: "112^\\circ" } },
          { type: "text", text: "" },
        ],
      },
    ],
  });
  expect(document.content?.[0]?.content?.[1]?.text).toBe(".");
});

test("preserves decimal points, ellipses, and periods before final math", () => {
  const cases: TiptapTextDocument[] = [
    {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "3.14" }] }],
    },
    {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Tiếp tục..." }] }],
    },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Giá trị." },
            { type: "inlineMath", attrs: { latex: "x" } },
          ],
        },
      ],
    },
  ];

  for (const document of cases) {
    expect(removeTrailingOptionPeriod(document)).toBe(document);
  }
});
