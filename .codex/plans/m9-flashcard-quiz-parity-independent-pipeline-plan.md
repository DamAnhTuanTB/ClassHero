# Kế hoạch triển khai Flashcard tương đồng Quiz với pipeline độc lập

Trạng thái: đang triển khai theo các yêu cầu owner đã duyệt
Phạm vi: Flashcard admin generation/review, figure Phase 2, student delivery và hardening
Task đề xuất: `M9.28` → `M9.29` → `M9.30` → `M9.31`
Mode đề xuất: Full-stack theo từng task, không gom cả bốn task vào một lượt triển khai

## 1. Mục tiêu

Đưa Flashcard đạt mức hoàn thiện tương đồng với Quiz ở các phần:

- cấu hình và preview lượt sinh AI;
- chọn đúng bộ đích và sinh thêm thẻ vào bộ đang mở;
- pipeline hai phase: Phase 1 sinh nội dung/quyết định hình, Phase 2 sinh hình;
- trạng thái job, usage/cost, lịch sử lượt gọi;
- xem UI, xem JSON, chỉnh sửa, duyệt từng thẻ và duyệt hàng loạt;
- vòng đời hình: tạo, xem trạng thái, sửa code, tinh chỉnh AI, sinh lại, upload, đổi caption và xóa;
- publish/thu hồi, reserve/request-new và giao diện học sinh;
- audit, optimistic concurrency, idempotency, cleanup và test.

Khác biệt nghiệp vụ duy nhất so với Quiz:

- Flashcard không có bốn loại câu hỏi;
- mỗi item luôn là một thẻ ghi nhớ: mặt trước đặt câu hỏi trực tiếp hoặc câu hỏi
  trong tình huống thực tế có neo kiến thức, mặt sau trả lời trực tiếp câu hỏi đó;
- một thẻ gồm `front`, `back`, `solution`, `difficulty` và provenance cần thiết;
- không có `questionType`, options/statements, đáp án chấm điểm, hint, attempt answer hay score;
- thao tác học sinh là lật thẻ và đánh dấu thuộc/chưa thuộc, không phải làm và chấm câu hỏi.

Ngoài khác biệt trên, chức năng, thứ tự flow, trạng thái, mức cấu hình và giao
diện Flashcard phải giữ parity với Quiz. “Độc lập” ở đây là độc lập implementation
và dữ liệu; không có nghĩa là làm một phiên bản Flashcard rút gọn.

## 2. Hiện trạng đã đối chiếu

### 2.1. Phần đã có

- `M6.3` đã có CRUD bộ Flashcard/thẻ, rich content mặt trước/mặt sau, lời giải, review status, student session/progress/favorite và request-new.
- `M9.3` đã có một lượt AI cơ bản sinh `title/cards`, validate số lượng/độ khó, lưu provenance từ chunks và tạo một bộ mới.
- Cài đặt AI đã có route `FLASHCARD/TEXT` và `FLASHCARD/IMAGE` độc lập từ `M9.20`, nhưng Flashcard chưa enqueue Phase 2 tạo hình.
- Admin UI đã có tab/bộ/thẻ và editor cơ bản; student UI đã có runner lật thẻ và progress.

### 2.2. Khoảng trống so với Quiz

- Flashcard hiện đang dùng chung `LessonContentGenerationService`, output schema, mapper và common prompt với Test; chưa đạt yêu cầu domain độc lập.
- Mỗi lượt sinh Flashcard hiện tạo một set mới; chưa chọn/append vào set đang mở như Quiz.
- DTO generate mới có `cardCount` và `difficulty`; chưa có source selection, model override hai phase, prompt preview/draft/hash và target set.
- Chưa có schema quyết định hình ở Phase 1 và chưa có worker/queue/storage/database/API riêng cho hình Flashcard.
- Chưa có JSON review/projection, per-card generation issue, item review đầy đủ và bộ công cụ figure tương đương Quiz.
- Student serializer chưa có asset hình minh họa lời giải Flashcard.

## 3. Invariant kiến trúc bắt buộc

### 3.1. Độc lập domain

Flashcard phải sở hữu riêng toàn bộ logic nghiệp vụ:

