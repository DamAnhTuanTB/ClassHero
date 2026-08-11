import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  getUserFacingErrorMessage,
  sanitizeUserFacingMessage,
} from "@/lib/user-facing-error";

test("giữ thông báo tiếng Việt dễ hiểu", () => {
  assert.equal(
    sanitizeUserFacingMessage("Tên điểm đã được sử dụng. Hãy chọn tên khác."),
    "Tên điểm đã được sử dụng. Hãy chọn tên khác.",
  );
});

test("loại phần mô tả kiểm tra cấu trúc bằng tiếng Anh", () => {
  assert.equal(
    sanitizeUserFacingMessage(
      "Không thể sửa vì nội dung hoặc cấu trúc hình không hợp lệ: Point labels must be one uppercase point name with optional primes or numeric subscripts.",
      "Chưa thể sửa hình. Hãy kiểm tra lại nội dung.",
    ),
    "Không thể sửa vì nội dung hoặc cấu trúc hình không hợp lệ.",
  );
});

test("thay lỗi kỹ thuật thuần túy bằng lời nhắc theo ngữ cảnh", () => {
  assert.equal(
    getUserFacingErrorMessage(
      new Error("TypeError: Cannot read properties of undefined"),
      "Chưa lưu được nội dung. Vui lòng thử lại.",
    ),
    "Chưa lưu được nội dung. Vui lòng thử lại.",
  );
});

test("thay câu lỗi tiếng Anh chưa biết bằng lời nhắc theo ngữ cảnh", () => {
  assert.equal(
    sanitizeUserFacingMessage(
      "Budget limit exceeded",
      "Đã vượt giới hạn sử dụng. Vui lòng kiểm tra lại cấu hình.",
    ),
    "Đã vượt giới hạn sử dụng. Vui lòng kiểm tra lại cấu hình.",
  );
});

test("ưu tiên thông báo tiếng Việt theo mã lỗi", () => {
  assert.equal(
    getUserFacingErrorMessage(
      { code: "AI_BUDGET_EXCEEDED", message: "Budget limit exceeded" },
      "Chưa thể bắt đầu tạo nội dung.",
      {
        AI_BUDGET_EXCEEDED:
          "Ngân sách tạo nội dung đã hết. Hãy kiểm tra phần cài đặt chi phí.",
      },
    ),
    "Ngân sách tạo nội dung đã hết. Hãy kiểm tra phần cài đặt chi phí.",
  );
});

test("không đưa trực tiếp lỗi kỹ thuật động vào phản hồi giao diện", () => {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const violations = collectSourceFiles(webRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    return [
      /error\s+instanceof\s+Error\s*\?\s*error\.message/gu,
      /description\s*:\s*[A-Za-z_$][\w$]*\.message/gu,
      /toast\.(?:error|warning|info|success)\(\s*[A-Za-z_$][\w$]*\.error/gu,
    ].flatMap((pattern) =>
      [...source.matchAll(pattern)].map(
        (match) => `${filePath.slice(webRoot.length + 1)}: ${match[0]}`,
      ),
    );
  });

  assert.deepEqual(violations, []);
});

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      entry.name === ".next" ||
      entry.name === "node_modules" ||
      entry.name === "tests"
    ) {
      return [];
    }
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(filePath);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [filePath] : [];
  });
}
