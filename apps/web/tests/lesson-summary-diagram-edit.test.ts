import assert from "node:assert/strict";
import test from "node:test";
import {
  lessonSummaryDiagramSpecStructuralSchema,
  type LessonSummaryDiagramSpec,
} from "@learning-path/shared";
import {
  createAngleLabelTarget,
  createCaptionTarget,
  createDiagramLabelTarget,
  createMarkerTarget,
  createPointLabelTarget,
} from "@/components/common/content/lesson-summary-diagram-editing";
import {
  addEqualLengthMarkerToLessonSummaryDiagram,
  deleteLessonSummaryDiagramTarget,
  editLessonSummaryDiagramTargetText,
} from "@/features/admin/ai-generation/utils/lesson-summary-diagram-edit";

test("sửa tên điểm theo cách bất biến và giữ nguyên ID cùng hình học của điểm", () => {
  const spec = createEditableDiagram();
  const originalSnapshot = structuredClone(spec);
  const target = createPointLabelTarget(spec.points[0]!);
  assert.ok(target);

  const result = editLessonSummaryDiagramTargetText(spec, target, "M′");

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.spec.points[0]?.label, "M′");
  assert.equal(result.spec.points[0]?.id, "A");
  assert.deepEqual(
    { ...result.spec.points[0], label: spec.points[0]?.label },
    spec.points[0],
  );
  assert.deepEqual(spec, originalSnapshot);
  assert.notEqual(result.spec, spec);
});

test("không cho xóa tên điểm và chặn tên điểm trùng", () => {
  const spec = createEditableDiagram();
  const target = createPointLabelTarget(spec.points[0]!);
  assert.ok(target);

  assert.deepEqual(deleteLessonSummaryDiagramTarget(spec, target), {
    success: false,
    reason: "Tên điểm chỉ được sửa, không được xóa khỏi hình.",
  });
  const duplicate = editLessonSummaryDiagramTargetText(spec, target, "B");
  assert.equal(duplicate.success, false);
  if (duplicate.success) return;
  assert.match(duplicate.reason, /Tên điểm này đã được dùng/u);
});

test("sửa được nhãn phụ và số đo góc nhưng không chấp nhận nội dung rỗng", () => {
  const spec = createEditableDiagram();
  const labelTarget = createDiagramLabelTarget(spec.labels[0]!, 0);
  const editedLabel = editLessonSummaryDiagramTargetText(spec, labelTarget, "6 cm");
  assert.equal(editedLabel.success, true);
  if (editedLabel.success) assert.equal(editedLabel.spec.labels[0]?.text, "6 cm");

  const angleIndex = spec.markers.findIndex((marker) => marker.type === "ANGLE");
  const angle = spec.markers[angleIndex];
  assert.equal(angle?.type, "ANGLE");
  if (!angle || angle.type !== "ANGLE") return;
  const angleTarget = createAngleLabelTarget(angle, angleIndex);
  assert.ok(angleTarget);
  const editedAngle = editLessonSummaryDiagramTargetText(spec, angleTarget, "40°");
  assert.equal(editedAngle.success, true);
  if (editedAngle.success) {
    const editedMarker = editedAngle.spec.markers[angleIndex];
    assert.equal(editedMarker?.type === "ANGLE" ? editedMarker.label : undefined, "40°");
  }
  const empty = editLessonSummaryDiagramTargetText(spec, labelTarget, "  ");
  assert.equal(empty.success, false);
  if (!empty.success) assert.match(empty.reason, /không được để trống/u);
});

test("sửa hoặc xóa caption mà không đổi hình học", () => {
  const spec = createEditableDiagram();
  const target = createCaptionTarget(spec.caption);
  assert.ok(target);

  const edited = editLessonSummaryDiagramTargetText(spec, target, "Hai tam giác vuông");
  assert.equal(edited.success, true);
  if (edited.success) {
    assert.equal(edited.spec.caption, "Hai tam giác vuông");
    assert.deepEqual(edited.spec.primitives, spec.primitives);
  }
  const deleted = deleteLessonSummaryDiagramTarget(spec, target);
  assert.equal(deleted.success, true);
  if (deleted.success) {
    assert.equal(deleted.spec.caption, null);
    assert.deepEqual(deleted.spec.points, spec.points);
  }
});