- module, controller, DTO và API contract;
- input/output Zod schema và provider JSON Schema;
- subject resolver/profile;
- system prompt theo từng môn và user prompt builder;
- context/source packet builder;
- generation job input, mapper, semantic validation và persistence projection;
- worker generation Phase 1;
- figure module, figure prompt, figure job và figure worker Phase 2;
- database tables/enums cho figure và revision;
- frontend API client, hook, schema form, modal generation, JSON review và figure UI;
- test fixtures, regression tests và observability labels.

Không được import private/domain logic từ:

- `quiz/*` hoặc `quiz-figures/*`;
- `lesson-summary-*` hoặc `stem-figures/*`;
- `lesson-content-generation-*` hiện đang ghép Flashcard với Test.

Sau hard-cutover, việc Quiz thêm loại câu hỏi, đổi scoring hoặc đổi schema lời giải không được làm Flashcard build/test thay đổi. Tương tự, thay đổi Flashcard front/back không được tác động Quiz hoặc Summary.

### 3.2. Phần được phép dùng chung

Chỉ dùng chung hạ tầng không mang nghĩa nghiệp vụ:

- `AiProvider`/provider routing, reservation và usage accounting;
- BullMQ primitives, job lifecycle và generic retry policy;
- Prisma transaction helper, audit helper và API error envelope;
- R2/file delivery và signed URL primitives;
- TeX compiler client/transport và validator cấp thấp không chứa policy Quiz/Summary;
- rich-text/KaTeX renderer primitives, form primitives và status badge primitives;
- generic optimistic lock, polling và query invalidation utilities.

Nếu một helper dùng chung chứa enum, prompt text, role, field hoặc rule của Quiz/Summary thì không được dùng cho Flashcard; phải tách phần hạ tầng thuần hoặc viết implementation Flashcard riêng.

## 4. Contract chức năng mục tiêu

### 4.1. Bộ Flashcard

- Lesson có thể có nhiều bộ `Bộ flashcard 1`, `Bộ flashcard 2`, ... như hiện tại.
- Modal `Tạo Flashcard` có select `Bộ flashcard được chọn`, mặc định là tab admin đang mở.
- Một lượt AI append đúng `N` thẻ vào bộ đã chọn; chỉ tạo `Bộ flashcard 1` khi lesson chưa có bộ nào.
- CTA `Tạo Flashcard` luôn còn sau khi job hoàn tất để admin sinh thêm vào bộ hiện tại.
- Set giữ state tương đồng Quiz: draft/review/published/withdrawn theo contract hiện có hoặc migration state machine được chốt ở task đầu.
- Duyệt thẻ không tự publish bộ; publish là action riêng và chỉ đưa các thẻ `APPROVED` xuống student.

### 4.2. Một thẻ Flashcard

Contract Phase 1 tối thiểu:

```ts
type GeneratedFlashcard = {
  front: string;
  back: string;
  solution: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  sourcePacketPageNumbers: number[];
  requiresSolutionFigure: boolean;
};
```

Quy tắc:

- `front` luôn là câu hỏi kiểm tra đúng một đơn vị kiến thức hoặc cách áp dụng đơn
  vị kiến thức đó trong tình huống thực tế; phải ngắn, đơn nghĩa, có dấu hỏi/cấu
  trúc yêu cầu rõ ràng và không vô tình lộ `back`.
- `back` luôn là câu trả lời trực tiếp, ngắn gọn và đúng với câu hỏi ở
  `front`; ưu tiên định nghĩa, tính chất, công thức, điều kiện áp dụng, quan hệ
  hoặc cách diễn đạt của nguồn.
- Không sinh bài tập cần tính toán dài, không biến mặt trước thành câu Quiz có
  phương án/mệnh đề/đáp án nhập, và không đặt hai câu hỏi không liên quan trên
  cùng một thẻ.
- `solution` trả lời đầy đủ trực tiếp cho chính câu hỏi ở `front` theo phong cách
  lời giải Quiz, nêu căn cứ, lập luận, công thức/điều kiện áp dụng khi cần và kết
  luận câu hỏi. Không lấy `back` làm tiền đề để diễn giải; `back` chỉ là đáp án
  rút gọn để đối chiếu kết quả cuối. Câu hỏi thực tế phải thực sự vận dụng một
  neo kiến thức của PDF nguồn.
