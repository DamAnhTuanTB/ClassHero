# Current Codex Context

Last updated: 2026-08-11

File này ghi trạng thái ngắn của repo để Codex bắt đầu phiên làm việc nhanh hơn. Nó không thay thế `AGENTS.md` hoặc docs gốc trong `docs/`.

## 1. Trạng thái hiện tại

- Repo dùng monorepo Turborepo với `apps/web`, `apps/api` và `packages/shared`.
- Nền local đã có Next.js app, NestJS API, shared package, Docker local, Postgres + pgvector local, Redis, env example và health/foundation code.
- Prisma foundation `M1.1` đã có nền kết nối Postgres/pgvector; `M1.2` đã thêm các model nền cho user/auth/profile/file/background job/audit log; `M1.3` đã thêm model learning path/lesson/document/enrollment/progress; `M1.4` đã thêm model quiz/flashcard/test/attempt/favorite/note/comment riêng; `M1.5` đã thêm payment/discount/webhook, notification, report, AI log/cache/chat, XP và news models; `M1.6` đã thêm seed dev tối thiểu cho admin/student/parent, Toán 7, lesson, quiz/flashcard/test, payment/enrollment và notification; `M2.1` đã chuẩn hóa backend foundation với env validation, global validation pipe, error envelope, Swagger dev và logger cơ bản; `M2.2` đã thêm AuthModule cho register student/parent, login, JWT access token, refresh token rotate/revoke và logout; `M2.3` đã thêm JWT auth guard, RBAC guard/decorator, `GET /me`, cập nhật student profile và forgot/reset password; `M2.4` đã nối auth UI với API thật cho login/register student/register parent/forgot/reset password, dùng TanStack Query mutations, lưu session/token client-side bằng Zustand + browser storage, và bổ sung explicit DTO validation pipe để auth API validate ổn khi chạy dev bằng `tsx`; `M3.1` đã thêm public published learning path API tối thiểu và admin learning path CRUD/publish API có RBAC, validation, pagination và audit log; `M3.2` đã thêm admin lesson API cho list/create/detail/update/delete/publish lesson trong learning path, có RBAC, validation video URL/order/completion score, unique order handling, total lesson count update và audit log; `M3.3` đã nâng public/student learning path API với optional auth, ưu tiên grade của student, `gradeGroups`, course summary, id-or-slug detail và active enrollment/trial state; `M3.4` đã nối UI admin `/admin/courses` với API thật, bổ sung chapter API/schema, chuyển lesson CRUD theo chapter, thêm archive/restore/permanent delete cho learning path, và upload ảnh đại diện qua FilesModule dùng local MinIO/S3-compatible storage; `M3.5` đã nối student course browsing/detail (`/student/courses`, `/student/explore`, `/student/courses/[slug]`) vào public learning path API thật, bổ sung public detail `chapters` và progress cơ bản cho authenticated student có enrollment active.
- `M3.6` đã hoàn thiện nền tảng khóa học cá nhân theo enrollment: Prisma kind/source lineage, `delivery_learning_path_id` một chiều, idempotent admin clone/get API, BullMQ clone worker, deep-copy nội dung mutable, reuse file/OCR artifact không gọi provider trả phí, migrate progress summary và atomic activation; bản cá nhân bị loại khỏi catalog/payment và không có revert/reset về khóa gốc.
- `M3.7` đã hoàn thiện UI admin quản lý lộ trình cá nhân trong commit `3f66320`: danh sách enrollment/search/filter, confirmation clone, pending/error/retry, mở editor bản cá nhân và banner riêng tư. Trạng thái cũ ghi M3.7 pending là stale và không được dùng để đề xuất lại task này.
- `M3.8` đã bổ sung luồng admin lấy caption công khai YouTube theo best-effort, lọc/ánh xạ theo khoảng phát sau cắt, duyệt/sửa/lưu transcript trong `customVideoSettings`, phát từ timestamp, highlight/auto-scroll cue đang chạy và dialog xác nhận lấy lại transcript; không có speech-to-text fallback.
- `M5.1-M5.4` đã Done: OpenAI embedding qua `AiProvider` với vector-space validation 1.536 chiều; durable embedding worker lưu lifecycle/token/latency và retry/final error; personal clone tái sử dụng vector hợp lệ rồi enqueue idempotent phần còn thiếu; retrieval pgvector + keyword chỉ dùng tài liệu active `READY` trong đúng lesson/provider/model/dimension và giữ token budget tuyệt đối. HNSW cosine index đã được phục hồi bằng migration bù; PostgreSQL isolation test và OpenAI live smoke 25 token đã pass.
- `M9.1` đã Done: `AiProvider`/`AiService` hỗ trợ OpenAI text và strict structured output; Zod là persistence gate cuối sau JSON Schema; provider trả model/request ID/token/latency; service tạo idempotent cặp `background_jobs` + `ai_generations`; AI worker đồng bộ lifecycle/retry/hash/output log và không gọi persistence khi output invalid. PostgreSQL lifecycle và OpenAI live smoke pass (74 input + 10 output tokens ở request đo usage, 2.168 ms). Gemini vẫn là placeholder chưa bật; handler summary/quiz/flashcard/test thuộc `M9.2-M9.3`.
- `M9.2` core đã Done: admin summary GET/PUT/generate API có RBAC/audit; request AI chỉ chọn active `READY` lesson documents có chunks, giới hạn 12.000 context tokens, lưu source hash và chống active job trùng. Worker tải lại context đúng lesson, reject source stale/output sai schema, gọi `AiService`, map structured summary sang Tiptap và upsert `source = AI`, `NEEDS_REVIEW`, `ai_generation_id`; admin vẫn sửa/duyệt cùng summary record. PostgreSQL API/worker integration và opt-in OpenAI lesson-summary live smoke đã pass; smoke dùng một chunk mẫu, không gọi embedding/OCR. Riêng delivery wave mở rộng coverage hình Toán 3-9 của `M9.2` vẫn `IN_PROGRESS`, chưa đủ điều kiện công bố 90-100%; xem mục resume trong phần 3 và `.codex/plans/m9-2-math-diagram-coverage-90-plan.md`.
- `M9.2` partial-block recovery đã hoàn tất ngày 2026-08-10; contract hiện tại là
  `lesson-summary-schema-v42`: một lỗi semantic/field/diagram cục bộ không còn
  làm mất toàn summary. Worker dùng transport schema trong đúng một provider
  attempt, nghiệm thu từng block, giữ hình/nội dung còn render an toàn và đính
  `reviewIssues` có lời giải thích/gợi ý sửa. Admin vẫn sửa/lưu nháp, có thể chấp
  nhận issue local; chỉ publish bị chặn khi còn issue chưa resolve. Golden block
  pass đi nguyên mapper/renderer. API focused 7 file/130 test pass; Playwright
  review và live Bài 15 `gpt-5.4` pass Chromium laptop/iPad/mobile + WebKit mobile.
  Artifact live ở `tmp/m9-2-partial-review-live/live-bai-15.json`; ảnh đã duyệt ở
  `anh-chup-hinh-toan-dat-chuan/co-che-review-tung-block/`. Lượt live artifact có
  93.647 input, 92.928 cached input, 4.125 output, 97.772 total token, 43.424 ms,
  ước tính khoảng 2.173 VNĐ; toàn lượt smoke thành công trong task khoảng
  4,3-4,5 nghìn VNĐ. Worker phải restart sau thay đổi này.
- Hotfix cùng ngày đã khóa thêm trường hợp `INTENT` hợp lệ về schema nhưng bộ
  dựng hình deterministic vẫn không thể dựng (ví dụ
  `RIGHT_TRIANGLE_CONGRUENCE` thiếu nhãn điểm). Recovery nay preflight chính bộ
  compiler rồi materialize renderer-ready spec một lần; mapper không compile
  lại. Mapper còn có terminal boundary cho từng theory/example/note/application:
  mọi exception cục bộ trở thành `DIAGRAM_CANNOT_RENDER` hoặc
  `BLOCK_CANNOT_PROCESS` tại đúng block, dùng fallback nhỏ nhất và giữ sibling.
  Chuỗi bắt buộc chỉ gồm control character cũng được phục hồi trước persist.
  Regression M9.2 pass 9 file/148 test, gồm worker persist thật; hai trạng thái
  review/placeholder pass 8 Playwright case đủ laptop, iPad, Chromium mobile và
  WebKit mobile. Không phát sinh provider call/chi phí live.
