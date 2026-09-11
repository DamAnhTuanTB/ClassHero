# Database Learning Paths And Lessons

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 5. Learning paths, chapters và lessons

### 5.1. `learning_paths`

```txt
id uuid pk
kind LearningPathKind default CATALOG
source_learning_path_id uuid? fk learning_paths.id
domain_id uuid fk domains.id
title string
slug string unique
original_price_vnd int
sale_price_vnd int?
total_chapter_count int default 0
total_lesson_count int default 0
thumbnail_file_id uuid? fk files.id
description_json jsonb?
start_date date?
end_date date?
lesson_count_min int?
lesson_count_max int?
status PublishStatus default DRAFT
published_at timestamp?
sort_order int default 0
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 5.1.1. `learning_path_target_audiences`

UI/API tạo và sửa khóa học hiện bắt buộc đúng một Đối tượng hướng đến. Bảng nối vẫn được giữ để không phá dữ liệu lịch sử và cho phép migration không mất dữ liệu; contract ghi mới giới hạn một liên kết cho mỗi khóa học.

```txt
learning_path_id uuid fk learning_paths.id
target_audience_id uuid fk target_audiences.id
created_at timestamp
```

Constraint/index:

- primary key `(learning_path_id, target_audience_id)`.
- index `(target_audience_id, learning_path_id)` để filter catalog theo đối tượng.
- xóa learning path cascade các liên kết; không được xóa target audience đang được khóa học sử dụng.

### 5.0. Catalog khóa học

- `domains`: lĩnh vực động do admin quản lý (`name`, `slug`, `sort_order`); `sort_order` là thứ tự catalog và là khóa sắp xếp đầu tiên khi hiển thị khóa học theo lĩnh vực.
- `target_audiences`: các đối tượng hướng đến seed sẵn Khối 3–12, Khối Tiểu học,
  Khối THCS, Khối THPT, Toàn khối và Người đi làm; `grade` chỉ có với nhóm
  theo từng khối cụ thể để ưu tiên catalog cho học sinh.
- `status`.
- `sort_order`.
- `(kind, status)`.
- `source_learning_path_id`.

Thứ tự catalog khóa học mặc định: `domains.sort_order ASC`, sau đó `learning_paths.sort_order ASC`, rồi mốc phát hành/tạo mới để kết quả ổn định.

Status behavior:

- `DRAFT` là trạng thái mặc định khi tạo lộ trình.
- `ARCHIVED` chỉ dùng cho xóa mềm; không nằm trong danh sách quản trị mặc định.
- Khôi phục lộ trình archived đưa `status` về `DRAFT` và clear `deleted_at`/`published_at` nếu có.
- Xóa vĩnh viễn chỉ thực hiện từ thùng rác quản trị với item đang archived; cần audit log và tuân thủ chính sách retention khi nối backend thật.
- `CATALOG` là khóa học có thể xuất hiện trong catalog và được mua.
- `PERSONALIZED` là private fork của một khóa `CATALOG`; bắt buộc có `source_learning_path_id`, không được xuất hiện trong catalog và không thể tạo payment/enrollment trực tiếp.
- Bản `PERSONALIZED` dùng slug nội bộ opaque nếu schema vẫn bắt buộc slug; public/student route không được dùng slug này để discovery.
- `start_date` và `end_date` là ngày lịch tùy chọn của khóa học chính; nếu cùng tồn tại, `end_date` không được sớm hơn `start_date`. Chúng hiện là metadata lịch học, chưa tự thay đổi quyền truy cập/enrollment.
- `lesson_count_min` và `lesson_count_max` là khoảng số buổi học dự kiến tùy chọn (1-500), tách biệt với `total_lesson_count` là số buổi thực tế hệ thống đếm. Nếu cùng tồn tại, giá trị max không được nhỏ hơn min.

### 5.2. `learning_path_chapters`

Chương học là lớp nhóm tổng quan trong lộ trình. Chương không có video, tài liệu/PDF riêng, summary học tập riêng, quiz, flashcard hoặc test.

```txt
id uuid pk
learning_path_id uuid fk learning_paths.id
source_chapter_id uuid? fk learning_path_chapters.id
order_index int
title string
overview string?
objectives_json jsonb?
status PublishStatus default DRAFT
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Constraint:

- unique `(learning_path_id, order_index)`.
- index `source_chapter_id`.

Rules:

- `overview` là mô tả/tổng quan ngắn của chương.
- `objectives_json` lưu các mục tiêu học tập chính hoặc nội dung trọng tâm nếu admin nhập.
- Khi xóa mềm chương, backend phải xử lý các buổi học con theo policy đã chốt ở API/service; không được xóa vĩnh viễn dữ liệu học tập nếu chưa qua flow archive/retention.

### 5.3. `lessons`

```txt
id uuid pk
learning_path_id uuid fk learning_paths.id
chapter_id uuid? fk learning_path_chapters.id
source_lesson_id uuid? fk lessons.id
order_index int
title string
short_description string?
overview_content_json jsonb?
lesson_type LessonType default BASIC
live_url string?
prep_material_json jsonb?
scheduled_at timestamp?
exam_open_at timestamp?
video_url string?
completion_min_score numeric default 7
trial_enabled boolean default false
status PublishStatus default DRAFT
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Constraint:

- unique `(chapter_id, order_index)` áp dụng cho lesson có chapter.
- partial unique `(learning_path_id, order_index)` với `chapter_id IS NULL AND deleted_at IS NULL` cho các lesson top-level cùng loại.
- index `source_lesson_id`.
- index `(learning_path_id, chapter_id, order_index)` để đọc cấu trúc khóa học ổn định.

Rules:

- `chapter_id` là nullable. Buổi học có thể thuộc một chương hoặc nằm trực tiếp trong lộ trình.
- `learning_path_id` là quan hệ bắt buộc và là source of truth để xác định khóa học của lesson. Nếu có `chapter_id`, chapter phải thuộc đúng `learning_path_id`.
- Với lesson trong chapter, `order_index` là vị trí trong chapter và unique theo `chapter_id`.
- Với lesson không thuộc chapter, `order_index` là vị trí trong danh sách top-level dùng chung với `learning_path_chapters.order_index`. Vì hai loại nằm ở hai bảng, service phải giữ invariant cross-table không trùng vị trí logic và renumber cả chapter lẫn lesson top-level trong một transaction.
- Các vị trí active trong mỗi container là dãy liên tục bắt đầu từ `1`; archive/move phải compact container nguồn và dịch container đích.
- Khi tạo chapter/lesson, client không chọn `order_index`; service phải khóa cấu trúc, tự append bản ghi vào cuối container hợp lệ rồi compact/check invariant trước khi commit.
- Tên lesson active unique không phân biệt hoa/thường trong cùng nhóm đích; lesson ở các chương/nhóm khác nhau có thể trùng tên.
- `lesson_type` chỉ nhận `BASIC` hoặc `LIVE` và mặc định là `BASIC`.
- `overview_content_json` lưu tài liệu Tiptap của `Tổng quan buổi học` do admin
  nhập. Field này thuộc chính lesson và độc lập hoàn toàn với
  `lesson_video_summaries.content_json`; thao tác tạo/sửa/xóa/phát hành Video
  Summary không được thay đổi field này.
- `live_url` là optional cho buổi `LIVE`; buổi `BASIC` luôn lưu `live_url = null`.
- Admin có thể chuyển lesson tới bất kỳ vị trí nào giữa một chapter, chapter khác trong cùng learning path và top-level. Service phải validate chapter, order/title, dịch các sibling bị ảnh hưởng và cập nhật lesson trong cùng transaction.
- `custom_video_settings` (field JSON hiện có trong Prisma) có thể lưu transcript đã được admin duyệt ở `transcript: Array<{ time: number; endTime?: number; text: string }>` và ngôn ngữ ở `transcriptLanguage`; transcript là optional nên M3.8 không cần migration riêng. `time`/`endTime` lưu theo timestamp video nguồn với tối đa 3 chữ số thập phân để có thể ánh xạ lại khi cấu hình cắt thay đổi. API bản nháp và form admin hiển thị `playbackTime = sourceTime - startTimeInSeconds`; khi lưu/phát, frontend đổi ngược về source time. `endTime` optional để dữ liệu transcript cũ vẫn tương thích.
- Khi `video_url` đổi sau chuẩn hóa hoặc bị clear, service giữ các cài đặt player
  độc lập nhưng reset `chapters = []`, `transcript = []`, bỏ
  `transcriptLanguage` và hard-delete `lesson_video_summaries` của lesson trong
  cùng transaction. Không cần migration schema cho behavior này.
- Quiz, flashcard, test, document, summary, progress và AI chat vẫn gắn với `lesson_id`.
- Counter `learning_paths.total_chapter_count` và `learning_paths.total_lesson_count` phải được service cập nhật khi tạo/xóa mềm phần tử liên quan.
- Chapter/lesson được clone cho bản cá nhân giữ `source_chapter_id`/`source_lesson_id` để ánh xạ lịch sử học trước khi cá nhân hóa; lesson nguồn không thuộc chapter tiếp tục có `chapter_id = null` trong bản clone.
- Clone sao chép các bản ghi nội dung mutable cần chỉnh sửa độc lập; file R2 và OCR artifact bất biến được tham chiếu lại, không upload hoặc gọi paid OCR lần nữa chỉ vì clone.
- Dữ liệu do student tạo như progress, attempt, note, comment và favorite không được deep-copy như nội dung quản trị.

### 5.4. `lesson_materials`

Dùng cho phiếu tài liệu, ảnh, text nhập tay, link phụ.

```txt
id uuid pk
lesson_id uuid fk lessons.id
type LessonMaterialType
file_id uuid? fk files.id
url string?
title string?
content_json jsonb?
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 5.5. `lesson_summaries`