- Không có enum loại thẻ và không có `hint`.
- `difficulty` phản ánh độ sâu của việc nhớ–hiểu–liên hệ, không được nâng mức chỉ bằng cách viết dài.
- AI tạo nội dung chỉ trả một quyết định `requiresSolutionFigure`. Chỉ bật khi
  hình giúp lời giải chi tiết làm rõ đối tượng, quan hệ, cấu trúc, quy trình,
  đồ thị, bảng hoặc lập luận trực quan mà chữ/công thức đơn thuần khó truyền đạt.
- Không tạo hình cho riêng mặt trước hoặc mặt sau, không tạo hình trang trí và
  không lặp lại nguyên văn nội dung chữ.
- Figure decision chỉ là boolean; lượt tạo nội dung không trả TikZ, drawing
  brief, SVG, URL hoặc source code hình.

## 5. Pipeline AI hai phase

### 5.1. Preview và immutable draft

Modal `Tạo Flashcard bằng AI` phải giống modal `Tạo Quiz bằng AI` về component,
kích thước, bố cục, thứ tự section, validation, trạng thái, sticky footer và hành
vi preview/submit. Chỉ được bỏ khối `Loại câu hỏi`; không được tự rút gọn các
phần còn lại.

Ánh xạ field bắt buộc:

| Modal Quiz                                              | Modal Flashcard                           |
| ------------------------------------------------------- | ----------------------------------------- |
| Bộ câu hỏi được chọn                                    | Bộ flashcard được chọn                    |
| Tài liệu dùng để tạo                                    | Tài liệu dùng để tạo                      |
| Số câu hỏi                                              | Số thẻ ghi nhớ                            |
| Số câu thực tế                                          | Số thẻ thực tế                            |
| Mức độ                                                  | Mức độ                                    |
| Dễ / Trung bình / Khó                                   | Dễ / Trung bình / Khó                     |
| Loại câu hỏi (4 lựa chọn)                               | Không có section tương ứng                |
| Cách trình bày + preset                                 | Cách trình bày + cùng preset              |
| Yêu cầu bổ sung                                         | Yêu cầu bổ sung                           |
| Phase 1 · Model tạo nội dung Quiz                       | Phase 1 · Model tạo nội dung Flashcard    |
| Phase 2 · Model tạo hình Quiz                           | Phase 2 · Model tạo hình Flashcard        |
| Xem system prompt/user prompt/request/schema/token/cost | Giữ đầy đủ, dùng contract Flashcard riêng |
| Hủy / Bắt đầu tạo                                       | Hủy / Bắt đầu tạo                         |

Modal Flashcard có đầy đủ cấu hình:

- bộ đích;
- số thẻ;
- difficulty;
- tài liệu nguồn của đúng lesson;
- model/temperature/reasoning/max output token cho Phase 1;
- model/temperature/reasoning/max output token cho Phase 2;
- system prompt và yêu cầu bổ sung theo từng lượt;
- preview request, schema, input breakdown, token/cost estimate;
- preview không gọi provider và không phát sinh chi phí.

`Số thẻ thực tế` và phân bổ `Dễ/Trung bình/Khó` phải dùng cùng validation và
cách tự tính như Quiz, chỉ đổi tên field/domain. Tổng ba mức phải khớp số thẻ
thực tế trước khi cho submit. Không thêm selector loại thẻ để thay thế selector
4 loại câu hỏi đã bỏ.

Backend tạo immutable draft/hash chứa source snapshot, target set, config, prompt, provider route của cả hai phase và optimistic version. Generate request phải gửi lại draft/hash; backend reject stale draft khi set/source/config đã đổi.

### 5.2. Phase 1 — sinh nội dung và quyết định hình

Luồng:

```txt
lesson + document selection
  -> Flashcard context builder riêng
  -> Flashcard subject-owned prompt/schema riêng
  -> provider route FLASHCARD/TEXT
  -> strict Zod/JSON Schema validation
  -> semantic validation + deterministic text normalization
  -> persist cards + working generation JSON
  -> enqueue một figure job lời giải khi `requiresSolutionFigure=true`
```