- Corrective pass partial-block recovery đã hoàn tất ngày 2026-08-10. Compiler /
  recovery tách `AUTO_FIXED`, `REVIEWABLE` và `UNRENDERABLE`; chỉ issue
  `ACCEPT_OR_FIX` có nút chấp nhận. Placeholder `Hình lỗi`/hard-error là
  `FIX_ONLY`, backend luôn ép `accepted=false` và publish guard không thể bị lách
  bằng payload client. Nút đỏ `Xóa hình lỗi` chỉ xóa visual + issue trong bản
  nháp local, giữ text/sibling, không confirm/API/autosave; reload trước Lưu phục
  hồi dữ liệu server và chỉ `Lưu nội dung` mới persist. Focused API đạt 5 file/
  125 test, integration 6/6, API typecheck đạt; Playwright review/delete 8/8 và
  artifact live 4/4 trên laptop/iPad/Chromium mobile/WebKit mobile. Live Bài 15
  gọi đúng một lần bằng `gpt-5.4-2026-03-05`, 0 issue, usage 93.647 input
  (92.928 cached) + 5.371 output, chi phí ước tính khoảng 2.640 VNĐ. Ảnh đạt ở
  `anh-chup-hinh-toan-dat-chuan/co-che-review-tung-block/`; ảnh placeholder nằm
  riêng trong `anh-chup-hinh-toan-can-sua/co-che-hinh-loi-khong-the-ve/`.
- Feedback Bài 15 ngày 2026-08-10 đã nâng prompt Summary lên
  `lesson-summary-prompt-v56`: notation góc trong text dùng `\\widehat{BAC}` với
  đỉnh ở giữa; mapper còn canonicalize `\\angle` và suy ra ba điểm từ marker khi
  provider chỉ ghi tên đỉnh. Renderer angle label đặt `x`/số đo ngay ngoài cung
  theo kích thước nhãn, thay cho khoảng cách bán kính cố định quá xa; frontend
  cũng normalize summary cũ khi render để không cần gọi lại provider.
- Corrective pass văn phong Summary dùng schema v41: context lấy grade thấp nhất
  của learning path và khóa vào source hash. Chứng minh Hình học lớp 7–9 có
  `geometryStatement` để render bảng GT–KL với đường ngăn dọc/ngang đúng SGK;
  solution dùng mạch `Xét/Ta có/Vì... nên/Suy ra/Do đó/Vậy` và không bị mapper
  hay frontend tự đổi thành bullet. Số học/Đại số giữ cách giải cũ; mọi ý a), b),
  c) vẫn bắt buộc ở dòng riêng. Thiếu GT–KL chỉ là issue `ACCEPT_OR_FIX`, không
  ẩn/placeholder example; dữ liệu lesson summary version 1/2 cũ tiếp tục đọc.
- Feedback khối note ngày 2026-08-11 nâng contract hiện tại lên prompt
  `lesson-summary-prompt-v57` / schema `lesson-summary-schema-v42`: provider bị
  cấm lặp `Chú ý`, `Lưu ý`, `Nhận xét` ở đầu `note.content`; mapper dùng shared
  normalizer trước khi persist, còn renderer dùng cùng normalizer để tương thích
  summary cũ mà không cần migration hoặc gọi lại provider.
- Owner xác nhận ngày 2026-08-11 hệ thống bao phủ học sinh lớp 3–12, gồm cả THPT.
  Prompt Summary/GT–KL và `diagramIntent.grade` hiện mới phủ đến lớp 9 là gap cần
  corrective pass; mọi thay đổi tiếp theo không được coi lớp 10–12 là ngoài scope.
- Corrective plan `M9.16` đã được lập tại
  `.codex/plans/m9-16-lesson-summary-prompt-contract-hardening-plan.md`: canonical
  contract chỉ compose một lần, admin gửi preference thay vì resolved prompt,
  preview/generate khóa request fingerprint và learner profile/GT–KL/diagram
  grade phủ lớp 3–12. Đây là task AI kế tiếp trước `M9.4`.
- Corrective schema compaction của `M9.16` đã có local gate và rollback flag
  `AI_SUMMARY_SCHEMA_REFS_ENABLED` mặc định `false`. Đường `inline` vẫn dùng nguyên
  helper OpenAI SDK; đường `ref` chỉ tuần tự hóa các sub-schema lặp thành
  `$defs/$ref`, giữ cùng Zod parser/transport/acceptance/mapper/recovery. Contract
  Summary giảm từ khoảng 329.547 xuống 33.295 ký tự (23 definitions, 213 refs),
  schema sau dereference deep-equal inline và focused 228 test pass. Ba cặp live
  A/B Bài 15 ngày 2026-08-11 bằng cùng `gpt-5.4-2026-03-05`/medium đã pass
  contract cho cả 6/6 output: 0 review issue, 0 hình bắt buộc bị thiếu và 38/38
  diagram đều có đúng hai tam giác; riêng ví dụ nguồn đều giữ đủ hai tam giác
  `ABC`/`ADC`, cạnh chung `AC`, góc vuông B/D và dấu `AB = AD`. Ref ổn định ở
  14.757 input token/lượt, inline ở 93.552 token/lượt, giảm 84,2%; latency trung
  bình gần ngang nhau (64,1 giây so với 64,2 giây). Hai cặp bổ sung đều cho cùng
  đúng hai trường hợp kiến thức từ nguồn ở cả ref/inline; cặp đầu ref từng thêm
  trường hợp “cạnh huyền và một góc nhọn” trong khi inline chỉ có hai trường hợp.
  Vì vậy technical/structural/diagram equivalence đã có bằng chứng lặp lại, nhưng
  không khẳng định text hay pedagogical content luôn giống hệt do model
  nondeterministic. Tổng 6 request dùng 41.069 output token; chi phí ước tính theo
  rate catalog gồm cached input và FX 25.000 khoảng 23.670 VNĐ, trong đó bốn call
  bổ sung khoảng 11.975 VNĐ. Artifact cặp đầu ở
  `tmp/m9-2-schema-ref-live-comparison/`, hai cặp sau ở `run-2/` và `run-3/`.
  Local `.env` đang bật flag; restart API/worker để process đang chạy nạp giá trị
  mới, và tắt flag để rollback khi cần.
- Micro live A/B cùng ngày đã chạy thêm ba nguồn ngắn độc lập trên
  `gpt-5.4-2026-03-05`/medium: giao hoán phép cộng lớp 3, bình phương của một tổng
  lớp 8 và tổng ba góc tam giác lớp 7. Cả 6/6 output ref/inline đều pass schema,
  0 issue, đúng 1 theory unit + 4 persisted block, không thêm các chủ đề ngoài
  nguồn đã đặt sentinel; mọi phép tính/ví dụ sinh ra đều đúng khi review thủ
  công. Case Hình học cho 4/4 diagram ở mỗi strategy, mỗi diagram có đúng một
  tam giác. Ref dùng tổng 43.209 input token so với inline 279.594 (giảm 84,5%),
  latency trung bình 24,7 giây so với 27,5 giây; tổng chi phí 6 call khoảng 7.979
  VNĐ theo cached-input rate/FX catalog. Phát hiện chung không liên quan `$ref`:
  cả ref và inline đều vẽ đúng khung tam giác nhưng không ghi số đo góc 50°/60°
  lên hình (`markers=[]`, `labels=[]`), nên current review gate chưa bắt được thiếu
  annotation dữ kiện. Artifact ở
  `tmp/m9-2-schema-ref-small-live-comparison/`.