test("xóa đúng label theo fingerprint và từ chối target đã cũ", () => {
  const spec = createEditableDiagram();
  const target = createDiagramLabelTarget(spec.labels[0]!, 0);
  const result = deleteLessonSummaryDiagramTarget(spec, target);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.spec.labels.length, spec.labels.length - 1);
    assert.equal(result.spec.labels.filter((label) => label.text === "5 cm").length, 1);
    assert.equal(result.spec.labels[0]?.anchorPrimitiveId, "DE");
  }

  const staleResult = deleteLessonSummaryDiagramTarget(spec, {
    ...target,
    fingerprint: "stale",
  });
  assert.deepEqual(staleResult, {
    success: false,
    reason: "Phần tử đã thay đổi. Hãy chọn lại trên hình rồi thử xóa.",
  });
});

test("xóa text góc vẫn giữ cung, còn xóa marker loại cả quan hệ", () => {
  const spec = createEditableDiagram();
  const angleIndex = spec.markers.findIndex((marker) => marker.type === "ANGLE");
  const angle = spec.markers[angleIndex];
  assert.equal(angle?.type, "ANGLE");
  if (!angle || angle.type !== "ANGLE") return;

  const labelTarget = createAngleLabelTarget(angle, angleIndex);
  assert.ok(labelTarget);
  const withoutLabel = deleteLessonSummaryDiagramTarget(spec, labelTarget);
  assert.equal(withoutLabel.success, true);
  if (withoutLabel.success) {
    const retainedAngle = withoutLabel.spec.markers[angleIndex];
    assert.equal(retainedAngle?.type, "ANGLE");
    assert.equal(retainedAngle?.type === "ANGLE" ? retainedAngle.label : undefined, null);
  }

  const markerTarget = createMarkerTarget(angle, angleIndex);
  const withoutMarker = deleteLessonSummaryDiagramTarget(spec, markerTarget);
  assert.equal(withoutMarker.success, true);
  if (withoutMarker.success) {
    assert.equal(
      withoutMarker.spec.markers.some(
        (marker) => marker.type === "ANGLE" && marker.vertex === angle.vertex,
      ),
      false,
    );
  }
});

test("một dấu bằng nhau đại diện cho cả marker group, không tạo nhóm một đoạn", () => {
  const spec = createEditableDiagram();
  const markerIndex = spec.markers.findIndex((marker) => marker.type === "EQUAL_LENGTH");
  const marker = spec.markers[markerIndex];
  assert.equal(marker?.type, "EQUAL_LENGTH");
  if (!marker) return;

  const result = deleteLessonSummaryDiagramTarget(
    spec,
    createMarkerTarget(marker, markerIndex),
  );

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(
    result.spec.markers.some((candidate) => candidate.type === "EQUAL_LENGTH"),
    false,
  );
  assert.deepEqual(result.spec.primitives, spec.primitives);
});

test("thêm nhóm bằng nhau cho từ hai SEGMENT có tên hai đầu và tự chọn số vạch", () => {
  const spec = createEditableDiagram();
  const originalSnapshot = structuredClone(spec);

  const result = addEqualLengthMarkerToLessonSummaryDiagram(spec, ["BC", "EF", "BC"]);

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.spec.markers.at(-1), {
    type: "EQUAL_LENGTH",
    segmentIds: ["BC", "EF"],
    markCount: 2,
  });
  assert.deepEqual(result.spec.primitives, spec.primitives);
  assert.deepEqual(spec, originalSnapshot);
});

test("chặn nhóm bằng nhau thiếu đoạn, đoạn đã đánh dấu hoặc đầu mút không có tên", () => {
  const spec = createEditableDiagram();
  const tooShort = addEqualLengthMarkerToLessonSummaryDiagram(spec, ["BC"]);
  assert.equal(tooShort.success, false);
  if (!tooShort.success) assert.match(tooShort.reason, /ít nhất hai/u);

  const alreadyMarked = addEqualLengthMarkerToLessonSummaryDiagram(spec, ["AB", "EF"]);
  assert.equal(alreadyMarked.success, false);
  if (!alreadyMarked.success) assert.match(alreadyMarked.reason, /nhóm bằng nhau khác/u);

  const hiddenEndpointSpec = structuredClone(spec);
  hiddenEndpointSpec.points[2] = { ...hiddenEndpointSpec.points[2]!, label: null };
  const hiddenEndpoint = addEqualLengthMarkerToLessonSummaryDiagram(hiddenEndpointSpec, [
    "BC",
    "EF",
  ]);
  assert.equal(hiddenEndpoint.success, false);
  if (!hiddenEndpoint.success) assert.match(hiddenEndpoint.reason, /cả hai đầu mút/u);
});