Yêu cầu:

- chỉ dùng context đúng lesson/tài liệu đã chọn;
- giữ source hash, chunk IDs và page/document metadata phục vụ review/debug;
- gửi danh sách Flashcard đang tồn tại trong lesson ở payload rút gọn để tránh thẻ trùng/gần trùng;
- không gửi lời giải/provenance nhạy cảm không cần thiết vào khối chống trùng;
- số lượng output phải đúng tuyệt đối;
- thẻ sai schema hoặc sai nghĩa bị reject trước persistence; warning có thể review được phải gắn đúng card index;
- output JSON sau khi persist là working snapshot, có thể project lại records khi admin lưu JSON như Quiz.

### 5.3. Phase 2 — tạo hình minh họa lời giải

Mỗi thẻ có `requiresSolutionFigure=true` tạo một logical figure/job role
`SOLUTION` độc lập:

```txt
Flashcard đã persist
  -> build request từ `solution` và câu hỏi `front` để kiểm chứng ngữ cảnh
  -> provider route FLASHCARD/IMAGE
  -> Flashcard solution-figure schema/prompt riêng theo subject × operation
  -> TeX/TikZ compile + validate + tối đa một AI repair mặc định
  -> upload preview/delivery lên R2
  -> cập nhật revision/current asset và usage
```

Quy tắc:

- Hình `SOLUTION` minh họa cho lời giải chi tiết; authority nội dung là
  `solution > front`, không dùng `back` làm nguồn thay thế cho lời giải.
- Có đúng một logical figure lời giải cho mỗi thẻ; figure có thể có nhiều
  revision nhưng chỉ một current revision thành công.
- Modal hỗ trợ `REGENERATE`; khi current revision là AI_TEX và còn source hợp
  lệ thì thêm `EDIT_CURRENT`, dùng cùng builder, validator và worker với luồng
  tạo tự động.
- Không dùng ảnh/crop SGK trong lượt AI mặc định nếu muốn giữ parity hiện tại của Quiz; việc hỗ trợ crop nguồn phải là task/decision riêng.
- Card text vẫn được lưu khi figure thất bại; set/card giữ `NEEDS_REVIEW`, UI
  hiển thị lỗi hình lời giải và publish bị chặn nếu card approved còn figure
  bắt buộc chưa có current revision thành công.
- Retry hạ tầng không gọi lại Phase 1; retry/repair chỉ tác động figure/revision tương ứng.

## 6. Database và migration

### 6.1. Bổ sung domain figure riêng

Đề xuất thêm:

- `FlashcardFigureRole`: runtime mới dùng `SOLUTION`; `FRONT`/`BACK` chỉ giữ để
  đọc dữ liệu legacy mà không xóa phá hủy;
- `FlashcardFigureStatus`;
- `FlashcardFigureRevisionStatus`;
- `FlashcardFigureSourceKind`;
- `FlashcardFigureRevisionOrigin`;
- `FlashcardFigureAttemptKind`;
- `FlashcardFigureAttemptStatus`;
- `flashcard_figures`;
- `flashcard_figure_revisions`;
- `flashcard_figure_render_attempts`.

Các bảng phải tương đồng về capability với Quiz nhưng có foreign key, enum,
select, serializer và service riêng. Unique active identity là
`(flashcard_id, role)`; luồng mới chỉ tạo một logical figure `SOLUTION` cho mỗi
thẻ nhưng figure có thể có nhiều revision.

### 6.2. Metadata generation

Mở rộng dữ liệu Flashcard để lưu:

- `aiGenerationId` và `generationCardIndex` ở card/source metadata;
- figure decision snapshot;
- semantic issues theo card;
- provider schema/prompt version;
- working output hash;
- target set snapshot và Phase 1/Phase 2 route snapshot ở job/generation.

Không tái sử dụng `QuizFigure`, `StemFigure` hoặc foreign key của hai domain đó.

### 6.3. Migration an toàn

