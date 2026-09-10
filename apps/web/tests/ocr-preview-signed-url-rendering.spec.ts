import { expect, test } from "@playwright/test";
import { MathpixMarkdownModel } from "mathpix-markdown-it";

test("renders a signed OCR image inside a Mathpix table without creating URL columns", () => {
  const signedUrl =
    "http://localhost:9100/private/table-image.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256\\&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD\\&X-Amz-Credential=test";
  const content = String.raw`\begin{tabular}{|c|c|c|}
A & ![](${signedUrl}) & Z \\
\end{tabular}`;

  const html = MathpixMarkdownModel.markdownToHTML(content, { htmlTags: true });

  expect(html.match(/<td\b/gu)).toHaveLength(3);
  expect(html).toContain("<img");
  expect(html).toContain(
    "table-image.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&amp;X-Amz-Credential=test",
  );
  expect(html).not.toContain(">X-Amz-Content-Sha256=");
  expect(html).not.toContain(">X-Amz-Credential=");
});