```txt
id uuid pk
lesson_id uuid unique fk lessons.id
content_json jsonb
source ContentSource default ADMIN
review_status ReviewStatus default APPROVED
ai_generation_id uuid? fk ai_generations.id
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- Mỗi lesson có tối đa một summary active nhờ unique `lesson_id`.
- Worker AI upsert summary với `source = AI`, `review_status = NEEDS_REVIEW` và
  `ai_generation_id`; admin có thể sửa/duyệt bằng cùng record sau đó.
- Khi admin sửa summary từng được AI tạo, giữ `ai_generation_id` để không mất
  provenance ban đầu.

---

### 5.6. `lesson_video_summaries` (`M9.7`, implemented)

```txt
id uuid pk
lesson_id uuid unique fk lessons.id
content_json jsonb
source ContentSource default AI
review_status ReviewStatus default NEEDS_REVIEW
ai_generation_id uuid? fk ai_generations.id
source_video_url_hash string
source_transcript_hash string
source_chapters_hash string
source_player_settings_hash string
stale_at timestamp?
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- Mỗi lesson có tối đa một video summary active. Bảng này độc lập với
  `lesson_summaries`, `lessons.overview_content_json` và
  `lessons.short_description` để không ghi đè Summary kiến thức từ PDF hoặc
  Tổng quan buổi học do admin nhập.
- `content_json` dùng contract rich text riêng của Video Summary: overview ngắn,
  objectives và sections Knowledge/Example theo thứ tự video; không có khối
  `summary` riêng. Công thức dùng node LaTeX canonical của renderer chung; M9.7
  không tạo STEM figure. Dữ liệu version cũ được lọc `summary` ở read boundary,
  không cần migration xóa JSON đã lưu.
- Bốn source hash được chụp từ dữ liệu backend đã chuẩn hóa. Thay đổi riêng
  transcript hoặc chapter đặt `stale_at`; output stale vẫn được giữ cho admin đối
  chiếu nhưng không được coi là bản mới nhất. Thay đổi/clear Video URL hard-delete
  record này vì toàn bộ output không còn thuộc cùng video.
- Worker chỉ promote bản mới sau khi structured output qua schema/semantic gate;
  job lỗi không ghi đè bản hiện hành.
- Action xóa Video Summary hard-delete bản ghi `lesson_video_summaries`; audit log
  giữ snapshot trước khi xóa. Không cascade sang transcript, chapter, video hoặc
  Lesson Summary.

`lesson_video_summary_request_drafts` lưu preview immutable gồm lesson/admin,
request hash, bốn source hash, exact system/user prompt, normalized chapter +
transcript packet, schema/version, route/model snapshot, token/cost estimate,
TTL và `consumed_at`. Generate bắt buộc draft chưa hết hạn/chưa consume và còn
khớp toàn bộ source/config.

---