- Chỉ migration additive ở bước đầu; Flashcard cũ không có figure vẫn đọc/học bình thường.
- Không backfill hình và không gọi provider để xử lý dữ liệu cũ.
- `hint_json` tiếp tục là legacy nullable nhưng không đọc/ghi trong contract mới.
- Personal learning-path clone phải clone Flashcard figure/revision/delivery metadata hợp lệ hoặc cố ý không clone theo một rule được test và ghi docs; không được để foreign key trỏ sang lesson gốc.
- Hard delete/soft delete set/card phải cascade hoặc cleanup figure, revision, render attempt và orphan delivery đúng policy.

## 7. API mục tiêu

### 7.1. Generation

- `POST /admin/lessons/:lessonId/flashcard-generation/preview`
- `POST /admin/lessons/:lessonId/flashcard-generation`
- body có `targetFlashcardSetId`, `cardCount`, `difficulty`, `documentIds`, prompt override và route override hai phase;
- response preview gồm request/schema/input/token/cost/draft hash, không gọi provider;
- generate trả `202` với job ID và target set ID.

### 7.2. Review và JSON projection

- GET working generation JSON theo set/generation;
- PATCH working generation JSON với optimistic hash;
- POST review một card;
- POST bulk review các card pending trong set;
- publish/withdraw set theo state machine;
- generation issues gắn global hoặc `generationCardIndex` như Quiz.

Khi lưu JSON, backend project `front/back/solution/difficulty/figure decisions` vào records trong một transaction, giữ provider-only fields cần audit và tính lại output hash. Figure asset/source không được sửa trực tiếp bằng JSON editor.

### 7.3. Figure lifecycle

Route nằm dưới namespace Flashcard, ví dụ:

- list/detail/status theo card;
- create AI preview/create cho hình minh họa `SOLUTION`, nhận mode
  `REGENERATE|EDIT_CURRENT`;
- code draft/compile/apply;
- AI refine/regenerate preview/submit;
- attach upload;
- update caption;
- soft delete/restore nếu contract cần;
- revision history và request/usage detail.

Mọi mutation dùng optimistic guard (`expectedRevisionId`/version). Response
student chỉ trả current delivery asset lời giải đã thành công; không lộ source
code, prompt, provider payload hoặc revision nội bộ.

## 8. Worker, queue và lifecycle

- Tạo `FlashcardGenerationService` riêng và chuyển dispatch `FLASHCARD` khỏi `LessonContentGenerationService`.
- Tạo queue/job name và processor `FLASHCARD_FIGURE_RENDERING` riêng.
- Tạo `FlashcardFigureRenderingWorkerService` riêng; không gọi `QuizFigureRenderingWorkerService` hay `StemFigureRenderingWorkerService`.
- Job key/idempotency bao gồm generation ID, card ID, role và revision ID.
- Mỗi provider call ghi feature `FLASHCARD`, purpose `TEXT` hoặc `IMAGE`, operation cụ thể, usage, latency, cache tokens và estimated/actual cost.
- Failure phải phân biệt provider, schema, semantic, compiler, validator, upload và stale-write.
- Regenerate whole set/card phải cleanup hoặc supersede figure cũ trong transaction trước khi enqueue revision mới.
- Sau mọi thay đổi worker, bắt buộc restart `pnpm dev`/worker container và chạy boot smoke test.

## 9. Admin UI

### 9.1. Parity về trải nghiệm

Giữ shell/pattern đã chốt của Quiz:

- tab các bộ;
- thanh số thứ tự thẻ, chỉ render thẻ đang chọn;
- modal tạo AI với bộ đích và cấu hình hai phase;
- job polling/progress và lịch sử usage;
- ba chế độ `Chỉ xem UI`, `Chỉ xem JSON`, `Song song`;
- banner warning `Cần admin kiểm tra` và action `Chấp nhận`;
- `Duyệt tất cả`, `Lưu`, `Phát hành`, `Thu hồi phát hành`;
- responsive mobile/tablet/desktop, light/dark và lazy-load editor/modal.

Modal tạo AI là parity bắt buộc, không chỉ “tương tự về ý tưởng”:

