import assert from "node:assert/strict";
import test from "node:test";
import { getVideoKeyboardSeekOffset } from "@/lib/video-keyboard-controls";

const baseInput = {
  altKey: false,
  ctrlKey: false,
  defaultPrevented: false,
  isComposing: false,
  isEditingTarget: false,
  metaKey: false,
  seekStepInSeconds: 5,
  shiftKey: false,
};

test("phím mũi tên dùng đúng bước tua đã cấu hình", () => {
  assert.equal(getVideoKeyboardSeekOffset({ ...baseInput, key: "ArrowLeft" }), -5);
  assert.equal(
    getVideoKeyboardSeekOffset({
      ...baseInput,
      key: "ArrowRight",
      seekStepInSeconds: 10,
    }),
    10,
  );
});

test("không nhận phím khác, tổ hợp phím hoặc phím trong vùng nhập liệu", () => {
  assert.equal(getVideoKeyboardSeekOffset({ ...baseInput, key: "Enter" }), null);
  assert.equal(
    getVideoKeyboardSeekOffset({ ...baseInput, ctrlKey: true, key: "ArrowRight" }),
    null,
  );
  assert.equal(
    getVideoKeyboardSeekOffset({
      ...baseInput,
      isEditingTarget: true,
      key: "ArrowLeft",
    }),
    null,
  );
});