- `M9.13-M9.15` đã Done ngày 2026-08-11 cho admin chỉnh trực tiếp hình JSON trong
  draft: tên điểm edit-only; label/góc/caption edit-delete; marker xóa theo group;
  chọn từ hai segment có tên ở hai đầu để thêm `EQUAL_LENGTH`; reset riêng một
  hình về đầu phiên. Một segment chỉ tô đỏ, popup hai segment chỉ có icon `=`,
  hit-test theo tọa độ SVG để không chọn nhầm cạnh, mọi action giữ scroll. Chỉ
  reset có confirm; `Lưu nội dung` mới PUT, backend guard giữ nguyên và không gọi
  provider. Plan chi tiết ở
  `.codex/plans/m9-13-admin-safe-diagram-element-delete-plan.md`.
- Corrective ngày 2026-08-11 đã thêm ranh giới thông báo lỗi dùng chung ở web:
  toast/banner/form không còn đưa nguyên văn lỗi Zod, provider hoặc câu kỹ thuật
  tiếng Anh ra giao diện. Lỗi chỉnh hình được ánh xạ riêng theo tên điểm, marker,
  cạnh và đồng hồ; lỗi chưa biết dùng câu tiếng Việt theo đúng ngữ cảnh thao tác.
- `M9.3` đã Done và được corrective ngày 2026-08-11: admin Quiz/Flashcard/Test
  generate API trả 202 và chống active job trùng theo lesson/type; worker
  hybrid-retrieve đúng lesson, reject source stale/chunk reference ngoài
  context/output copy chuỗi từ 12 token và validate strict đủ bốn loại câu. Mỗi
  Quiz/Test question dùng nguyên EXAMPLE core M9.2 cộng assessment metadata.
  Quiz append vào set đang mở (`targetQuizSetId`), không tạo tab mới; mỗi câu lưu
  generation lineage + `exampleBlock`, audit giữ đúng 10→xóa 2→8 mà không tính
  câu thủ công/lượt khác. Quiz không trả/lưu sourceChunkIds ở cấp câu vì là bài
  tập mới bám context. Admin/student dùng cùng EXAMPLE card; admin Quiz dùng cùng
  diagram editor với Sinh kiến thức. Contract/prompt nâng `v4`. Live GPT-5.4 đã
  pass ma trận 1/5/10 cho Đại số và Hình học; một lượt live bổ sung cũng pass 10
  câu hỗn hợp 5 Đại số + 5 Hình học, có ba diagram persist không issue và không
  source trace cấp câu. Compiler tự nhận shared-hypotenuse từ intent 4 điểm và
  không còn dựng thêm E/F. UI corrective đã giữ CTA `Tạo Quiz` sau success,
  thêm thanh số chỉ render một câu, hai mode `Chỉ xem UI`/`Song song` cho
  câu AI và label ngữ cảnh `Lời giải`; Summary vẫn là `Ví dụ`. Mapper và
  renderer dùng chung tokenizer cho `$...$`, `$$...$$`, `\\(...\\)`, `\\[...\\]`
  nên không còn lộ delimiter LaTeX ở đề/đáp án/gợi ý cũ. Agent-browser
  đã verify desktop/mobile light/dark, công thức, hình học, split JSON và modal
  tạo thêm; artifact nằm trong `.codex/artifacts/m9-3-quiz-visual/`.
- `M9.8` đã bổ sung cấu hình Summary theo lần chạy (phong cách, độ dài,
  trọng tâm, nhóm nội dung, câu ôn tập, yêu cầu bổ sung, model, temperature,
  output token) và endpoint preview dùng chung prompt builder với worker. Admin
  xem được read-only system instructions, user prompt, input đầy đủ có context,
  token/model/upper-bound chi phí; preview không gọi provider và không tốn phí.
  Route snapshot giữ đúng model/config đã chọn cho job. API focused pass 7/7,
  Playwright pass 16/16 trên desktop/tablet/Android/iPhone.
- `M9.9-M9.12` và `M4.6` đã Done: provider catalog/price version/model routing/usage; AI/OCR reservation nguyên tử theo `ALL + category`, period giờ Việt Nam, idempotent settle/release/uncertain, fail-closed và budget error không fallback/retry; ADMIN API + `/admin/ai-settings` hiển thị đã dùng/đang giữ/còn lại. PostgreSQL concurrency, API/worker live boot và Playwright desktop/mobile light/dark đã pass không gọi provider trả phí.
- `M6.2` đã hoàn thiện Quiz CRUD giàu nội dung; `M6.3` đã hoàn thiện Flashcard set/item CRUD trong lesson detail, soft delete/audit, student read có enrollment/trial guard, rich front/back/hint editor và focused PostgreSQL integration test. `M6.4` đã hoàn thiện Test set/question CRUD bằng cùng rich editor/interaction của Quiz, bổ sung thời gian làm bài ở bộ đề, soft delete, lời giải, grading config và chia đều tổng 10 điểm khi câu chưa có điểm riêng.
- `M6.5` đã hoàn thiện student read-only lesson content API: một access resolver dùng chung cho enrollment/trial/personalized path; aggregate lesson trả video/material/document URL an toàn, summary và metadata quiz/flashcard/test đã duyệt; endpoint quiz loại đáp án/grading/lời giải, test availability tính bằng thời gian server và trial không được bắt đầu bài kiểm tra.
- `M7.1-M7.5` đã hoàn thiện core student learning UI + API tại
  `/student/lessons/[lessonId]`: video bài giảng dùng `videoUrl` +
  `customVideoSettings` luôn nằm trước tab; lesson tab mở summary trọng tâm; Quiz có
  hint/check/lời giải chủ động, retry/review toàn bộ hoặc câu sai; Flashcard lưu
  known/unknown/favorite; Test khóa theo giờ mở + completion Quiz/Flashcard,
  auto-submit, review scopes, explicit `Dùng điểm bài này`, best/completion
  transaction và Top 5. Notes/comments `M7.6`, dashboard `M7.7` chưa làm theo
  yêu cầu owner; lesson cá nhân tái sử dụng cùng UI, không có màn riêng.
- `M4.2`/`M4.5` hỗ trợ nhiều source documents ngang hàng ở cấp course và nhiều khối trích xuất trong mỗi lesson. Modal lesson có `Thêm trích xuất`/`Thêm tài liệu`, khối mới mặc định chọn source đầu danh sách, giữ thứ tự xen kẽ với file nền tảng, không hiện lỗi khi vừa append và validate realtime sau tương tác. Range trong cùng source không được overlap inclusive; API revalidate/reconcile collection trong transaction, tạo quan hệ `lesson_documents.page_range_id`, giữ `sort_order` và enqueue từng document thay đổi. Ba kind canonical là `PRIMARY_FROM_SOURCE`, `SUPPLEMENT`, `HOMEWORK`.
- Điều chỉnh taxonomy ngày 2026-07-23: toàn hệ thống chỉ còn `PRIMARY_FROM_SOURCE`, `SUPPLEMENT`, `HOMEWORK`; không còn `PRIMARY_REPLACEMENT`. Page range và file nền tảng upload trực tiếp cùng dùng `PRIMARY_FROM_SOURCE`, được phân biệt bằng `source_document_id`/metadata và có thể đồng thời active.
- Bộ docs đã được tách theo index và file con:
  - implementation: `docs/09-implementation-plan.md` + `docs/implementation/M*.md`
  - database: `docs/04-database-model.md` + `docs/database/*.md`
  - API: `docs/05-api-contract.md` + `docs/api/*.md`