- giữ nguyên chiều rộng/chiều cao tối đa, vùng cuộn, khoảng cách, border, màu
  Phase 1/Phase 2, sticky action footer và breakpoint responsive của Quiz;
- dùng cùng primitive/component trình bày nếu component đó không chứa logic
  domain; Flashcard truyền schema, label và state riêng;
- mọi field, tooltip, preset, validation, preview drawer/dialog, loading,
  disabled, stale draft, error và close-confirmation của Quiz đều phải có ở
  Flashcard, ngoại trừ toàn bộ section chọn bốn loại câu hỏi;
- snapshot test hoặc Playwright phải so sánh cấu trúc hai modal và fail nếu một
  field chung bị thêm/xóa ở Quiz mà Flashcard chưa được đánh giá parity.

Phần hiển thị phải dùng copy và hành vi Flashcard:

- preview hai mặt và action lật thẻ;
- editor riêng cho `Mặt trước`, `Mặt sau`, `Giải thích`;
- badge độ khó, provenance và review status;
- một figure action trên header thẻ, mở danh sách có duy nhất `Tạo ảnh cho lời giải`;
- không hiển thị question type, options, correct answer, hint hay score.

### 9.2. Figure UI

- Figure `SOLUTION` có status/preview/action độc lập với Quiz và Summary.
- Menu tạo ảnh giữ cùng pattern Quiz nhưng chỉ có một lựa chọn
  `Tạo ảnh cho lời giải`.
- Modal luôn có lựa chọn tạo mới; khi đã có current AI_TEX source hợp lệ thì
  hiện thêm `Chỉnh sửa hình hiện tại`.
- Tương đồng capability Quiz: tạo mới AI, sửa mã, chỉnh nhanh, tinh chỉnh AI, sinh lại, upload, đổi caption, xóa và xem usage/request.
- Có thể chia sẻ component primitives thật sự generic; orchestration, hook, API client và state machine phải nằm trong feature Flashcard.
- UI không được gọi trực tiếp provider; mọi preview và mutation đi qua API Flashcard.

## 10. Student UI và tiến trình học

- Sau khi lật, student hiển thị `back`, `solution` và figure `SOLUTION` theo
  interaction hiện tại; mặt trước không có figure riêng.
- Preload asset lời giải có kiểm soát để thao tác lật không giật nhưng không tải
  toàn bộ bộ ảnh ngay khi lesson mở.
- Alt text/caption có semantic HTML; hình dùng surface sáng khi dark mode nếu asset chưa có dark variant.
- Existing session/progress/favorite/history tiếp tục hoạt động; thay đổi nội dung hoặc hình không được làm hỏng snapshot session đang học.
- Chỉ set/card approved, không reserve và asset current hợp lệ mới đến student.
- Request-new reserve-first vẫn dùng Flashcard pipeline riêng và không sinh nhầm vào set admin đang mở.

## 11. Chia task triển khai

### `M9.28` — Flashcard AI generation foundation độc lập

Mode: Full-stack (API + Worker + Admin UI + docs/test)

Phạm vi:

- tách Flashcard khỏi shared generation với Test;
- schema/prompt/context/job/mapper/validator/persistence riêng;
- target set + append behavior;
- preview/draft/hash, two-phase config snapshot;
- working JSON, per-card issue, item/bulk review;
- modal admin và three-mode review chưa có hình;
- cập nhật DB/API/AI/UI/performance/source-structure docs.

Done khi:

- Flashcard sinh đúng N card vào đúng set;
- code architecture test chặn import domain Quiz/Summary/Test;
- preview không gọi provider;
- CRUD/review/publish và dữ liệu cũ vẫn chạy;
- API/web typecheck, focused unit/integration/Playwright và worker boot pass.

### `M9.29` — Flashcard figure Phase 2 độc lập

Mode: Full-stack (DB + API + Worker + R2 + docs/test)

Phạm vi:

- một boolean `requiresSolutionFigure` ở lượt tạo nội dung;
- bảng/enums figure/revision/attempt riêng;
- prompt/schema solution figure riêng theo từng subject;
- queue/processor/worker TeX/TikZ riêng;
- compile/repair/upload/current asset/usage;
- student serialization cơ bản cho current asset lời giải.