test("chặn xóa nếu full acceptance schema phát sinh lỗi mới", () => {
  const spec = createClockDiagramWithExistingTickWarning();
  const labelTarget = createDiagramLabelTarget(spec.labels[0]!, 0);

  const result = deleteLessonSummaryDiagramTarget(spec, labelTarget);

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.reason, /đủ các số 12, 3, 6 và 9/u);
  assert.equal(spec.labels.length, 4);
});

function createEditableDiagram(): LessonSummaryDiagramSpec {
  return parseDiagram({
    version: 1,
    coordinateSystem: "CARTESIAN",
    viewBox: { minX: -1, minY: -1, width: 12, height: 6 },
    toScale: true,
    points: [
      { id: "A", x: 0, y: 0, label: "A", pointStyle: "NONE" },
      { id: "B", x: 0, y: 4, label: "B", pointStyle: "NONE" },
      { id: "C", x: 3, y: 0, label: "C", pointStyle: "NONE" },
      { id: "D", x: 6, y: 0, label: "D", pointStyle: "NONE" },
      { id: "E", x: 6, y: 4, label: "E", pointStyle: "NONE" },
      { id: "F", x: 9, y: 0, label: "F", pointStyle: "NONE" },
    ],
    primitives: [
      { id: "AB", type: "SEGMENT", from: "A", to: "B", style: "SOLID" },
      { id: "BC", type: "SEGMENT", from: "B", to: "C", style: "SOLID" },
      { id: "CA", type: "SEGMENT", from: "C", to: "A", style: "SOLID" },
      { id: "DE", type: "SEGMENT", from: "D", to: "E", style: "SOLID" },
      { id: "EF", type: "SEGMENT", from: "E", to: "F", style: "SOLID" },
      { id: "FD", type: "SEGMENT", from: "F", to: "D", style: "SOLID" },
    ],
    markers: [
      { type: "RIGHT_ANGLE", vertex: "A", armPointIds: ["B", "C"] },
      { type: "RIGHT_ANGLE", vertex: "D", armPointIds: ["E", "F"] },
      { type: "ANGLE", vertex: "B", armPointIds: ["A", "C"], label: "35°" },
      { type: "EQUAL_LENGTH", segmentIds: ["AB", "DE"], markCount: 1 },
      { type: "PARALLEL", segmentIds: ["CA", "FD"], markCount: 1 },
    ],
    labels: [
      {
        text: "5 cm",
        anchorPointId: "A",
        anchorPrimitiveId: "AB",
        position: "LEFT",
      },
      {
        text: "5 cm",
        anchorPointId: "D",
        anchorPrimitiveId: "DE",
        position: "LEFT",
      },
    ],
    caption: "Hai tam giác vuông bằng nhau",
  });
}

function createClockDiagramWithExistingTickWarning(): LessonSummaryDiagramSpec {
  return parseDiagram({
    version: 1,
    coordinateSystem: "CARTESIAN",
    viewBox: { minX: -6, minY: -6, width: 12, height: 12 },
    toScale: true,
    points: [
      { id: "O", x: 0, y: 0, label: "O", pointStyle: "NONE" },
      { id: "P12", x: 0, y: 5, label: null, pointStyle: "NONE" },
      { id: "P3", x: 5, y: 0, label: null, pointStyle: "NONE" },
      { id: "P6", x: 0, y: -5, label: null, pointStyle: "NONE" },
      { id: "P9", x: -5, y: 0, label: null, pointStyle: "NONE" },
    ],
    primitives: [
      { id: "clockFace", type: "CIRCLE", center: "O", radius: 5, style: "SOLID" },
    ],
    markers: [],
    labels: [
      { text: "12", anchorPointId: "P12", position: "CENTER" },
      { text: "3", anchorPointId: "P3", position: "CENTER" },
      { text: "6", anchorPointId: "P6", position: "CENTER" },
      { text: "9", anchorPointId: "P9", position: "CENTER" },
    ],
    caption: "Mặt đồng hồ",
  });
}

function parseDiagram(value: unknown): LessonSummaryDiagramSpec {
  const parsed = lessonSummaryDiagramSpecStructuralSchema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}