- Owner đã duyệt milestone mở rộng `M15 Smart video learning`: theo dõi khoảng xem/resume, note/checkpoint theo timestamp, contextual AI, chapter summary/flashcard, semantic search, adaptive review/mastery và admin analytics. Ưu tiên `M15.1-M15.3` sau core student `M7.1-M7.5`; phần AI `M15.4-M15.8` chờ dependency `M3.8`, `M5.x`, `M9.x`.
- UI direction là mobile-first, vẫn phải ổn trên tablet/iPad và laptop/desktop, đồng thời ưu tiên cảm giác mượt, phản hồi nhanh và độ trễ cảm nhận thấp.
- Với card có nhánh UI theo enrollment/`nextLesson`, phải lần theo route và điều kiện render đang hoạt động trước khi tinh chỉnh CSS; không dùng nhánh có class tương tự làm proxy cho UI thực tế.
- Với thay đổi chỉ dành cho một màn, phải ưu tiên wrapper/variant theo screen thay vì sửa component card dùng chung, để không làm lệch màn khác đang tái sử dụng card đó.
- Với accent của danh sách card, khi owner yêu cầu màu ngẫu nhiên riêng từng card thì phải sinh màu biến thiên theo từng card trong danh sách hiện tại, không dùng palette nhỏ luân phiên hoặc mapping màu cố định theo slug. Phải phân bổ theo tổng card đang thấy để các hue cách nhau rõ về thị giác, không chỉ khác mã màu. Nếu không có chỉ dẫn trái ngược, ưu tiên cyan → sky → blue, loại xanh lá, đỏ, tím và vàng khỏi dải sinh màu.
- Nhãn đối tượng hướng đến của khóa học phải map theo code audience (không chỉ theo grade): từng nhãn trong toàn bộ tập Khối 3–12, Tiểu học, THCS, THPT, Toàn khối và Người đi làm phải có tone xanh dương riêng, khác biệt rõ về thị giác (hue và/hoặc độ đậm/độ sáng), không chỉ khác vài đơn vị hue. Không dùng sắc ngả xanh lá.
- Tất cả nhãn đối tượng hướng đến dùng nền nhạt và chữ/icon xanh dương tươi có độ tương phản rõ nhưng không ngả navy quá đậm; không dùng nền đậm cho badge trong card. Riêng nhãn nhóm Tiểu học/THCS/THPT/Toàn khối/Người đi làm không dùng border.
- Khi tái sử dụng thiết kế action/navigation giữa các activity học, chỉ đồng
  bộ cấu trúc, kích thước, độ sâu, trạng thái và nhịp tương tác; màu phải theo
  palette chủ đạo của activity đích. Ví dụ Flashcard dùng violet, không sao
  chép nguyên màu sky của Quiz.
- Quiz transition brand đang tiếp tục được owner review: đã loại cả nét sơn
  ngoằn ngoèo lẫn concept trực thăng quanh logo. Direction hiện tại là giữ logo
  làm trọng tâm, bên dưới chỉ dùng dãy nét gạch tăng dần xanh–cyan–xanh
  ngọc–vàng–cam và mũi tên đi lên để gợi cảm giác tiến bộ. Đây vẫn là direction
  thử nghiệm, chưa phải approved pattern cho tới khi owner xác nhận chốt.
- Rule toàn cục mới: mọi UI phải tối ưu mọi đường load trên điện thoại nhanh nhất có thể trong phạm vi task, kể cả mock UI/admin. Bao gồm cold first load, route transition, data fetch/refetch, skeleton duration, asset/font/image load, hydration, API response và pending interaction. Một đường load nhanh không đủ nếu đường khác còn chậm; phải giảm bundle ban đầu, lazy-load form/modal/editor/chart/admin tool ít dùng, dùng server/initial data/prefetch/cache khi phù hợp, tránh mock delay mặc định, chỉ tải asset cần thiết, giữ formatter/sort hydration-safe và xử lý mismatch do browser/autofill ở primitive.
- Ghi nhớ bundle isolation web: vì admin/public/client cùng chung `apps/web`, không đưa toaster, CSS admin, shell/nav/guard role-specific, editor/chart/export/upload tool hoặc asset/font riêng role vào root layout/shared provider/global CSS. Root layout hiện không mount `AppToaster`; auth/admin layout tự mount toaster; admin CSS nằm ở `apps/web/app/(admin)/admin-theme.css`; route admin nên import trực tiếp screen cần render và lazy-load modal/dialog nặng.
- Hệ thống có chế độ chuyển theme sáng/tối; mọi UI mới hoặc UI được sửa phải hỗ trợ đầy đủ cả theme sáng và theme tối trong cùng phạm vi task. Phải ưu tiên semantic token/CSS variable/dark variants, tránh hard-code màu chỉ hợp một theme, và kiểm text/surface/border/shadow/icon/button/label/form/modal/table/badge/loading/empty/error/media ở cả hai theme.
- Mỗi khi làm UI, kết quả phải giống production thật cả về visual lẫn interaction: mock data được phép, nhưng control không được tĩnh giả bấm. Button/checkbox/tab/menu/input/toggle/modal/filter/pagination/upload/editor/icon có vẻ tương tác phải có semantic element, state/handler thật, feedback bấm và pending/disabled/loading/error/success khi phù hợp.
- Khi nối hoặc hoàn thiện UI, mọi tính năng/control/action đang hiển thị và có vẻ dùng được phải có backend API/storage behavior tương ứng trong cùng phạm vi task. Nếu backend chưa làm hoặc ngoài scope, UI phải disable/hide hoặc hiển thị trạng thái chưa khả dụng rõ ràng; không để upload/delete/restore/save giả thành công bằng state local trong flow đã nối API.
- Button trong mọi modal/drawer phải đồng nhất màu theo vai trò action: action chính/lưu dùng cùng màu `primary` trong cùng hệ modal, mặc định xanh dương `sky-600`/`sky-700` với chữ trắng; hủy/đóng trung tính; destructive đỏ. Không để một modal action chính màu đen/tối nếu các modal cùng flow đang dùng xanh dương.
- UI cho học sinh/phụ huynh phải thân thiện, chuyên nghiệp, ít lời và có năng lượng học tập: không dùng text kỹ thuật, không dùng panel/card chỉ để giải thích hệ thống, không để auth/register quá xám/lạnh; ưu tiên nền màu sáng, CTA nổi, ảnh/illustration học đường, font phù hợp và hành động chính rõ. Tránh ảnh người đi làm/coworking/corporate cho auth học sinh. Nếu auth dùng visual mạnh, ưu tiên split-screen desktop rõ ràng: trái visual/slogan dạng lời chào thương hiệu + câu định vị ngắn, phải form sạch. Có thể dùng display font riêng cho heading bên trái, nhưng form/body vẫn phải dễ đọc.
- Auth visual bên trái không được để chữ quá to/toàn đen hoặc panel quá đục che mất nền. Ưu tiên headline gradient/accent vừa phải, lớp nền trong nhẹ, icon học tập ngắn gọn và chuyển động tinh tế có tôn trọng reduced motion.
- Khi owner gửi ảnh reference UI, Codex phải trích phong cách phù hợp thay vì copy nguyên bố cục. Với auth/register/login, reference dashboard chỉ nên truyền cảm hứng về màu, bo góc, card, icon và năng lượng thị giác; màn vẫn phải là auth flow rõ ràng.
- Nếu owner nói reference là thiết kế mobile, Codex phải ưu tiên mobile layout giống reference trước; không tự thêm chip chân trang, tab phụ hoặc bước phụ ngoài flow hiện có.
- Khi chỉnh auth UI theo feedback, nếu một màn sibling như login đã có nhịp visual ổn, ưu tiên đồng bộ layout/spacing/ảnh với màn đó trước khi thử cấu trúc mới; không xử lý overlap bằng cách thu ảnh quá nhỏ làm mất trọng tâm visual.
- Auth mobile hero description dưới headline phải đồng nhất ở các trang login/register/forgot/reset và giới hạn tối đa 50% chiều rộng vùng hero để tránh đè lên ảnh minh họa.
- Auth brand slogan và hero description phải dùng hai màu cố định khác nhau giữa các dòng, nhưng mỗi dòng phải đồng nhất màu giữa các màn auth; brand slogan dùng xanh sky đậm để vẫn giữ mood brand nhưng tách khỏi chữ `Class`, hero description dùng xám dễ đọc, không để cả hai cùng dùng một gradient/theme color.
- Auth desktop hero description nên lớn hơn mobile một chút và không xuống dòng trên laptop/desktop, áp dụng trong shell dùng chung để đồng bộ giữa login/student/parent/recovery; mobile vẫn giữ giới hạn width để tránh đè ảnh.
- Auth form controls phải đúng ngữ nghĩa và có tương tác thật: tài khoản/username dùng icon user, nút mắt mật khẩu phải là button có `aria-label` và toggle `input type` giữa password/text, còn "Ghi nhớ đăng nhập" phải là checkbox stateful chứ không dùng icon tĩnh.
- Auth login secondary actions dưới CTA như "Ghi nhớ đăng nhập" và "Quên mật khẩu?" phải nằm cùng một dòng cả trên mobile, dùng layout một hàng với nội dung không tự rớt dòng.
- Performance toàn hệ thống dùng `docs/12-performance-and-observability.md` cho frontend/API/database/worker/AI và đo đạc.
- SEO/public discovery dùng `docs/13-seo-and-content-discovery.md` cho landing, public course, news/event, metadata, sitemap, robots, canonical và structured data.
- Database dev mặc định chạy local bằng Docker Postgres + pgvector; staging/production vẫn dùng Supabase Postgres.

