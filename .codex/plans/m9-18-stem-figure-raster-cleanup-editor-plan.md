# Kế hoạch M9.18 - Editor chỉnh nhẹ ảnh raster sách giáo khoa

Ngày: 2026-08-20

Trạng thái: `Implemented 2026-08-20`

Mode: `Full-stack (UI + API)`

## 1. Bài toán và kết luận phân tích

Ảnh đang hiển thị trong Summary là delivery asset WebP đã được tách khỏi OCR
artifact, không phải URL OCR tạm thời. Nếu crop nguồn vốn ít pixel, out-of-focus
hoặc đã nhiễu thì WebP quality 92 không thể phục hồi chi tiết; tăng quality chỉ
giảm mất mát của lần encode, không tạo thêm thông tin.

M9.18 vì vậy chỉ hứa hai cải thiện có thể kiểm soát:

1. `Làm nét ảnh`: giảm nhiễu nhẹ và tăng độ rõ biên từ pixel đang có, dùng một
   preset bảo thủ/versioned.
2. `Xóa chi tiết thừa`: admin tô mask lên chi tiết nhỏ nằm trên nền gần đồng
   nhất; backend lấy màu từ vùng nền bao quanh để fill và feather mép.

Không dùng generative AI/super-resolution/inpainting. Hướng này không phát sinh
chi phí provider, deterministic, audit được và không có nguy cơ AI tự đổi ký hiệu
toán học. Đổi lại, nó không xử lý tốt nền gradient/họa tiết, vật thể lớn, đường bị
che hoặc ảnh nguồn thiếu chi tiết nghiêm trọng.

## 2. Contract sản phẩm

- Role: chỉ `ADMIN`.
- Entry point: icon `WandSparkles` cạnh icon sách/menu ba chấm trên figure.
- Chỉ hiện khi current revision `SUCCEEDED`, có raster delivery và
  `currentAssetKind=TEXTBOOK_SOURCE`.
- Không hiện cho `AI_TEX`, asset pending/failed hoặc figure chưa có delivery.
- Modal chỉ có hai tool nêu trên; không mở rộng thành editor ảnh tổng quát.
- Admin phải tạo preview hợp lệ trước khi apply. Mọi thay đổi tool/mask làm
  preview cũ stale.
- Làm nét không được mô tả là “khôi phục ảnh gốc”; UI nói rõ giới hạn.
- Xóa chi tiết chỉ phù hợp nền phẳng. Backend có quyền từ chối vùng chọn không
  an toàn và hướng dẫn admin thu nhỏ mask hoặc tải ảnh thay thế.

## 3. Thiết kế UI

### Action và modal

- Tái sử dụng `admin-stem-figure-action-frame.tsx`; thêm action có tooltip và
  `aria-label="Chỉnh sửa ảnh"`.
- Tạo modal lazy-load riêng, dự kiến
  `admin-stem-figure-raster-editor-dialog.tsx`, theo layout ba vùng hiện có.
- Khung preview giữ đúng aspect ratio, có checkerboard nhẹ nếu ảnh có alpha,
  zoom/pan và nút giữ/nhả hoặc toggle `Ảnh gốc / Sau chỉnh sửa`.

### Toolbar v1

- `Làm nét ảnh`: toggle tự chạy preview, một preset duy nhất; chưa có slider.
- `Xóa chi tiết thừa`: bật chế độ vẽ mask và tự preview sau mỗi stroke;
  cỡ cọ `Nhỏ / Vừa / Lớn`.
- Hai tool loại trừ nhau; phải bỏ chọn tool hiện tại trước khi chọn tool còn lại.
- `Hoàn tác`, `Làm lại`, `Xóa vùng chọn`.
- Pointer Events hỗ trợ mouse/touch/pen. Lịch sử chỉ lưu stroke/mask delta trong
  phiên modal, có giới hạn số bước để tránh giữ quá nhiều bitmap trong RAM.
- Footer có `Hủy`/`Đóng` và `Áp dụng`; apply chỉ bật khi auto-preview mới nhất
  fresh. Sau lượt commit đầu tiên, action thoát đổi từ `Hủy` thành `Đóng` vì
  revision đã lưu không bị hoàn tác khi đóng modal.

