import { expect, test } from "@playwright/test";

import {
  createMathMarkdownTiptapDocument,
  createMathTextTiptapDocument,
  normalizeLessonSummaryAnglesInTiptapDocument,
  serializeTiptapDocumentToMathMarkdown,
} from "@/lib/tiptap-rich-content";

test.describe("math text to Tiptap conversion", () => {
  test("repairs a high-confidence missing inline closer before tokenization", () => {
    expect(
      createMathTextTiptapDocument(
        String.raw`Cạnh cao $8\,\text{m}. Hai đỉnh thuộc cung. Lấy $\pi\approx3{,}14$.`,
      ),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Cạnh cao " },
            { type: "inlineMath", attrs: { latex: String.raw`8\,\text{m}` } },
            { type: "text", text: ". Hai đỉnh thuộc cung. Lấy " },
            { type: "inlineMath", attrs: { latex: String.raw`\pi\approx3{,}14` } },
            { type: "text", text: "." },
          ],
        },
      ],
    });
  });

  test("preserves authored spaces next to inline math", () => {
    expect(createMathTextTiptapDocument(String.raw`$\mathrm{NaCl}$ nóng chảy`)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "inlineMath", attrs: { latex: String.raw`\mathrm{NaCl}` } },
            { type: "text", text: " nóng chảy" },
          ],
        },
      ],
    });

    expect(
      createMathTextTiptapDocument(String.raw`Tinh thể $\mathrm{NaCl}$ rắn`),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Tinh thể " },
            { type: "inlineMath", attrs: { latex: String.raw`\mathrm{NaCl}` } },
            { type: "text", text: " rắn" },
          ],
        },
      ],
    });

    expect(createMathTextTiptapDocument(String.raw`Giá trị $x$`)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Giá trị " },
            { type: "inlineMath", attrs: { latex: "x" } },
          ],
        },
      ],
    });
  });

  test("still removes whitespace only at the actual paragraph boundaries", () => {
    expect(createMathTextTiptapDocument(String.raw`  Trước $x$ sau  `)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Trước " },
            { type: "inlineMath", attrs: { latex: "x" } },
            { type: "text", text: " sau" },
          ],
        },
      ],
    });
  });

  test("preserves escaped dollars and STEM notation while tokenizing math", () => {
    expect(createMathTextTiptapDocument(String.raw`Giá trị $P=\$5$ hôm nay`)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Giá trị " },
            { type: "inlineMath", attrs: { latex: String.raw`P=\$5` } },
            { type: "text", text: " hôm nay" },
          ],
        },
      ],
    });

    const document = createMathTextTiptapDocument(
      String.raw`Toán $\sqrt{x^2+1}$; Hóa $\ce{SO4^2-}$; Lý $\pu{9.81 m//s2}$; Unicode H₂O, ΔT, Ω.`,
    );
    expect(JSON.stringify(document)).toContain(String.raw`\sqrt{x^2+1}`);
    expect(JSON.stringify(document)).toContain(String.raw`\ce{SO4^2-}`);
    expect(JSON.stringify(document)).toContain(String.raw`\pu{9.81 m//s2}`);
    expect(JSON.stringify(document)).toContain("Unicode H₂O, ΔT, Ω.");
  });

  test("preserves command-like words in prose while repairing delimited math", () => {
    const prose =
      "Khi kim loại kết hợp với phi kim tạo thành muối, chất tan trong nước, nội dung được in đậm và ghi vào log.";

    expect(createMathTextTiptapDocument(prose)).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: prose }] }],
    });

    expect(createMathTextTiptapDocument(String.raw`Phi kim có góc $phi=theta$.`)).toEqual(
      {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Phi kim có góc " },
              { type: "inlineMath", attrs: { latex: String.raw`\phi=\theta` } },
              { type: "text", text: "." },
            ],
          },
        ],
      },
    );
  });

  test("converts complete Markdown strong spans without consuming literal markers", () => {
    expect(
      createMathMarkdownTiptapDocument(
        String.raw`**b)** Dùng $MB=9$ cm nên mệnh đề sai.`,
      ),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "b)", marks: [{ type: "bold" }] },
            { type: "text", text: " Dùng " },
            { type: "inlineMath", attrs: { latex: "MB=9" } },
            { type: "text", text: " cm nên mệnh đề sai." },
          ],
        },
      ],
    });

    expect(createMathMarkdownTiptapDocument("Giữ nguyên **dấu chưa đóng")).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Giữ nguyên **dấu chưa đóng" }],
        },
      ],
    });
  });

  test("serializes rich text marks and formulas back to Mathpix Markdown", () => {
    expect(
      serializeTiptapDocumentToMathMarkdown({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "b)", marks: [{ type: "bold" }] },
              { type: "text", text: " Dùng " },
              { type: "inlineMath", attrs: { latex: "MB=9" } },
              { type: "text", text: " cm." },
            ],
          },
          { type: "blockMath", attrs: { latex: "S=\\frac{25\\pi}{2}" } },
        ],
      }),
    ).toBe("**b)** Dùng $MB=9$ cm.\n\n$$\nS=\\frac{25\\pi}{2}\n$$");
  });

  test("serializes lists without flattening separate items", () => {
    expect(
      serializeTiptapDocumentToMathMarkdown({
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Ý 1" }] },
                ],
              },
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Ý 2" }] },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("- Ý 1\n- Ý 2");
  });

  test("normalizes three-point angles already stored in Tiptap math nodes", () => {
    expect(
      normalizeLessonSummaryAnglesInTiptapDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Ta có " },
              {
                type: "inlineMath",
                attrs: { latex: String.raw`\angle DAB=70^\circ` },
              },
            ],
          },
        ],
      }),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ta có " },
            {
              type: "inlineMath",
              attrs: { latex: String.raw`\widehat{DAB}=70^\circ` },
            },
          ],
        },
      ],
    });
  });
});