## 2. Quyết định workflow đang áp dụng

- `/task-full` là mặc định khi owner muốn làm trọn một subtask theo lát dọc.
- `/task-ui` dùng khi cần dựng UI/mock data trước để owner review.
- `/task-connect` dùng sau UI mock, code API đầy đủ nếu thiếu rồi nối UI với data thật.
- Với `/task-connect`, UI đang thấy tính năng gì thì backend phải có đủ API/storage cho tính năng đó trong phạm vi task; nếu không làm được vì quá rộng, phải tách scope hoặc disable/hide rõ ràng thay vì giữ UI giả.
- Thêm chữ `plan` sau skill task để Codex chỉ lập kế hoạch và chờ duyệt, ví dụ `/task-full plan M1.2`.
- `/do` có nghĩa là duyệt plan hoặc task tiếp theo đã được gợi ý và bắt đầu làm; nếu còn thay đổi đã xong chưa commit, `/do` có thể commit trước rồi triển khai task mới rõ ràng.
- `/do plan` có nghĩa là commit phần đã xong nếu cần, rồi lập plan cho task tiếp theo đã được gợi ý để owner duyệt trước khi làm.
- Task nhỏ/rủi ro thấp được dùng lean mode: chạy check nhỏ nhất đủ tin cậy, không bắt buộc full lint/build/test toàn repo.
- Riêng `/task-ui`, `/task-connect` và `/task-full` quy mô lớn phải test kỹ sau khi làm xong, không dùng lean mode mặc định. Quy mô lớn gồm nhiều màn/module/package, shared component/primitive, API/database/schema/worker/storage/auth/payment/AI, data-connected UI, route guard/session hoặc flow production end-to-end. Bộ check phải bao gồm lớp phù hợp: unit/focused test, integration/API test, E2E/browser/runtime check, typecheck/lint/build, migration/worker/provider runtime khi có liên quan; nếu thiếu test harness thì được cài thêm package test hợp lý hoặc tạo focused test tái dùng. Nếu layer nào không chạy được, final phải ghi `Not run: <lý do>`.
- Với task làm UI hoặc owner yêu cầu sửa UI, mặc định ưu tiên tốc độ: hạn chế typecheck/lint/build/E2E. Chỉ chạy check lớn khi thay đổi chạm shared component, form/state/route phức tạp, nhiều màn, data-connected UI, hoặc owner yêu cầu rõ. UI nhỏ chỉ cần `git diff --check`, format check nhỏ hoặc ghi chú kiểm tra thủ công.
- Khi owner ghi `sửa nhanh`, `fast`, hoặc `check nhẹ`, mặc định dùng fast path: đọc phạm vi nhỏ nhất, patch trực tiếp, không refactor/cleanup lan, không cập nhật changelog, không chạy typecheck/lint/build/Playwright/E2E trừ khi đụng auth/API/database/shared logic, route guard, form/session/data behavior hoặc có dấu hiệu TypeScript lỗi rõ.
- Theo preference mới của owner, với task nhỏ/thường không tự chạy browser check, Playwright UI, screenshot hoặc kiểm tương tác thật cho mỗi task/bug/sửa UI; owner sẽ tự kiểm tra. Ngoại lệ là task-ui/task-connect/task-full quy mô lớn theo rule test kỹ ở trên, khi đó phải chạy E2E/browser/runtime nếu khả thi dù owner không ghi `screenshot`.
- Khi owner bảo "ghép API", "nối API", "connect API" hoặc dùng `/task-connect` sau khi đã feedback UI, mặc định hiểu UI hiện tại đã được chốt/ưng. Codex phải giữ nguyên layout, field, label, placeholder, validation UX và flow màn hình; nếu API/database hiện tại chưa khớp UI thì sửa API contract, backend, database hoặc mapping payload cho phù hợp, không tự thêm/xóa/sửa field UI để ép theo DTO cũ nếu owner không yêu cầu rõ.
- Sau khi sửa backend/API cho UI owner đang test, phải verify đúng API origin web đang gọi, thường là `localhost:4000`; nếu cổng này đang có dev server cũ thì restart server đó rồi curl lại payload lỗi. Không chỉ verify trên cổng tạm như `4001` rồi để owner tiếp tục hit bản cũ ở `4000`.
- Với runtime test gọi provider trả phí thật như Mathpix/OpenAI/Gemini, Codex phải ưu tiên cache/mock/sample trước; trước forced/full run cả cuốn hoặc nhiều dữ liệu phải báo phạm vi, số trang/token/usage, ước tính chi phí và chờ owner xác nhận rõ. Sau khi đã có artifact/cache hợp lệ, verify code/derived artifact bằng cache-hit rerun, không tự gọi lại provider trả phí.
- Khi làm public page có mục tiêu xuất hiện Google, Codex phải đọc SEO docs bên cạnh UI/performance docs.
- Khi owner không hài lòng và Codex đưa ra giải pháp/quy tắc mới có thể tái sử dụng, Codex phải tự ghi lại ngay vào docs/skill/context phù hợp, không chờ owner hỏi lại đã note chưa.
- Khi giải thích auth/front-end cho owner, tránh thả thuật ngữ React/Next như "hydrate" một mình. Nói bằng tiếng dễ hiểu trước, ví dụ "đọc lại session/token đã lưu trong trình duyệt", nếu cần mới ghi thêm thuật ngữ kỹ thuật trong ngoặc.
- Khi vẽ sơ đồ phân quyền front-end, phải tách nhánh protected route và auth route trước khi kiểm điều kiện riêng của từng nhánh. Không vẽ kiểu đã xác nhận token còn hạn rồi mới hỏi auth route "đã đăng nhập chưa", vì điều đó gây dư logic; auth route nên kiểm session/token của chính nó rồi redirect hoặc hiện form.
- Khi cập nhật `docs/learning-notes/`, nếu kiến thức là flow phân quyền/API/kiến trúc/state, phải thêm sơ đồ Mermaid ngắn, dễ hiểu như sơ đồ owner vừa chốt; không chỉ ghi mô tả chữ.
- Task có sửa code phải đọc `docs/14-source-code-structure.md` và nêu rõ source layer dự kiến trước khi edit: front-end route/page -> feature screen/hook/component/schema/data/utils/shared component, back-end controller/service/DTO/select/serializer/utils/types/common errors.
- Với các skill có làm UI nhỏ/thường, screenshot/browser/Playwright/kiểm tương tác thật là opt-in: chỉ chạy khi owner yêu cầu rõ, ví dụ command có từ `screenshot` hoặc nói "kiểm bằng browser"; nếu không có yêu cầu đó thì dùng check code tĩnh/focused và để owner tự kiểm UI/tương tác. Ngoại lệ là task-ui/task-connect/task-full quy mô lớn: phải chạy E2E/browser/runtime check khi khả thi; screenshot artifact vẫn chỉ tạo khi owner yêu cầu hoặc cần bằng chứng debug.
- Từ 2026-07-19, khi owner nói UI đã "ưng/ok/chốt/đúng ý/final" hoặc yêu cầu lưu ảnh UI cuối, Codex phải tự chụp đủ screenshot responsive cho route liên quan vào `docs/final-screen-ui/{laptop,ipad,mobile}/{public,student,admin,parent}/{route-path}/`. Mặc định dùng viewport laptop `1440x1000`, iPad `834x1112`, mobile `390x844`, chụp full-page bằng browser/Playwright trên runtime thật khi khả thi. Route `/` lưu ở `home`; route động dùng slug/id thật. Nếu route cần auth/data, dùng seed/local session đúng role hoặc ghi rõ blocker khi không dựng được runtime.
- Skill repo `.codex/skills/design` cung cấp command `/design`: tạo ảnh UI hoàn chỉnh như giao diện production thật cho một màn/viewport/subtask, đọc trước UI rules, approved patterns, code patterns, `docs/final-screen-ui` và route/code liên quan; mặc định chỉ tạo ảnh thiết kế hoàn chỉnh, không implement product code nếu owner chưa yêu cầu.
- Khi sửa CSS/visual nhiều vòng trên cùng màn, đặc biệt các màu/weight/border có thể bị ảnh hưởng bởi theme, dark mode, `!important`, CSS route-group hoặc class global, không được ngầm hiểu `git diff --check` là đã xác nhận UI nhìn đúng trong browser. Trước khi notify `done`, Codex phải hoặc kiểm trực tiếp computed style/browser nếu owner cho phép, hoặc nói rõ trong final là chỉ đã patch code/check tĩnh, chưa visual-verify. Nếu owner phản ánh "không thấy đổi", ưu tiên kiểm đúng route/component đang render, dev server/HMR/cache, theme hiện tại và CSS cascade trước khi tiếp tục đổi class.
- Với micro UI tweak như dịch vị trí ảnh, đổi một khoảng cách hoặc chỉnh một màu, phải dùng fast path: đọc đúng file liên quan, patch thuộc tính nhỏ nhất, không cập nhật changelog, check nhẹ tối đa; không gộp cleanup workflow/docs không liên quan vào cùng lượt sửa UI nếu owner không yêu cầu.
- Backend HTTP exception/error phải dùng helper/factory chung trong `apps/api/src/common/errors` thay vì tự `new BadRequestException`/`UnauthorizedException`/`ConflictException` kèm body rải rác trong module; Prisma known errors cũng ưu tiên mapper dùng chung tại đó.
- Changelog chỉ được cập nhật trong workflow `/commit` khi commit thật sự được tạo. Mỗi commit có một entry/đoạn ngắn gọn, liền mạch tóm tắt các thay đổi chính; task thường, sửa nhanh và micro tweak không ghi changelog.
- `/commit all` nghĩa là commit hết mọi thay đổi source an toàn trong worktree; nếu có nhiều nhóm độc lập, Codex được tự động tạo nhiều commit liên tiếp theo scope hợp lý. Mỗi commit có changelog entry riêng, stage rõ từng batch, chạy check phù hợp, và chỉ để lại file uncommitted khi có blocker/scope rủi ro cần owner quyết định.
- `/commit` smart/fast phải tối ưu thời gian cho UI nhỏ/docs: nếu chỉ đổi copy, màu, spacing, Tailwind class, vị trí ảnh, static layout hoặc docs/skill/context thì bỏ qua package typecheck mặc định; chỉ chạy typecheck khi diff chạm TS behavior, props, form/state handler, route/shared primitive/schema/session/data hoặc có dấu hiệu lỗi TypeScript.
- Sau mỗi task/plan/commit, Codex phải gọi `.codex/scripts/notify-task.sh` trước final response để hiện thông báo rõ ràng trên macOS; dùng `done`, `blocked` hoặc `failed` theo trạng thái.
- Telegram notification/bot đang được tắt theo yêu cầu owner: `.codex/telegram/.env.local` có `CODEX_TELEGRAM_SUPPRESS_NOTIFY=1` và LaunchAgent Telegram đã remove. Không bật lại Telegram cho đến khi owner yêu cầu rõ.
- Repo có Telegram bot local ở `.codex/scripts/codex-telegram-bot.py`: chat ID được allow có thể chat/ra lệnh cho Codex qua Telegram với quyền full access trong repo; token thật nằm ở `.codex/telegram/.env.local` và không commit. Nên chạy bền bằng `.codex/scripts/install-telegram-launch-agent.sh`; mặc định dùng `telegram-thread` để Telegram có thread Codex riêng. Transcript local ghi ở `.codex/telegram/transcript.md` và bị ignore khỏi git.
- Web app đã có Playwright với Chromium cho UI review khi owner yêu cầu rõ hoặc khi task-ui/task-connect/task-full quy mô lớn cần E2E/browser/runtime verification. Mặc định task nhỏ/thường không tự chạy browser/Playwright/screenshot; report/results/screenshot local trong `.codex` là artifact bị ignore.
- Theo ưu tiên của owner, Codex phải ưu tiên tốc độ: dùng nhiều command/tool song song khi độc lập và an toàn, nhất là read-only như `rg`, `sed`, `git status`, `git diff`. Ưu tiên đọc/search/check song song tối đa khi độc lập; với edit file, gom nhiều chỉnh sửa liên quan vào một `apply_patch` hợp lý thay vì nhiều patch rời rạc, nhưng không chạy nhiều patch song song. Nếu Codex UI hiện `{"detail":"Bad Request"}` trong activity, coi đó là lỗi hiển thị/lớp tool trước khi kết luận app lỗi. Không được dừng task chỉ vì lỗi này; kiểm tra command thực tế, retry bằng lệnh đơn giản hơn nếu cần rồi tiếp tục phần việc chính. Khi session vừa gặp `Bad Request`, không dùng shell command nối chuỗi kiểu `&&`, `;` hoặc nhiều lệnh trong một activity. Chỉ hạ cấp sang từng bước cho thao tác vừa gây lỗi, output quá dài, path/ký tự phức tạp, heredoc/append shell hoặc sửa `.codex`. Ưu tiên `apply_patch` cho docs/changelog/skill.