### State cần có

- Loading ảnh nguồn, ảnh lỗi/CORS, drawing, preview pending, preview warning,
  preview error, apply pending, stale revision conflict và apply success.
- Preview xóa debounce sau stroke/undo/redo, không gọi API theo từng pointer move.
- Khi API từ chối nền phức tạp, giữ nguyên mask để admin sửa, không đóng modal.
- Sau apply, giữ modal mở, dùng figure response làm working asset/guard, reset
  tool/preview/mask và mở lại cả hai tool cho lượt tiếp theo; đồng thời
  invalidate/refetch figure + Summary asset ở nền và giữ vị trí cuộn.

## 4. Contract xử lý ảnh

Pipeline version hiện hành: `TEXTBOOK_RASTER_CLEANUP_V2`.

Mỗi request chỉ bật đúng một tool:

```txt
decode + auto-rotate
  -> [remove] validate raster/mask -> remove simple details
  -> hoặc [enhance] median denoise 3x3 -> bounded linear contrast
       -> saturation 1.06 -> sharpen
  -> validate output
  -> encode WebP lossless
```

### Làm nét

- Dùng Sharp/libvips có sẵn; không thêm package.
- Preset triển khai theo constant versioned, dùng median 3x3 loại điểm nhiễu rời,
  tăng tương phản tuyến tính mức vừa để làm sạch nền mờ rồi sharpen bảo thủ. Không
  threshold nền, không upscale mặc định và không thay đổi aspect ratio.
- Test bằng fixture có cạnh/chữ/ký hiệu mảnh để tránh halo, đứt nét hoặc làm mất
  alpha. Threshold cụ thể được chốt từ fixture tổng quát khi code, không hard-code
  theo riêng Hình 5.23.

### Xóa chi tiết đơn giản

- Client gửi PNG mask cùng kích thước preview logical; API scale về kích thước
  source bằng nearest-neighbor.
- Tách connected components, giới hạn tổng coverage, component count và bounding
  box. Mỗi component lấy một vòng nền đã dilate bên ngoài mask.
- Tính median/dominant color và variance của vòng nền. Chỉ fill khi variance dưới
  gate; feather 1-2px để tránh viền cứng.
- Vùng chạm biên, không đủ sample nền, nền nhiều màu/texture hoặc mask quá lớn bị
  reject bằng error code ổn định. Không dùng content-aware fill.

### Giới hạn cần cấu hình bằng constant/version

- Input upload/download tiếp tục bám max file hiện có; validate thêm decoded
  pixel count để chống decompression bomb.
- Preview: cạnh dài tối đa `1600px`.
- Apply: cap pixel/byte/time đủ an toàn cho request sync; giá trị cuối cùng được
  benchmark khi implement, không thêm env nếu constant đủ dùng.
- Không log ảnh, mask, signed URL hay object key.

## 5. API

Hai endpoint ADMIN multipart:

```txt
POST /admin/lessons/:lessonId/stem-figures/:figureId/raster-edits/preview
POST /admin/lessons/:lessonId/stem-figures/:figureId/raster-edits/apply
```

Fields:

- `baseCurrentRevisionId: string`
- `baseSourceVersion: number`
- `operations: JSON string`
  `{ enhance: boolean, removeSimpleDetails: boolean, pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2" }`
- `mask?: image/png`

Hai boolean operation phải XOR. Cả hai cùng `true` hoặc cùng `false` đều bị từ
chối. Backend luôn tải delivery asset của `baseCurrentRevisionId`; sau apply,
revision mới trở thành base/input duy nhất của lần chỉnh tiếp theo.

Preview trả data URL giới hạn kích thước, dimensions, warnings,
`maskCoverageRatio`, `backgroundVariance`. Preview không ghi DB/R2.

Apply tự resolve current delivery; không tin URL/object key/source bytes từ
client. Apply lưu File mới, revision `ADMIN_UPLOAD`, audit id rồi trả figure đã
serialize. File metadata gồm:

- `uploadSource: "stem-figure.raster-edit"`
- `derivedFromRevisionId`
- `editPipelineVersion`
- `editOperations`
- `maskCoverageRatio`
- `textbookSourceObjectKey` kế thừa từ asset nguồn

