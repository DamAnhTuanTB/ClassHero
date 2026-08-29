import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";

describe("M9.1 AI structured output persistence safety", () => {
  const schema = z.object({
    title: z.string().min(1),
    nested: z.object({
      lines: z.array(z.string()),
    }),
  });

  it("removes PostgreSQL-incompatible NUL characters recursively", () => {
    expect(
      parseAiStructuredOutput(schema, {
        title: "Phương\u0000 trình",
        nested: { lines: ["Dòng\u0000 một", "Không đổi"] },
      }),
    ).toEqual({
      title: "Phương trình",
      nested: { lines: ["Dòng một", "Không đổi"] },
    });
  });

  it("preserves valid Unicode, whitespace, and LaTeX backslashes", () => {
    const valid = "Tiếng Việt α 😀\n\\frac{1}{2}\\\\x = 1\t";

    expect(
      parseAiStructuredOutput(schema, {
        title: valid,
        nested: { lines: [valid] },
      }),
    ).toEqual({
      title: valid,
      nested: { lines: [valid] },
    });
  });

  it("still applies schema validation after sanitizing", () => {
    expect(() =>
      parseAiStructuredOutput(schema, {
        title: "\u0000",
        nested: { lines: [] },
      }),
    ).toThrow("AI structured output failed schema validation");
  });
});