M14.8 hoàn thành ngày 2026-07-29: đã audit toàn bộ 13 route web hiện có, đưa
query owner/prefetch về feature hook phù hợp, user-scope cache key, thêm chính
sách loading trễ/ổn định nhưng giữ skeleton riêng theo từng screen, và khóa lỗi
nháy tab bằng Playwright desktop/mobile. Chi tiết nằm tại
`docs/implementation/M14.8-frontend-loading-audit.md`.

## 3. Task tiếp theo nên ưu tiên

### Resume M9.2 coverage hình Toán 3-9 khi owner mở lại

Owner đã yêu cầu lưu phần dở dang ngày 2026-08-10 để tiếp tục sau. Không khởi
động lại từ đầu và không dùng số screenshot để tuyên bố coverage. Baseline code
trước wave là commit `7f561b15`; báo cáo resume là
`anh-chup-hinh-toan-dat-chuan/coverage-report-v51.json`.

- Local/compiler: `50/50` ô inventory đạt (`100%`), 86 fixture semantic và 688
  ảnh golden đa thiết bị/theme đã duyệt.
- Live evidence: `39/50` (`78%`); còn 11 ô phải live test.
- Exact-page SGK/SBT: `19/50` (`38%`); còn 31 ô phải audit nguồn.
- Đủ đồng thời local + live + exact-page: `11/50` (`22%`). Vì vậy
  `classificationStatus` và `releaseStatus` vẫn phải là `IN_PROGRESS`, chưa ô
  nào được tự nâng thành `SUPPORTED` chỉ dựa trên ảnh đẹp.
- Tổng paid usage đã ghi nhận của wave là `131.848 VNĐ` qua 75 usage event; các
  lượt compiler/render/screenshot lại từ cache không tốn provider.

Thứ tự tiếp tục bắt buộc:

1. Khóa inventory/source mapping: audit 31 ô còn thiếu tới đúng SGK/SBT Kết nối
   tri thức, ghi rõ include/exclude và không tự giảm mẫu số.
2. Live test 11 ô còn thiếu bằng `gpt-5.4`, chạy batch nhỏ có reservation; mỗi
   output phải chụp Chromium Mobile, WebKit Mobile, iPad, laptop ở light/dark.
3. Review thủ công source-grounded; lỗi local sửa compiler/validator/layout rồi
   render lại cache, chỉ paid retry khi sai `PROVIDER_INTENT`.
4. Chạy lại semantic, schema, API typecheck/build, web lint/typecheck và toàn bộ
   golden non-regression; ảnh lỗi chuyển khỏi thư mục đạt chuẩn.
5. Chạy lại một ma trận bài thật đại diện sau khi ví dụ lẻ ổn, cập nhật coverage
   report và chỉ công bố khi ít nhất `45/50` ô qua đủ mọi gate; mục tiêu chính
   vẫn `>=95%`, stretch goal `98-100%`.
