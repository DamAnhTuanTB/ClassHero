import { tiptapContentSchema } from "../src/common/validation/zod-schemas/tiptap.schema";
import { describe, it, expect } from "vitest";

describe("M6.1 Tiptap Schema Validation", () => {
  it("should validate a valid basic tiptap doc", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello World",
            },
          ],
        },
      ],
    };
    
    const result = tiptapContentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it("should fail if root type is not doc", () => {
    const doc = {
      type: "paragraph",
      content: [],
    };
    
    const result = tiptapContentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  it("should validate complex doc with math and attributes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [
            {
              type: "text",
              text: "Math formula",
              marks: [{ type: "bold" }],
            },
          ],
        },
        {
          type: "math",
          attrs: { formula: "E=mc^2" },
        },
      ],
    };
    
    const result = tiptapContentSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });
});
