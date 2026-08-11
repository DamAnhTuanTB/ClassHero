# M9.13–M9.15 — Admin chỉnh trực tiếp hình JSON an toàn

Trạng thái: `DONE` ngày 2026-08-11

Mode: `UI + API` — tái sử dụng `PUT /admin/lessons/:lessonId/summary`; không thêm
endpoint, database, worker hoặc provider call.

## 1. Phạm vi đã triển khai

- Click/tap/keyboard chọn phần tử thì phần tử tô đỏ và popup action nhỏ nằm sát
  target, được giữ trong biên figure.
- `point.label` chỉ sửa tên hiển thị; không xóa, không đổi `point.id`, tọa độ hay
  tham chiếu.
- `labels[]`, `ANGLE.label` và `caption` được sửa hoặc xóa.
- `ANGLE`, `RIGHT_ANGLE`, `EQUAL_LENGTH`, `PARALLEL` được xóa theo cả marker group;
  click một glyph đại diện toàn bộ quan hệ.
- Sửa/xóa áp dụng ngay trong content draft, không confirm. `Lưu nội dung` mới PUT
  và backend vẫn reconcile review issue/publish guard.
- Mỗi hình có nút reset. Reset là action duy nhất có confirm và phục hồi toàn bộ
  `visual.spec` của đúng hình về snapshot tải đầu phiên; nội dung khác không đổi.

## 2. Chọn đoạn và thêm dấu bằng nhau

- Chỉ primitive `SEGMENT` có hai điểm mút tồn tại và cả hai point đều có tên mới
  selectable.
- Một đoạn được chọn chỉ tô đỏ, không có popup. Từ hai đoạn trở lên mới hiện popup
  chỉ có icon `=`; không có text đếm và không có nút X.
- Admin bỏ chọn bằng cách chọn lại cạnh hoặc click nền hình.
- Segment hit-test tính khoảng cách từ tọa độ click tới từng đoạn sau khi đổi từ
  screen coordinate sang SVG coordinate. Không render hit-line trong suốt, nên
  click `BC` không thể bị phần hit của `B′C′` chồng lên.
- Pure helper từ chối dưới hai segment, segment thiếu tên ở một đầu, segment đã
  nằm trong `EQUAL_LENGTH` hoặc marker mới không còn `markCount` khả dụng.

## 3. Guardrail dữ liệu

- Mọi mutation clone bất biến và xác minh fingerprint/index của target.
- Structural schema phải pass. Số lượng acceptance issue sau mutation không được
  tăng; nếu tăng thì giữ nguyên spec và báo lỗi cho admin.
- Không xóa/sửa point object, primitive, topology, cạnh, đường, polygon, circle,
  arc hoặc nhãn trục suy ra.
- Không tự accept/xóa review issue, không autosave, không gọi AI/OCR.
- Summary `APPROVED` phải thu hồi trước khi chỉnh; student/read-only không nhận
  editor contract hoặc edit/reset affordance.

## 4. Cấu trúc triển khai

- Shared renderer:
  `apps/web/components/common/content/lesson-summary-diagram.tsx`.
- Typed editor contract:
  `apps/web/components/common/content/lesson-summary-diagram-editing.ts`.
- Popup phần tử và popup nhiều đoạn là component riêng cạnh renderer.
- Pure mutation helper:
  `apps/web/features/admin/ai-generation/utils/lesson-summary-diagram-edit.ts`.
- `AdminLessonSummaryTab` sở hữu draft, snapshot reset, cảnh báo tham chiếu ngoài
  hình và cơ chế giữ scroll; `SummaryBlockRenderer` chỉ truyền callback optional.

## 5. Luồng dữ liệu

```txt
AdminLessonSummaryTab.content
  -> SummaryBlockRenderer(editor callbacks)
    -> LessonSummaryDiagram selection + popup
      -> pure edit/delete/add helper
        -> structural validation + acceptance-issue guard
      -> cập nhật đúng block.visual.spec trong draft
  -> admin bấm Lưu nội dung
    -> PUT /admin/lessons/:lessonId/summary
      -> backend reconcile review issues + audit + persist
```

## 6. Nghiệm thu

- Unit helper bao phủ rename tên điểm, label/góc/caption edit-delete, marker group
  delete, stale target, invalid segment và tạo `EQUAL_LENGTH`.
- Playwright bao phủ desktop, tablet, Chromium mobile, WebKit mobile; kiểm tra
  draft-only/reload/save, approved guard, đúng ID segment, một đoạn không popup,
  popup hai đoạn chỉ có `=`, reset confirm và giữ nguyên vị trí cuộn.
- Kiểm tra ảnh light/dark xác nhận popup nhỏ không che cả hình và nằm sát target.
- Web/shared/API typecheck, targeted ESLint, schema regression và `git diff --check`
  phải pass trước khi nghiệm thu.

## 7. Không làm

- Kéo thả label, đổi style/màu/markCount thủ công, thay topology hoặc đổi ID điểm.
- Undo history nhiều bước, autosave/collaboration realtime, PATCH từng phần tử.
- Tự suy luận quan hệ toán học mới từ đề/lời giải hoặc gọi provider để repair.