Done khi:

- decision `false/true` enqueue đúng 0/1 figure lời giải;
- hình bám `solution > front` và không dùng `back` thay cho lời giải;
- failure một figure không mất card text và không gọi lại Phase 1;
- publish gate, cleanup, clone và concurrency được test;
- không gọi provider trả phí trong verification mặc định.

### `M9.30` — Admin figure authoring và review parity

Mode: Full-stack (API + Admin UI + docs/test)

Phạm vi:

- status/polling/overview;
- create AI, edit code, compile/apply, quick edit, refine/regenerate, upload, caption, delete;
- request preview và usage/cost theo asset;
- UI một figure lời giải, responsive/light/dark;
- reuse generic primitives nhưng giữ orchestration Flashcard riêng.

Done khi:

- mọi action vận hành trên logical figure `SOLUTION` độc lập;
- stale guard không ghi đè revision mới;
- closing/reopening giữ đúng draft/current asset;
- Playwright phủ desktop/tablet/mobile và visual QA bằng mắt.

### `M9.31` — Student delivery, reserve flow và hardening

Mode: Full-stack (API + Student UI + Worker hardening + docs/test)

Phạm vi:

- render/lazy preload hình lời giải trong runner;
- session snapshot compatibility;
- reserve/request-new pipeline mới;
- cleanup/regenerate/delete/clone;
- observability, budget reservation và performance;
- full regression và rollout checklist.

Done khi:

- student học bộ text-only và có hình không lỗi;
- request-new tạo đúng reserve set;
- existing sessions/history/progress/favorite không regression;
- usage/budget/audit tách Phase 1/Phase 2;
- full API/web/worker tests và visual realtime QA pass.

## 12. Test matrix bắt buộc

### 12.1. Unit/architecture

- strict provider schema: field thừa, thiếu `requiresSolutionFigure`, sai difficulty, sai count;
- semantic rule `front` là câu hỏi kiểm tra một đơn vị kiến thức, không lộ `back`; `back` trả lời
  trực tiếp câu hỏi đó; back/solution nhất quán;
- decision `false/true` và enqueue đúng 0/1 figure lời giải;
- prompt/schema version theo `MATH/PHYSICS/CHEMISTRY/GENERAL`;
- source scope và duplicate avoidance;
- forbidden imports giữa Flashcard và Quiz/Summary/Test;
- figure role `SOLUTION` isolation và authority `solution > front`.

### 12.2. Database/API/integration

- append vào set được chọn, set mặc định khi lesson chưa có set;
- transaction projection JSON → card/explanation/decision;
- review card/bulk/publish/withdraw;
- figure lifecycle, revision, stale guard, retry và cleanup;
- old Flashcard không figure vẫn serialize đúng;
- personal path clone không giữ foreign key về bản gốc;
- student authorization, reserve filtering và signed delivery URL;
- provider reservation/usage tách `TEXT`/`IMAGE`.

### 12.3. UI/Playwright

- generation modal và preview trên desktop/tablet/mobile;
- parity contract giữa modal Quiz và Flashcard: cùng thứ tự section/field/state,
  chỉ thiếu section bốn loại câu hỏi và đổi label theo domain;
- target set giữ đúng qua mở/đóng/reload;
- job queued/running/succeeded/failed/retry;
- UI/JSON/Song song và unsaved change guard;
- front/back edit, flip và figure action lời giải;
- empty/loading/error/partial figure states;
- dark/light, keyboard, focus, alt/caption và touch target;
- student lật thẻ text-only và thẻ có hình lời giải.

### 12.4. Provider live test

Không gọi provider trả phí trong các task mặc định. Sau khi local/integration pass, nếu owner cho phép rõ ràng:

- chạy sample nhỏ 4–8 card trên một lesson;
- phủ ít nhất một case không cần hình và một case cần hình lời giải;
- báo trước token/cost estimate;
- kiểm bằng mắt prompt output, nội dung thẻ, figure bám lời giải, compile asset và student display;
- chỉ chạy full lesson sau khi sample được owner chấp nhận.

## 13. Rollout và tương thích