Mutation dùng transaction/guard để candidate chỉ trở thành current revision nếu
head không đổi. Upload/process/validate lỗi phải cleanup candidate phù hợp và
không đổi asset hiện hành.

## 6. Cấu trúc code dự kiến

Web:

- Sửa `admin-stem-figure-action-frame.tsx` để phát action.
- Sửa `admin-lesson-summary-tab.tsx` để quản lý figure/editor được chọn và lazy
  import modal.
- Thêm component feature-local `admin-stem-figure-raster-editor-dialog.tsx`.
- Thêm hook Canvas feature-local, ví dụ `use-stem-figure-raster-mask.ts`; không
  đẩy vào shared vì chưa có consumer thứ hai.
- Mở rộng `admin-ai-generation-api.ts`, hook query/mutation, schema và types hiện
  có. Import nội bộ dùng alias `@/...`.

API:

- Mở rộng `admin-stem-figures.controller.ts` bằng hai route multipart.
- Thêm DTO operation/mutation guard trong module `stem-figures`.
- Thêm service riêng `stem-figure-raster-edit.service.ts` để decode/validate/
  preview/apply; dùng `StemFiguresService`/artifact/storage primitive hiện có,
  không nhồi xử lý ảnh vào controller.
- Thêm utility thuần cho mask/background gate để unit test không cần R2/DB.
- Import nội bộ dùng alias `#api/...`; lỗi HTTP đi qua common error factory.
- Không sửa `apps/api/src/workers/*` ở v1.

Database/shared:

- Không migration. Dùng StemFigureRevision/File metadata/audit hiện có.
- Chỉ thêm shared/web schema nếu response type thực sự dùng ở cả hai phía; tránh
  tạo package contract mới chỉ cho một modal.

## 7. Thứ tự triển khai đề xuất

1. Viết fixtures và utility mask/background/enhance ở API, khóa pipeline version
   cùng focused unit tests.
2. Thêm preview/apply service + controller + validation/error/audit; integration
   test atomic/stale/provenance/no-write-preview.
3. Thêm web API/schema/hook và modal Canvas lazy-load.
4. Gắn icon vào action frame với availability guard, refetch/scroll preservation.
5. Chạy component test, Playwright desktop/mobile, typecheck/lint/build liên quan,
   benchmark preview/apply trên ảnh nhỏ/vừa/gần cap.

Nếu muốn duyệt UI trước khi nối API thật, có thể chạy `/task-ui M9.18` với mock
local rồi `/task-connect M9.18`; không được báo M9.18 Done cho tới khi cả hai phần
và test atomic revision hoàn tất.

## 8. Verification và tiêu chí chấp nhận

- Pipeline deterministic cùng input/mask/version cho cùng output pixels/hash.
- Không có paid provider call hoặc provider usage record.
- Preview không tạo File/revision/audit apply.
- Apply thành công tạo revision/file mới, vẫn serialize
  `currentAssetKind=TEXTBOOK_SOURCE`; ảnh cũ còn trong revision history.
- Apply lỗi/stale không thay `currentRevisionId`.
- Web bundle ban đầu không tải Canvas editor; modal hoạt động bằng mouse và touch.
- P95 apply với ảnh trong cap mục tiêu `<= 3s`; trường hợp vượt cap trả lỗi nhanh.
- Không regression luồng dùng OCR crop, upload replacement, AI TeX source editor,
  overview dialog và student Summary.

## 9. Giả định cần owner duyệt cùng kế hoạch

- V1 chỉ chỉnh asset `TEXTBOOK_SOURCE`, không mở cho `ADMIN_UPLOAD` chung.
- Output sau chỉnh dùng WebP lossless để tránh thêm một vòng nén mất dữ liệu;
  dung lượng có thể tăng so với WebP quality 92.
- Không lưu mask và chưa có nút phục hồi revision cũ; revision history vẫn giữ
  dữ liệu để có thể bổ sung restore sau này.
- Không có slider cường độ làm nét ở v1; dùng một preset bảo thủ để UI dễ hiểu và
  giảm nguy cơ làm hỏng nét/ký hiệu toán học.