6. Hoàn thiện partial persistence gọn (hotfix 4-6 giờ): cơ chế progressive
   recovery áp dụng cho mọi loại block, không riêng hình vẽ; mọi lỗi có thể quy
   về một block/field không làm thất bại toàn summary. Mọi field/sub-block còn
   render-safe và có ý nghĩa vẫn hiện; fallback chỉ thay phần hỏng nhỏ nhất.
   Hình/block còn render-safe vẫn
   hiện nguyên dạng cho admin với badge `Cần review`; admin có thể
   `Chấp nhận hình này` sau review thủ công mà không gọi AI. Placeholder
   `Hình lỗi` và hard-error không có nút chấp nhận; chỉ sửa, xóa hoặc chủ động
   tạo lại mới resolve. Payload không
   render-safe một phần phải cô lập đúng primitive/marker/label lỗi và vẫn vẽ
   phần còn có ý nghĩa. Chỉ khi không còn hình có ý nghĩa nào có thể render mới
   dùng placeholder `Hình lỗi`; không in raw validator JSON làm thông báo chính.
   Hình đã đạt chuẩn phải giữ pass-through invariant: nguyên `diagramSpec`, dùng
   mapper/renderer cũ và không chạy fallback; golden cache là regression gate.
   Mọi badge `Cần review` phải có một câu tiếng Việt ngắn chỉ rõ đối tượng và lý
   do cần kiểm tra; raw validator/path chỉ nằm trong `Chi tiết kỹ thuật`.
   Các lỗi hình học đã biết phải map theo family và gọi đúng tên đoạn/điểm/góc,
   ví dụ `AC` và `A′C′` lệch độ dài; dữ liệu cũ có technical details hợp lệ cũng
   được nâng copy khi API đọc ra, không buộc admin sinh lại chỉ để hiểu cảnh báo.
   Nếu chỉ có nhãn đẳng thức chữ thừa và marker hình học còn đúng, recovery bỏ
   nhãn thừa mà không tạo badge oan.
   Mỗi issue còn có `Gợi ý sửa` tất định từ mã kiểm tra nội bộ, không gọi AI và
   không tự bịa giá trị cần điền. Hai dòng `Vấn đề`/`Gợi ý sửa` chỉ dùng tiếng
   Việt dễ hiểu; tên trường, đường dẫn dữ liệu và thuật ngữ kỹ thuật tiếng Anh
   chỉ nằm trong `Chi tiết kỹ thuật`. API cũng Việt hóa cảnh báo cũ khi đọc ra.
   `Cần review`/`Cần sửa` chỉ là warning, không khóa editor: admin vẫn sửa, thêm,
   xóa, sắp xếp và lưu draft bình thường; save revalidate block đã đổi để tự gỡ
   hoặc cập nhật issue, còn publish mới bị chặn khi issue chưa resolve.
   Lượt tạo ban đầu chỉ gọi AI một lần và
   tuyệt đối không tự repair/retry. Admin sửa/xóa bằng editor hiện có. Nút
   `Tạo lại` riêng block là phase tùy chọn 3-5 giờ, không thuộc hotfix bỏ chặn;
   nếu triển khai thì chỉ thao tác chủ động của admin mới phát sinh request AI.

Kế hoạch chi tiết của mục 6 nằm tại
`.codex/plans/m9-2-summary-partial-block-recovery-plan.md`. Thứ tự resume mới:
hoàn thành partial persistence/recovery này trước, sau đó mới tiếp tục 11 live
case coverage còn thiếu; nếu không, một lỗi block cục bộ có thể tiếp tục làm mất
toàn bộ kết quả của paid full-lesson request.

11 ô thiếu live evidence: `data-pictogram-simple`, `plane-angle-simple`,
`plane-axial-symmetry-medium`, `plane-central-symmetry-hard`,
`advanced-centroid-medium`, `advanced-angle-bisectors-medium`,
`advanced-perpendicular-bisectors-hard`, `advanced-altitudes-hard`,
`advanced-altitude-hard`, `spatial-cone-sphere-medium` và
`schematic-flow-medium`.

Ước tính để resume: đạt tối thiểu 90% cần khoảng 8-14 giờ và 20.000-35.000 VNĐ
live test; cố gắng 100% cần khoảng 14-24 giờ và 45.000-80.000 VNĐ. Đây là estimate,
không phải quyền tự chi. Trước batch trả phí tiếp theo phải báo model, số request,
token reserve, upper bound và số đã dùng; trần đề xuất cho phần còn lại là
80.000 VNĐ, dừng sớm nếu đủ gate.

Core student learning `M7.1-M7.5` đã xong. Theo quyết định owner ngày
2026-08-03, toàn bộ cụm `M15 Smart video learning` được hoãn lại và không đề
xuất làm task kế tiếp cho đến khi owner mở lại. `M9.1-M9.3` và `M9.8` đã Done;
thứ tự AI tiếp theo được chốt là `M9.16 -> M9.4 -> M9.5 -> M9.6 -> M9.7`. `M9.8` đã
bổ sung panel admin bốn loại nội dung, polling/recovery, editor/review và live
matrix 8 ca. `M9.16` là task kế tiếp để harden prompt/preview/grade 3–12 trước
student flow. `M9.4` và
`M9.5` đổi sang `UI + API`, phải hoàn tất đường bấm kiểm thử cho học sinh trong
cùng task; `M9.8` không thay thế UI học sinh. `M15.2` vẫn chờ nền notes `M7.6`
khi milestone M15 được mở lại.

Thiết kế content ngày 2026-07-19: quiz/flashcard/test do AI sinh ở `M9.3` phải sinh theo từng buổi học (`lessonId`) từ dữ liệu OCR/chunk của đúng buổi đó, gồm page range source document đã gán cho lesson và supplemental documents thuộc lesson; không dùng context toàn bộ sách/lộ trình hoặc lesson khác. Output AI phải lưu vào cùng schema/bảng/API quản trị của `M6.2`/`M6.3`/`M6.4`; admin dùng cùng màn CRUD để thêm thủ công, sửa, xóa mềm, ẩn/hiện hoặc duyệt lại cả nội dung tự nhập lẫn nội dung AI sinh. Không tạo một kho AI-generated riêng tách khỏi flow quản trị chính.

Admin lesson detail `/admin/lessons/[lessonId]` hiện đã là workspace thật cho từng lesson: metadata/video/transcript, Documents, Summary, Quiz, Flashcard và Test CRUD/review; panel `M9.8` có bốn action AI scoped theo current `lessonId`, readiness, polling và recovery sau reload. Không đặt nút sinh AI ở cấp course/chapter theo kiểu dùng context toàn bộ sách.

M4.5 UI adjustment ngày 2026-07-19: course detail là nơi upload source PDF dài và xem status tài liệu theo buổi ở dạng gọn; thao tác nhập/chỉnh page range hàng loạt phải nằm trong modal `Nhập khoảng trang`, không nhét toàn bộ form dài vào màn detail course. Modal tạo/sửa lesson vẫn có section gán page range tùy chọn + preview source document cho một buổi học cụ thể nếu course đã có source document, để admin upload sách trước rồi tạo lesson sau mà không phải thao tác vòng; nếu admin chỉ tạo metadata thì bỏ trống range. Phần nhập trang trong modal lesson và modal nhập nhanh phải disabled tới khi source document đã xử lý xong, đủ page records, mọi page sẵn sàng và không còn warning số trang in cần xác nhận.

```txt
/task-full M9.16
```