1. Merge migration additive và deploy API đọc được cả record cũ/mới.
2. Deploy `M9.28` hard-cutover Flashcard Phase 1 cùng web/worker; restart worker.
3. Deploy `M9.29` figure persistence/worker với generation figure có thể tạm feature-flag nếu cần.
4. Deploy `M9.30` authoring UI sau khi API lifecycle ổn định.
5. Deploy `M9.31` student delivery và bật rộng sau regression.
6. Theo dõi tỷ lệ schema reject, semantic warning, figure compile/repair/fail, latency, token và cost theo phase.
7. Rollback code không xóa bảng/cột additive; tắt enqueue figure vẫn giữ Flashcard text hoạt động.

## 14. Rủi ro và cách kiểm soát

- **Sao chép cả module Quiz gây coupling ngầm:** thêm architecture test và review import graph.
- **Hình không bám lời giải:** subject-owned prompt đặt authority
  `solution > front`, semantic fixture và visual review.
- **Chi phí tăng do quyết định hình quá rộng:** prompt chỉ bật khi hình có giá
  trị giải thích; preview cost theo số candidate và admin thấy count trước submit.
- **Job cũ chạy sau deploy:** input schema version + compatibility reader hoặc cancel có kiểm soát; không âm thầm parse sai.
- **Figure fail làm kẹt cả bộ:** card text vẫn tồn tại, failure gắn đúng figure
  lời giải, admin retry/upload/delete; publish gate có lý do rõ.
- **Clone/delete để orphan asset:** integration test transaction + cleanup job idempotent.
- **UI parity biến thành import Quiz feature:** chỉ share primitives không mang domain semantics; hook/state/API Flashcard riêng.

## 15. Các quyết định mặc định của kế hoạch

- Flashcard chỉ có một loại hình AI: hình minh họa cho `solution`; mỗi thẻ tối đa
  một logical figure `SOLUTION`.
- Mặt trước chỉ hỏi lý thuyết; mặt sau trả lời lý thuyết đó. Flashcard không được
  dùng bốn kiểu câu hỏi hoặc ngụy trang bài Quiz thành thẻ ghi nhớ.
- Modal AI Flashcard giống modal AI Quiz ở mọi phần còn lại; section `Loại câu
hỏi` bị bỏ hoàn toàn và không được thay bằng `Loại thẻ`.
- Lượt AI mặc định vẽ figure mới như Quiz, không dùng crop ảnh SGK.
- Lượt generate append vào set được chọn; không tự tạo set mới nếu lesson đã có set.
- Working JSON được phép sửa nội dung và `requiresSolutionFigure` nhưng không
  chứa/chỉnh source code hay asset figure.
- `solution` là lời giải chi tiết trực tiếp của câu hỏi ở `front`, không phải
  `hint`; `back` vẫn giữ vai trò đáp án trực tiếp.
- Hệ thống cũ tiếp tục đọc được; không backfill hình và không gọi provider trong migration.

## 16. Tài liệu phải cập nhật khi owner duyệt triển khai

- `docs/01-product-scope.md`
- `docs/02-user-flows.md`
- `docs/04-database-model.md`
- `docs/database/quiz-flashcard-tests.md`
- `docs/05-api-contract.md`
- `docs/api/quiz-flashcard-tests.md`
- `docs/06-ai-rag-spec.md`
- `docs/08-ui-pages-and-components.md`
- `docs/09-implementation-plan.md`
- `docs/implementation/M9.md`
- `docs/implementation/dependency-graph.md`
- `docs/implementation/feature-coverage-matrix.md`
- `docs/10-seed-data-and-test-cases.md`
- `docs/12-performance-and-observability.md`
- `docs/14-source-code-structure.md` nếu module boundary/shared primitive thay đổi

## 17. Lệnh triển khai đề xuất sau khi duyệt

Thực hiện theo thứ tự, mỗi lần chỉ một subtask:

```text
/task-full M9.28
/task-full M9.29
/task-full M9.30
/task-full M9.31
```

Không bắt đầu `M9.29` trước khi contract Phase 1, target set, working JSON và review state của `M9.28` đã ổn định.
