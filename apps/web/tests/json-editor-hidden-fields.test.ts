import assert from "node:assert/strict";
import test from "node:test";

const modulePath = "../lib/json-editor-hidden-fields.ts";
const { omitJsonEditorFields, restoreJsonEditorFields } = await import(modulePath);

test("ẩn metadata nội bộ khỏi JSON editor nhưng giữ nguyên khi cập nhật", () => {
  const original = {
    type: "example",
    problem: "Đề bài",
    figures: [],
    origin: "SOURCE_EXACT",
  };
  const editable = omitJsonEditorFields(original, ["figures", "origin"]);

  assert.deepEqual(editable, {
    type: "example",
    problem: "Đề bài",
  });
  assert.deepEqual(
    restoreJsonEditorFields(original, { ...editable, problem: "Đề bài đã sửa" }, [
      "figures",
      "origin",
    ]),
    {
      type: "example",
      problem: "Đề bài đã sửa",
      figures: [],
      origin: "SOURCE_EXACT",
    },
  );
});