`M3.5` student course browsing đã nối API thật dựa trên API `M3.3`, nhưng theo quyết định owner ngày 2026-07-13 thì pass này chỉ làm student course browsing trước. Tạm chưa làm public landing page hoàn chỉnh, public course list và public course detail trong pass này; public/SEO surface sẽ quay lại sau. Theo điều chỉnh ngày 2026-07-14, student course browsing tách thành hai màn riêng, không lồng route explore trong `courses`; feature code cũng mirror route này: `features/student/courses` cho `/student/courses`, `features/student/explore` cho `/student/explore`. Shared component student nằm ở `apps/web/components/student`, còn shared API/hooks/data/types/utils không render JSX vẫn ở `features/student/shared`: `/student/courses` là `Khóa học của tôi`, chỉ hiển thị các khóa học/lộ trình học sinh đã mua/đang có enrollment; `/student/explore` là `Danh sách khóa học`, hiển thị tất cả lộ trình published. Màn tất cả lộ trình có filter theo lớp và môn; mặc định lớp chọn theo lớp của học sinh, môn học chọn `Tất cả`. Bộ lọc Explore dùng select `Khối lớp` và `Môn học` cùng một hàng; `Khối lớp` có option `Tất cả` ở đầu và đủ lớp 3 đến lớp 12; search có nút tròn icon `X` là một cột riêng nằm ngoài cạnh phải ô tìm kiếm, không overlay/absolute vào input. Khi `X` chưa xuất hiện thì input full width; khi vùng search focus hoặc đang có từ khóa, input thu ngắn bằng animation và icon `X` trượt vào/fade-in; sau khi bấm `X` để xóa, icon phải biến mất và input trở lại full width. Không hiển thị nút filter cạnh search hoặc sort `Mới nhất` phụ ở màn mobile này. Select filter phải tránh lỗi bấm lại trigger khi đang mở làm dropdown tắt rồi bật lại ngay. Trên card khóa học Explore, badge trạng thái như `Đang học`, `Có học thử`, `Chưa mua` phải nằm sát mép phải của vùng nội dung/card, không đứng ngay sau nhãn lớp. Ảnh khóa học trong card Explore phải luôn là hình vuông và chiếm khoảng 40% chiều ngang khối card mẹ, dùng gap nhỏ để ảnh cao gần tới hàng số chương/số buổi nhưng vẫn giữ đủ không gian nội dung; không kéo dọc làm mất tỉ lệ. Tạm thời mobile student layout thống nhất: header compact/sticky, chỉ gồm logo + text `ClassHero` ở trái, icon thông báo + icon Chat AI dạng Messenger-style không có nền sát mép phải; không đặt tiêu đề trang trong mobile header. Khi người dùng cuộn xuống, header trượt ẩn lên trên; chỉ cần cuộn nhẹ lên trên một chút thì header phải xuất hiện lại ngay và sticky top, đồng thời luôn hiện khi ở gần đầu trang. Với mobile thật, header hide/show phải dựa trên scroll position thật (`scrollY`/document scroll) và ngưỡng delta, không dùng `touchmove`/`pointermove` để suy hướng cuộn vì các event này có thể chạy trước scroll và làm sai delta giữa responsive emulator và điện thoại. Badge số thông báo phải nhỏ, bám mép trên bên phải của chính icon chuông và không che mất icon; icon Chat AI cần có nhãn `AI` dạng pill nhỏ có nền ở góc trên bên phải chính icon tin nhắn, không đẩy lệch xa và không che nét icon Messenger. Hai icon thông báo và tin nhắn trong header phải dùng cùng khung/kích thước để mép dưới thẳng hàng; các icon header và icon bottom menu phải dùng cùng size 28px. Nhãn môn học và tên lớp trong card khóa học phải luôn cùng một hàng, không để lớp rớt xuống dòng riêng. Content màn `Khóa học của tôi` bắt đầu bằng avatar học sinh + tên + lời chào; bottom nav gồm icon kèm text dưới icon theo thứ tự `Trang chủ`, `Khám phá`, `Học tập`, `Sự kiện`, `Trang cá nhân`, `Menu`; mục `Sự kiện` dùng cho tin tức, sự kiện và lịch livestream. Label bottom nav luôn ở một dòng, không xuống dòng và không được truncate/cắt chữ; nếu label dài như `Trang cá nhân` thì phải tinh chỉnh grid/icon/font/padding để vẫn đủ chỗ. Active bottom nav không dùng nền xanh; chỉ đổi màu icon/text và hiển thị một thanh chữ nhật phía trên item active, sát mép trên và phủ đúng chiều rộng một item, tương đương 1/6 chiều dài thanh menu. Student scope gồm danh sách/chi tiết lộ trình, trạng thái enrollment/trial nếu API trả, và CTA vào học/học thử/mua lộ trình; payment thật vẫn nối ở `M8.4`. Quyết định owner ngày 2026-07-17 cho M4: flow chính là tạo lesson metadata trước, upload một source PDF/tài liệu dài ở cấp lộ trình, worker dùng paid OCR-first bằng Mathpix hoặc import artifact cache theo `content_hash`, admin gán page range cho từng lesson, rồi worker chunk theo `lesson_id`; mỗi lesson có action upload/thay thế tài liệu gốc riêng, còn upload lẻ bổ sung là `SUPPLEMENT`. `M4.2` đã làm source document + page range + primary/original document replace + supplemental document API/schema; `M4.3` đã nối BullMQ worker foundation; `M4.4` đã làm paid OCR artifact import + chunk theo mapping/primary replacement/supplement; `M4.5` đã làm UI upload source document, gán trang, upload/thay thế tài liệu gốc và upload bổ sung theo lesson. Admin course code hiện tách theo screen tại `apps/web/features/admin/courses/screens/<screen>/index.tsx`; component local của từng màn nằm trong `screens/<screen>/components`, còn component dùng chung role admin nằm ở `apps/web/components/admin/courses`. Form controls dùng shared primitives từ `apps/web/components/common/forms`; các task UI sau phải kiểm tra shared/approved patterns trước khi tạo control/hook/client mới.

- Cập nhật sau cùng cho M4 OCR ngày 2026-07-18: mọi nhắc tới `extract/OCR theo trang` trong context cũ phải hiểu là paid OCR-first bằng Mathpix hoặc import artifact cache theo `content_hash`, lưu page text/Markdown/LaTeX/layout/visual refs để dùng lâu dài cho RAG, quiz, flashcard, bài thi và visual Q&A. Mathpix `conversion_formats` không được chứa `.mmd` hoặc `lines.json` vì đây là output mặc định; nếu provider trả filename ảnh dạng page number không padded như `-1_...jpg`, image parser phải vẫn nhận. Mathpix `.mmd.zip` crop filename dùng thứ tự `{height}_{width}_{topLeftY}_{topLeftX}`, không phải `{x}_{y}_{w}_{h}`. Mọi crop/ảnh provider trả về phải được normalize vào `image-manifest.json`, kèm quality flags/`isUsableForAi`; `artifact-audit.json` lưu page/printed-page/image/data-quality checks và resolver smoke tests; các task visual sau này ưu tiên resolver trên manifest + audit trước khi render/crop PDF gốc fallback. Artifact/page/chunk/image metadata lưu `printedPage` để map `pdfPageNumber` sang `printedPageNumber`/`printedPageLabel`; nếu OCR thiếu hoặc mơ hồ thì lưu `warning`, còn offset rule chỉ bù khi đủ anchor đáng tin. Live test nguyên cuốn `Toan-7-Tap-1-lam-net.pdf` đã chạy Mathpix thật 122 trang, cache key `ocr-artifacts/mathpix/7bcb6086468b945cff0cb8a970b036af551bd123721f7015d4310bdbbebe9fcf/868951dd1b9de35a`; audit cuối có 122/122 page text, 341 images, 0 bbox normalized lỗi, 0 CDN/includegraphics còn trong caption/nearby text, `printedPage 35` resolve đúng PDF page 36. `test:m4.4:live` phải build trước khi chạy vì `#api` runtime imports trỏ `dist`. Không tích hợp UI/API/worker tiền xử lý ảnh/PDF trong MVP; nếu file quá xấu, owner xử lý ngoài hệ thống rồi upload lại như file gốc mới. User-upload trong chat sau này là attachment runtime riêng theo user/session/message, không trộn vào OCR artifact cache của tài liệu nguồn.

## 4. Khi nào cập nhật file này

Codex nên cập nhật file này khi:

- Hoàn thành một milestone/subtask nền tảng.
- Có quyết định workflow hoặc kiến trúc ảnh hưởng nhiều task sau.
- Task tiếp theo khuyến nghị thay đổi.
- Có blocker hoặc assumption quan trọng cần nhớ qua phiên sau.

Không ghi secret, token, API key, private URL hoặc dữ liệu người dùng thật vào file này.
