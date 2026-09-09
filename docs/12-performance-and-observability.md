# 12. Performance And Observability

File này là chuẩn hiệu năng và đo đạc cho toàn hệ thống. Nó bổ sung cho `docs/11-ui-design-system.md`: file 11 tập trung vào cảm giác UI/mobile, file này bao phủ frontend, API, database, worker, AI/RAG và observability.

Mục tiêu: Codex không chỉ code "chạy được", mà phải code theo hướng nhanh, đo được, dễ phát hiện chậm và không tạo bottleneck sớm.

---

## 1. Nguyên tắc chung

- Không tối ưu mù. Với thay đổi quan trọng, phải có cách đo hoặc ít nhất có lý do kỹ thuật rõ.
- Tối ưu theo đường đi thật của người dùng: landing/course list, auth, lesson, quiz/flashcard/test, payment, AI chat, parent dashboard, admin CRUD.
- Với frontend, tốc độ load trên điện thoại là đường đo mặc định cho mọi loại tải: cold first load, route transition, data fetch/refetch, asset/font/image load, hydration và pending interaction. Một đường tải nhanh sau khi app đã hydrate/cache không đủ để kết luận màn đã tối ưu nếu đường tải khác còn chậm.
- Ưu tiên perceived performance: phản hồi UI ngay, skeleton ổn định, API/job có trạng thái rõ.
- Không dùng thêm cache, queue, index hoặc abstraction phức tạp nếu chưa có bottleneck hoặc nhu cầu rõ.
- Task nhỏ có thể dùng lean mode, nhưng task chạm performance của flow chính phải ghi rõ check đã chạy hoặc `Not run`.

---

## 2. Performance budget mặc định

Các con số dưới đây là mục tiêu định hướng, không phải lý do để trì hoãn MVP khi chưa có đủ hạ tầng đo.

| Hạng mục                    | Mục tiêu MVP                                                           |
| --------------------------- | ---------------------------------------------------------------------- |
| Mobile LCP                  | Hướng tới tốt theo Core Web Vitals                                     |
| Mobile INP                  | Tương tác chính phản hồi nhanh, không lag rõ                           |
| CLS                         | Thấp; skeleton/placeholder không làm layout nhảy mạnh                  |
| API read phổ biến           | p95 nên hướng tới dưới `500ms` khi không gọi provider ngoài            |
| API write phổ biến          | p95 nên hướng tới dưới `800ms` khi không có side effect nặng           |
| Endpoint gọi provider ngoài | Trả job/status hoặc pending state nếu có thể lâu                       |
| List/table                  | Phải phân trang, infinite query hoặc virtualize khi dữ liệu có thể dài |
| Database query chính        | Có index cho filter/sort/search thường dùng                            |

Nếu chưa đo được p95, Codex phải dùng check thay thế hợp lý: curl timing, log duration, browser Network tab, Lighthouse hoặc test focused.

---

## 3. Frontend performance

Codex phải ưu tiên:

- Next.js route/page nhỏ, tách component theo feature.
- Lazy load phần nặng hoặc ít dùng như editor, chart, AI panel, admin tool.
- Không kéo form/modal/drawer/editor/chart/admin tool chưa dùng vào client bundle ban đầu; dynamic import/lazy-load khi người dùng mở hoặc chuẩn bị mở.
- Dùng server render, initial data hoặc placeholder data an toàn để giảm thời gian skeleton ở lần mở đầu, kể cả khi đang dùng mock data.
- Không render full-page loading ngay cho request ngắn vì sẽ tạo hiệu ứng nháy khi hydrate/F5. Nếu chưa có initial data, trì hoãn loading khoảng `250-300ms`; khi loading đã xuất hiện, giữ tối thiểu khoảng `300ms` để trạng thái không chớp một khung hình rồi biến mất.
- Prefetch/cache route và data hợp lý để chuyển trang nhanh nhưng không refetch thừa; tránh màn trắng trong route transition.
- Nếu CTA dùng branded/full-screen transition trước khi đổi route, phải bắt đầu
  `router.prefetch` và data prefetch/fetch vào cache ngay trong cùng click với
  animation. Không được chờ transition chạy xong mới gọi API. Có thể chờ đồng
  thời thời gian hiển thị tối thiểu ngắn để copy thương hiệu đủ đọc và dữ liệu
  cốt lõi; nếu API chậm hơn thì giữ overlay. Thời gian tối thiểu phải chạy song
  song với request, không nối tiếp sau request; khi route đích commit thì mở
  overlay ngay, không thêm một khoảng hold thứ hai làm chậm flow.
- Giảm asset/font/image trên mobile: chỉ tải kích thước cần, lazy-load media ngoài viewport và không kéo font/weight không dùng.
- API/data cho UI phải trả đúng metadata cần hiển thị, có pagination/list limit, tránh trả rich text/blob/include lớn nếu màn chưa dùng.
- Tránh hydration mismatch trên mobile: formatter ngày/tiền/sort phải deterministic giữa server và client; browser-only logic chỉ chạy sau hydrate; attribute do browser/autofill chèn vào input phải được xử lý ở primitive phù hợp.
- TanStack Query cho cache, `staleTime`, prefetch, mutation pending và invalidate.
- Cấu hình AI theo phase dùng cùng một request `GET/PUT ai-configurations` cho
  tối đa tám item; không fetch riêng từng feature hoặc từng phase. Modal sinh
  Summary/Quiz nhận cả cấu hình text/ảnh từ panel data hiện có, không tạo query
  model thứ hai khi mở modal.
- Debounce search/filter/input gọi API liên tục.
- Pagination/infinite query/virtualization cho danh sách dài.
- Tối ưu image: kích thước phù hợp mobile, responsive image, lazy load ảnh ngoài viewport.
- Font tải gọn, tránh nhiều font/weight không cần thiết.
- Không render toàn bộ data lớn trong client component.
- Không dùng animation trên thuộc tính gây layout/reflow nặng; ưu tiên transform/opacity.

### 3.1. Bundle isolation khi admin và client chung Next app

Khi admin, public, student và parent cùng nằm trong `apps/web`, Codex phải kiểm tra bundle theo route thật, không kết luận dựa trên tên folder.

Rules:

- Root `app/layout.tsx` chỉ được chứa provider, CSS, script và shell thật sự cần cho mọi route. Toaster, admin shell, editor, chart, export tool, upload tool hoặc panel nặng chỉ nên mount trong route group cần dùng như `(auth)`, `(admin)`, `(student)` hoặc lazy-load theo tương tác.
- CSS global chỉ giữ reset/base, theme token và utility dùng chung. CSS chỉ phục vụ admin phải nằm ở route group admin hoặc stylesheet scoped và import từ `(admin)/layout.tsx`; không để selector admin nằm trong `globals.css` nếu public route không cần.
- Route page nên import trực tiếp screen entry cần render, ví dụ `@/features/admin/courses/screens/admin-courses-manager`, thay vì import từ file re-export/barrel. Với front-end, tránh tạo barrel chỉ để gom import cho tiện.
- Component admin ít dùng như modal form, archive dialog, editor, chart hoặc export panel phải dùng `next/dynamic`/lazy-load khi có thể, đặc biệt nếu phụ thuộc `react-hook-form`, editor, chart, PDF/Excel/CSV hoặc animation library.
- Không đặt dependency chỉ dành cho admin trong shared component/provider dùng bởi public route. Nếu shared component bắt buộc cần icon/toast/editor nặng, tách phần nặng thành component con lazy-loaded hoặc route-specific wrapper.
- Asset/ảnh/font chỉ dành cho auth/admin không preload ở root layout. Dùng import/`img`/`next/image` tại route cần hiển thị và kiểm HTML output để chắc public page không preload asset không liên quan.

Verification khi chạm bundle hoặc layout:

- Chạy production build và đọc route manifest/client reference manifest hoặc curl HTML production để so `/` với route admin chính.
- Kiểm route public không có module/chunk tên feature admin, CSS admin hoặc asset admin/auth không liên quan.
- Ghi số đo trước/sau theo raw/gzip nếu task mục tiêu là giảm tải, ví dụ tổng JS+CSS của `/` và phần extra của `/admin/courses`.

Khi connect API:

- UI phải có pending state ngay khi mutation bắt đầu.
- Không optimistic UI cho payment, auth, permission hoặc dữ liệu cần xác nhận server nghiêm ngặt.
- Query key phải rõ theo domain/user/role để tránh cache sai dữ liệu.
- Error state phải cho retry hoặc hướng xử lý thân thiện nếu phù hợp.

---

## 4. Backend/API performance

Codex phải ưu tiên:

- API list phải có pagination mặc định.
- Controller mỏng; service chứa nghiệp vụ; DB/provider đi qua service/repository phù hợp.
- Không xử lý tác vụ nặng trong request nếu có thể enqueue job BullMQ.
- Prisma query chỉ `select/include` field cần dùng.
- Tránh N+1 query; gom query hoặc dùng relation/select hợp lý.
- Không tin filter/sort từ client nếu gây query quá rộng; validate input và giới hạn page size.
- Endpoint có side effect nặng phải có timeout/error rõ.
- Log duration cho endpoint/job quan trọng khi hạ tầng logging sẵn sàng.

Các flow cần chú ý độ trễ:

- Login/register/refresh.
- Course list/detail.
- Lesson content.
- Quiz/test submit.
- Payment create/status/webhook.

Riêng Quiz `M7.2`, response start/resume được phép trả dữ liệu chấm cho client
theo quyết định sản phẩm ưu tiên tốc độ. `Kiểm tra đáp án` phải chấm local và
không tạo request từng câu; `Hoàn thành` gửi toàn bộ answer trong một request để
backend chấm/lưu authoritative.

- Notification list/bell.
- AI chat/generate/job status.

---

## 5. Database performance

Codex phải kiểm tra index khi thêm hoặc sửa query chính:

- Filter/sort theo `user_id`, `course_id`/`learning_path_id`, `chapter_id`, `lesson_id`, `status`, `created_at`, `updated_at`.
- Unique/idempotency key cho payment/webhook/job/cache.
- Enrollment active lookup.
- Notification recipient/time.
- Attempt/progress theo student/course/chapter/lesson.
- Completion guard khi reorder lesson dùng existence/aggregate theo index `(lesson_id, status)`, không N+1 từng lesson và không trả danh sách student progress ra course detail.
- Report moderation status.
- Vector index cho embedding search khi triển khai pgvector.

Rules:

- Không query bảng lớn không phân trang.
- Không trả JSON/blob/rich text lớn nếu màn chỉ cần metadata.
- Không join/include nhiều quan hệ nếu UI không dùng.
- Course detail query có thể trả cây `chapters -> lessons`, nhưng chỉ trả metadata cần cho UI; tài liệu/rich text lớn của lesson phải lazy-load ở lesson detail.
- Với query phức tạp, cân nhắc raw SQL có kiểm soát và ghi rõ lý do.
- Migration thêm index phải được commit cùng thay đổi schema/query liên quan.

---

## 6. Worker, queue và integration performance

Tác vụ nên dùng worker/job:

- Paid OCR artifact import/chunking.
- Embedding.
- AI generate quiz/flashcard/test/summary.
- Email/Zalo notification.
- Ảnh minh họa/render nặng nếu có.

AI generation và embedding hiện dùng chung `WORKER_CONCURRENCY_AI=4`: mỗi
worker process có thể xử lý tối đa bốn job của queue AI generation và đồng thời
bốn job của queue embedding. Khi chạy nhiều worker process, concurrency hiệu
dụng tăng theo số instance; cần theo dõi provider rate limit, chi phí, CPU/RAM,
database connection và tỷ lệ retry trước khi scale thêm.

M6.6 dùng một versioned Quiz/Assessment job path cho Admin Quiz/Test. Metric,
job result, trace và usage phải luôn có `assessmentKind` cùng target ID; target
Test không được nhầm với target Quiz. `AiGenerationType.TEST` vẫn là dimension
provider/accounting. Request duration từ AI modal là metric/validation failure,
không phải fallback; duration chỉ được resolve từ TestSet sau authorization.
Trong cutover cần theo dõi job legacy/new theo version và không retry một job
với contract khác. Sau deploy worker, restart worker trước khi realtime visual
smoke test.

Riêng Summary có `TEX_FIGURE`, generation và render là các bước tách biệt.
Structured-output call của Summary chỉ sinh nội dung + figure plan. Mỗi figure
dùng một structured-output call chuyên vẽ, lưu raw core fragment rồi enqueue một
`DIAGRAM_RENDERING` job. Worker figure mặc định concurrency 3 để xử lý tối đa ba
hình đồng thời trong mỗi worker process. Chỉ chạy một worker process ở local;
nếu scale nhiều instance thì concurrency hiệu dụng tăng theo số instance và phải
theo dõi CPU/RAM, compile latency, timeout cùng tỷ lệ repair để hạ mức khi quá
tải. Các figure của cùng một Summary được enqueue đồng thời bằng `Promise.all` để
không kéo dài bước persist; thứ tự hoàn tất không phải contract. API/UI luôn sắp
xếp danh sách theo vị trí số
`section -> block -> figureIndex` để thứ tự hiển thị ổn định. UI dùng một query
figure duy nhất, invalidate ngay khi job Summary terminal và poll 1,5 giây khi
còn figure active để đồng bộ ảnh/counter.
Isolated renderer còn có compile concurrency toàn cục độc lập với các queue;
container 1 vCPU dùng mặc định `1`. LuaTeX font-name database phải được tạo sẵn
thành seed trong image rồi copy một lần sang cache writable dùng chung trong
tmpfs, không rebuild trong `HOME` tạm của từng request. Hai lớp này giữ queue
throughput nhưng ngăn nhiều loại figure cùng làm quá tải CPU renderer.

Ngoại lệ M9.17: khi job snapshot `useTextbookSourceImages=true`, Phase 1 vẫn chạy
như cũ nhưng worker chỉ copy/normalize crop OCR hợp lệ sang delivery asset và
không enqueue `DIAGRAM_RENDERING`. Metrics phải ghi riêng mode, số crop tự điền,
số figure cần xem lại, số figure do AI đề xuất bị bỏ qua và xác nhận
`phase_two_enqueued_count=0`, `phase_two_provider_call_count=0`. UI không cần
poll figure rendering nếu sau bước import không còn figure active.
Nếu snapshot `autoEnhanceTextbookSourceImages=true`, Sharp chạy local trên từng
crop ngay trước upload delivery và vẫn tuân pixel/byte cap M9.18. Ghi thêm
`sourceFigureEnhancedCount`; không log bytes/object key và không gọi provider.

Performance và cost rules:

- Source policy/compile/validator chạy local; chỉ lỗi source mới gọi OpenAI repair.
- Output token của Summary scale theo `targetWordCount` và có hard cap; route
  figure có output budget riêng. Không dùng một max-token cố định cho cả bài ngắn
  lẫn bài chi tiết dài.
- Output token của Quiz có floor theo `questionCount` và dạng câu dài nhất đã
  chọn, giữ tối thiểu 12.000 và hard cap 32.000. Preview, request draft, budget
  reservation và worker phải dùng cùng resolved limit; request vượt cap cần chia
  batch thay vì âm thầm cắt output.
- Provider output deterministic-invalid hoặc incomplete trước khi có source kết
  thúc paid attempt với error code ổn định; BullMQ không gọi lại y hệt request đó.
- Theo dõi riêng `provider_output_pass`, `source_policy_pass`, `compiler_invoked`,
  `first_compile_pass`, `first_pass_succeeded`, `repair_count` và
  prompt/toolbox/compiler-profile version. `first_compile_pass` tính trên lần
  LuaLaTeX đầu của raw figure snippet trong compiler envelope chuẩn;
  `first_pass_succeeded` chỉ true khi raw snippet qua policy, compile và validator.
  Không thêm dependency vào source để làm đẹp chỉ số. Trường
  `local_dependency_recovery` cũ có thể giữ trong schema lịch sử nhưng flow mới
  không phát sinh hoặc dùng nó để sửa package/library declaration.
- Compiler failure phải ghi structured issue trước, kèm phần đuôi raw log có giới
  hạn; không chỉ giữ phần đầu log. Nhờ vậy `lastErrorMessage`/attempt log còn chứa
  lỗi gốc và dòng source sau khi bị clamp cho UI hoặc database.
- Mỗi figure mặc định tối đa 1 lượt AI repair. Lỗi transport tạm thời của
  provider/renderer/network dùng BullMQ retry riêng, tối đa 3 attempt với
  exponential backoff và không gọi AI repair; mỗi provider attempt có usage/
  reservation idempotency riêng để không gộp sai chi phí. Lỗi source, validator,
  budget và provider output xác định không đi qua nhánh retry này.
- Compile + validator pass mới upload/promote delivery SVG lên R2. Candidate
  `NEEDS_REVIEW/FAILED` giữ private artifacts và không ghi đè current asset.
- Student không compile hoặc poll job, chỉ tải current SVG/raster đã promote từ R2.
- `solutionFigure=false` không tạo job/asset hình lời giải và API không nhân đôi
  URL hình đề. `solutionFigure=true` tạo đúng một call Phase 2 độc lập cho hình
  lời giải, không chờ hoặc đọc hình đề; output full source vẫn dùng cùng queue,
  output budget và compile/validator pipeline, không gọi thêm provider để nối,
  mở rộng hay chuyển style từ hình đề.
- Cache/idempotency dùng `sourceHash + sourceVersion`; source không đổi không
  được tạo lại cùng job đang active.
- Giới hạn mặc định: source 40 KB, SVG 2 MB, 20.000 node, 1,5 triệu ký tự path,
  compile timeout 20 giây và request timeout 30 giây.
- Metrics/log cần tách `SOURCE`, `VALIDATION`, `INFRASTRUCTURE`,
  `ADMIN_REVIEW`; theo dõi compile latency, repair count, queue wait, tỷ lệ
  `SUCCEEDED/NEEDS_REVIEW/FAILED` và bytes/nodes output.
- Figure light-only; dark UI dùng surface sáng nên không tăng gấp đôi compile,
  storage hoặc visual-review matrix.
- Coverage/test representative phải trải lớp 3–12 và các package đã công bố,
  nhưng mặc định dùng fixture local. Live OpenAI test luôn opt-in và phải tuân
  cost guard.
- Quiz `Tinh chỉnh` là một paid call theo thao tác chủ động, không chạy tự động
  sau mỗi lần sinh. Worker tải SVG current tối đa 2 MB, raster PNG nền trắng với
  cạnh dài tối đa 1600 px, gửi đúng một ảnh `detail=high` cùng source/plan và dùng
  route `QUIZ/IMAGE`; riêng EXTEND gửi thêm exact PNG/source hình đề. Source
  current là candidate audit, còn plan là authority; prompt phải yêu cầu dựng mô
  hình ràng buộc độc lập trước khi tái sử dụng code cũ. Log/usage phải phân biệt operation `REFINE_CURRENT`, origin
  và attempt kind `AI_REFINEMENT`; không log raw source, data URL hoặc object key.
  `adminInstructions` tùy chọn phải nằm trong dynamic user input sau stable
  prefix, được trim và bỏ khỏi request khi rỗng; preview và execute phải dùng
  cùng giá trị. Stable refinement prompt dùng Toán v34, Lý v24, Hóa/General v23;
  output schema `quiz-figure-refinement-schema-v3-independent-solution` giữ
  nguyên. Thay đổi thuộc loại
  `NEW_STABLE_PREFIX_WARMUP`: cache cũ không được tái sử dụng và cần warmup lại
  prefix mới; schema/order/breakpoint không đổi và không có invalidation dữ liệu
  runtime ngoài version key. Sau warm-up, dynamic problem/source vẫn nằm sau
  breakpoint nên request cùng subject × mode tiếp tục dùng chung cache key.
- Invariant cùng độ dài render cho một đơn vị ngữ nghĩa trên hai trục Descartes
  chỉ đổi stable prompt Toán của các mode semantic Quiz/StemFigure, không đổi
  schema, tool, thứ tự request hay breakpoint. Đây là `NEW_STABLE_PREFIX_WARMUP`:
  prefix cũ không tái sử dụng cho version mới; sau warm-up, các input động cùng
  subject × mode vẫn dùng chung cache key. Technical repair và môn khác giữ nguyên.
  Preview modal được phép raster hóa/tính token nhưng không gọi provider; JSON
  hiển thị thay bytes ảnh bằng placeholder để tránh payload DOM quá lớn. UI giữ
  current asset và hiển thị trạng thái candidate trong normal flow; không polling
  hoặc gọi lại provider sau terminal state.
- Quy tắc không cho text node dạng câu/câu dẫn/callout `tên thông tin: giá trị`
  đổi stable system prompt của mọi subject × mode trong Quiz Figure và
  Summary/StemFigure. Rollout là `NEW_STABLE_PREFIX_WARMUP`: tăng prompt version,
  không tái sử dụng cache key cũ; schema, tool, thứ tự request và breakpoint giữ
  nguyên. Auto-repair narrative chạy local trước compile, không thêm provider
  call; log chỉ ghi số deterministic source repair, không ghi raw node text.
- Quy tắc cung góc numeric và marker trung điểm gọn chỉ đổi stable
  system prompt Toán của Quiz Figure và Summary/StemFigure. Rollout là
  `NEW_STABLE_PREFIX_WARMUP`: tăng prompt version theo subject × mode, không
  tái sử dụng cache key cũ; schema, tool, thứ tự request và breakpoint
  không đổi. Hai auto-repair chạy local trước compile, không thêm paid
  provider call và chỉ log metadata thay đổi, không log raw source. Cùng
  pipeline normalization được phép hoist local header đặt nhầm trong root;
  thao tác này không đổi cache key, schema hay tăng compile/provider call.
- Preview tạo hình Quiz từ header dùng cùng builder/schema/route với execute,
  không tạo figure/job và không gọi provider. Mỗi lần admin bấm `Thực hiện` chỉ
  tạo tối đa một paid call cho target đã chọn; thay hình đề không âm thầm sinh lại
  lời giải EXTEND, tránh nhân đôi chi phí ngoài dự kiến.
- Question Figure Core dùng chung cho Summary/Quiz có schema
  `question-figure-schema-v1`, prompt version
  `question-figure-<subject>-v1-shared` và namespace `question-figure`. Rollout
  là `NEW_STABLE_PREFIX_WARMUP`: không tái sử dụng prefix hình đề cũ, không dùng
  chung cache giữa subject hoặc với Solution Figure Core; sau warm-up, phần
  problem/current source động vẫn nằm sau stable breakpoint. Preview chỉ dựng
  request/token/cost estimate, không gọi provider; execute giữ tối đa một paid
  call do adapter domain sở hữu.
- Preview hai action lời giải AI M9.24 chỉ dựng request, token/cost estimate và
  request hash; không gọi provider. Execute tạo tối đa một job và một paid call,
  tái sử dụng job còn hoạt động của cùng câu hỏi, `maxAttempts=1`, đồng thời kiểm
  base-content hash trước call và trước persist để tránh trả phí/ghi đè từ snapshot
  cũ. `REGENERATE` đính kèm ảnh hình đề hiện tại nếu có; stable prompt cache tách
  namespace theo subject × mode × loại câu và nội dung động nằm sau breakpoint.
- Checkbox rejected candidate của luồng tạo lại lời giải mặc định tắt. Nhánh bật
  dùng prompt version + namespace riêng và chỉ thêm current solution; preview
  không gọi provider trả phí.

Provider operations rules:

- Timeline/breakdown lọc tối đa 366 ngày, event list phân trang và có index theo thời gian/category/provider/feature; chart admin không thêm thư viện nặng.
- Nhãn mục đích của từng usage event phải ưu tiên operation cụ thể từ
  `backgroundJob.resourceType` trước nhãn feature tổng quát. Tối thiểu phải phân
  biệt `STEM_FIGURE` là `Tạo hình minh họa` và `QUIZ_FIGURE` là
  `Tạo hình minh họa Quiz`; chỉ fallback về `SUMMARY`/`QUIZ`/`FLASHCARD`/`TEST`
  khi event không có resource type chuyên biệt.
- Nhãn đích `M9.32` phải đọc trực tiếp từ snapshot trên usage event; endpoint list
  không truy vấn từng block/câu/thẻ để dựng nhãn và không phát sinh N+1. Snapshot
  được ghi trước provider call để cả latency, lỗi và chi phí của attempt thất bại
  vẫn gắn đúng đích. Backfill lịch sử chỉ resolve theo batch và không đoán khi
  quan hệ không duy nhất.
- OCR cache hit không tạo delay giả. Mathpix retry resume `pdfId` đã lưu để tránh double-charge; debug artifact local tắt mặc định ở production.
- Hard-stop `M9.12` serialize ngắn chỉ ở bước reserve theo `period + scope`; không giữ database lock trong lúc gọi provider. Lock scope theo thứ tự cố định để tránh deadlock.
- Reservation AI lấy giới hạn input/output từ cấu hình của đúng feature, không
  lấy từ catalog model hoặc bảng giá. Log/metric phải phân biệt cấu hình thiếu
  giới hạn và budget không đủ; cả hai đều bị chặn trước provider call.
- Theo dõi metric/log `budget_reservation_granted`, `budget_reservation_denied`, `budget_reservation_uncertain`, thời gian chờ lock, reconciliation drift và số job bị chặn không retry. Cảnh báo nếu actual cost vượt reservation hoặc có reservation `UNCERTAIN` quá SLA.
- Có reconciliation idempotent cho reservation bị bỏ lại do crash; fail-safe giữ ngân sách thay vì tự release khi chưa rõ provider đã bill hay chưa.

Rules:

- API tạo job nên trả `202 Accepted` hoặc response có `jobId` khi xử lý lâu.
- UI phải poll/refetch hoặc nhận realtime status nếu flow cần.
- Job phải idempotent khi có thể.
- Job status phải đủ để UI hiển thị pending/success/error/retry.
- Không để worker lỗi âm thầm; lỗi phải lưu log/status phù hợp.

---

## 6.1. Smart video tracking performance (`M15`)

- Không gửi API theo từng `timeupdate`/frame của player.
- Heartbeat mặc định theo batch khoảng 10-15 giây; flush thêm khi pause, seek, đổi chapter, ended hoặc `pagehide`.
- Client chỉ cập nhật React state khi active transcript/checkpoint/chapter thực sự thay đổi; current time liên tục ưu tiên ref/store tách biệt để không re-render form/transcript lớn.
- Heartbeat phải có idempotency key, payload giới hạn và retry có backoff; server merge watched intervals thay vì cộng dồn mù.
- Analytics/difficulty dùng aggregate theo time bucket. Không query hoặc trả raw event stream trên lesson page.
- Semantic search/AI context lazy-load khi học sinh mở panel; không đưa embedding/search/AI bundle vào đường tải player ban đầu nếu chưa dùng.
- Đo riêng player start latency, heartbeat error rate, interval merge duration, smart-resume latency và contextual AI latency.

---

## 7. AI/RAG performance

Corrective M9.2 đã triển khai: figure plan v3 bỏ `visualIntent`, giảm
một phần text input Stage 1/Stage 2 và dùng projection block cố định. Observability
phải tách metrics theo source/no-source/admin-delta, theo dõi ambiguity gate trước
paid call và xác nhận không còn active job v1/v2 sau cutover. Không triển khai
rolling API/worker khác version; worker phải được restart sau release.

AI là phần dễ tạo độ trễ và chi phí cao, nên Codex phải:

- Không gọi AI đồng bộ cho tác vụ generate nặng nếu có thể dùng job.
- Không gửi toàn bộ PDF/tài liệu mỗi lần hỏi.
- Retrieval chỉ lấy context cần thiết theo `lesson_id`; không có retrieval cấp chapter ở MVP.
- Cache AI explanation theo item khi docs đã quy định.
- Giới hạn số chunk/context đưa vào model.
- Validate JSON Schema/Zod kỹ thuật trước khi lưu. Summary hợp lệ được lưu để
  admin sửa trực tiếp; không hiển thị warning kỹ thuật và không gọi provider
  repair lần hai.
- Với Phase 1 Summary/Quiz, chỉ giao model các vòng kiểm chứng không thể làm
  deterministic như tính đúng chuyên môn, điều kiện áp dụng, mạch suy luận, độ
  khớp nguồn và tính mới. Shape/required/enum và exact count Quiz thuộc schema;
  count Summary chỉ nêu một lần trong generation contract. JSON transport, ký tự
  điều khiển, delimiter/môi trường LaTeX và chuẩn hóa đoạn kết luận an toàn
  thuộc normalizer/backend. Không lặp các vòng rà cơ học này trong system prompt
  hoặc schema description vì chúng tăng input/reasoning mà không tăng coverage.
- Có fallback/error state thân thiện khi provider chậm/lỗi.
- Ghi log usage/duration khi module AI log đã có; mỗi provider attempt snapshot
  cả Reasoning Effort đã resolve và mã tác vụ theo mục đích nghiệp vụ để so sánh
  latency/chi phí giữa các workflow mà không suy ngược từ model.
- Structured response incomplete/refusal phải log mã lỗi ổn định, `status`,
  `incomplete_details.reason`, request ID, model, latency và usage; chỉ log độ dài
  partial output, không log raw prompt/chunk/output. Response đã có usage phải được
  tính chi phí dù generation không persist được; response đã về nhưng thiếu usage
  giữ reservation `UNCERTAIN` thay vì giải phóng như một lỗi trước-provider.
- Với Summary và Quiz, log thêm `promptVersion`, `schemaVersion`, schema strategy
  requested/resolved, schema bytes,
  `cachedInputTokens`, `cacheWriteInputTokens`, `uncachedInputTokens` và cache-hit
  ratio; không log raw instructions, input, chunk hoặc cache key chứa dữ liệu
  người dùng.
- Prompt Caching chỉ giảm phần input bị tính phí/độ trễ theo policy provider,
  không giảm tổng token được gửi. UI và báo cáo phải tách tổng input khỏi cached
  input và cache-write input để tránh hiểu sai việc tối ưu cache thành cắt dữ
  liệu nguồn. OpenAI GPT-5.6+ tính cache write bằng `1.25x` input thường và cache
  read bằng cached-input rate; reservation trước call phải giữ trường hợp xấu
  nhất `1.25x` cho toàn bộ input có thể được ghi cache.
- Summary/Quiz trên GPT-5.6+ phải dùng explicit breakpoint chính xác ở cuối
  system/developer prompt ổn định; mọi PDF, manifest, custom user request và dữ
  liệu theo lesson đứng sau breakpoint. `prompt_cache_options` dùng TTL `30m`;
  không gửi `prompt_cache_retention` deprecated cho nhóm model này.
- Index chống trùng câu hỏi hiện có của Quiz là dữ liệu theo lesson nên phải đứng
  sau explicit breakpoint. Chỉ serialize loại câu, đề bài plain text và phần
  phương án/mệnh đề thực sự thuộc nội dung câu hỏi; bỏ đáp án, hint, lời giải,
  hình, ID/trạng thái/metadata, chuẩn hóa whitespace và gộp dòng trùng hệt. Hai
  index khác nhau của cùng static contract phải giữ cùng cache key/developer
  prefix; focused test phải khóa ranh giới này.
- Provider schema Summary và Quiz không lặp nguyên policy định dạng toàn cục trong
  từng field. Root schema giữ contract dùng chung; các field `solution` dùng một
  shared definition qua `$defs`/`$ref` để giữ conditioning riêng của lời giải mà
  không nhân bản theo từng loại example/question. Summary `ref_v2` phải giữ byte
  budget tối đa `22.000` cho Toán 7–9, `18.500` cho Toán 10–12 và `17.500` cho
  subject không phải Toán.
- Stage 2 tạo STEM figure chỉ gửi semantic brief tối thiểu và đúng danh sách ảnh
  vision thực tế. Mỗi source reference có nhãn gửi tối đa bốn crop khớp chính xác
  khác object key để giữ đủ panel. Trước provider call, worker tự xoay theo
  metadata, resize trong khung tối đa `2048x2048`, chuyển PNG và khử trùng lặp
  bằng SHA-256 của nội dung đã chuẩn hóa. Chỉ ảnh trùng nội dung mới bị loại;
  các panel khác nhau vẫn giữ nguyên thứ tự, gửi `detail=high` và mỗi ảnh ánh xạ
  một panel riêng. Nhãn mơ hồ chỉ chọn một crop. Ảnh nguyên trang
  PDF chỉ giữ làm fallback khi block không có nhãn hình cụ thể hoặc không resolve
  được crop đáng tin cậy. Không lặp provenance trang/object key/hash trong prompt.
- Route Phase 2 phải truyền nguyên `reasoningEffort` và `maxOutputTokens` đã resolve
  từ cấu hình `IMAGE`; service/worker không được có cap hoặc floor ẩn. Preview và
  runtime phải phản ánh cùng effective request. Prompt tạo/refinement chỉ giữ một
  cổng kiểm chứng chuyên môn cuối; các vòng rà schema, source policy, compiler và
  validator đã deterministic không được lặp trong prompt. Technical repair chỉ
  sửa diagnostics kỹ thuật đã thu gọn, mặc định tối đa một lượt AI sau auto-repair
  local, nhằm giảm tail latency và paid call lặp.
- Compiler diagnostic đầy đủ tiếp tục lưu trên render attempt. Payload repair
  chỉ gửi toàn bộ issue đã chuẩn hóa và tối đa `12.000` ký tự phần đuôi raw log
  cho category `COMPILER`; category khác không gửi raw log lặp lại issue.
- Figure Phase 2 của Quiz dùng profile môn chuyên vẽ thay vì hồ sơ generation
  Phase 1. Output schema chỉ còn source TeX cần dùng, schema strategy `auto` và
  prompt cache `in_memory`; không gửi các mảng báo cáo tự kiểm không được worker
  tiêu thụ. Request trace phải ghi requested/resolved strategy, schema bytes và
  ước tính text/image/total token; Quiz giữ trace trong durable job input metadata.
- Prompt cache, request draft và trace của Sinh kiến thức/Quiz phải phân vùng theo
  `subjectKey`; figure Phase 2 phân vùng thêm theo mode/role. Prompt version dùng
  cho Toán, Lý và Hóa phải khác nhau để cache hit hoặc retry không thể tái sử dụng
  system prompt chuyên môn của môn khác.
- Summary Ví dụ/Bài tập không ảnh nguồn dùng prefix/version riêng cho
  `GENERATE_SOLUTION_FROM_BLOCK` theo từng môn; Quiz dùng prefix/version riêng
  cho `SOLUTION` create/edit và refinement. Khi làm rõ quan hệ authority giữa
  `solution` với `problem`, các nhánh này là `NEW_STABLE_PREFIX_WARMUP`: không
  invalidate cache của Summary `GENERATE_FROM_BLOCK`, source-regenerate,
  current-edit hoặc Quiz `QUESTION`; nội dung động `problem`/`solution` tiếp tục
  nằm sau stable system prompt breakpoint.
- Với Sinh kiến thức, cặp `standardExerciseCount`/`realWorldExerciseCount` vừa nằm
  trong user prompt vừa tạo `minItems=maxItems` trong provider schema. Cache key
  phải khác nhau giữa các cặp số lượng để không tái sử dụng nhầm schema; cùng
  subject/model/prompt/schema strategy và cùng cặp số lượng vẫn dùng chung key dù
  lesson/PDF khác nhau. Đây là `CACHE_ARCHITECTURE_CHANGE`; mỗi tổ hợp số lượng
  cần warm-up stable prefix riêng.
- Preview request tạo lại STEM figure chỉ chạy theo thao tác `Xem dữ liệu` hoặc
  `Cập nhật dữ liệu`; đổi nguồn ảnh phải invalidate preview phía client thay vì
  âm thầm giữ request cũ. Preview chỉ resolve route/schema và ước tính token/chi
  phí, không gọi provider trả phí.
- Editor raster M9.18 phải được dynamic import. Preview dùng bản có cạnh dài tối
  đa `1600px`, làm nét tự preview một lần khi chọn; xóa chỉ preview sau một
  stroke/undo/redo hoàn tất với debounce ngắn, không gọi theo từng pointer move.
  Response cũ bị bỏ qua khi state đã stale và preview không ghi R2/database.
  Apply chạy đồng bộ chỉ khi ảnh/mask nằm trong pixel/byte/time cap
  versioned; ảnh vượt cap bị từ chối thân thiện thay vì giữ request lâu hoặc âm
  thầm giảm độ phân giải. Apply nối tiếp trong cùng modal dùng thẳng figure trả về
  để cập nhật ảnh và mutation guard; không chờ đóng/mở lại editor để lấy revision.
- `use-source-crop` chỉ chạy preset làm nét local đồng bộ khi request có
  `enhance=true`; nhánh `false` bỏ qua preset để promote crop đã chuẩn hóa.
  Nhánh làm nét phải dùng chung pixel/byte cap và không fallback sang crop thô
  khi xử lý lỗi. UI hiển thị pending ngay trong CTA và current asset chỉ đổi
  sau response thành công.
- Ghi `raster_edit_preview_duration_ms`, `raster_edit_apply_duration_ms`, loại
  operation, số pixel nguồn, output bytes, mask coverage, background variance và
  rejection reason. Không log raw image, mask, signed URL hay object key. M9.18
  không có provider usage và không thêm worker/job ở v1; mục tiêu p95 apply local
  trong giới hạn hợp lệ là `<= 3s`.
- Lesson detail chỉ polling tổng usage khi figure phase 2 còn hoạt động; khi phase
  chuyển sang terminal phải refetch một lần để chốt số tiền. Modal chi tiết usage
  chỉ polling khi đang mở, query theo `aiGenerationId`, phân trang và dùng aggregate
  server-side thay vì tải toàn bộ event về client để cộng.
- Khi test runtime với provider trả phí, ưu tiên cache/sample trước; forced/full run phải có ước tính usage/chi phí và xác nhận rõ của owner trước khi chạy.

---

## 8. Observability

Khi hạ tầng logging/monitoring được triển khai, cần có:

- Request duration theo endpoint.
- Error rate theo endpoint/job/provider.
- Slow query hoặc query duration cho flow nhạy cảm.
- Job duration, retry count, failed reason.
- AI provider latency, request ID, response status, incomplete/refusal reason và
  token/usage kể cả khi structured output không dùng được.
- Payment webhook verify/idempotency logs.
- Basic health check cho API/worker/Redis.

MVP chưa cần dashboard phức tạp ngay, nhưng code nên có điểm gắn log/metric rõ ở service/job/provider quan trọng.

---

## 9. Verification checklist

Khi task có ảnh hưởng performance, Codex nên chạy hoặc ghi rõ nếu bỏ qua:

- Frontend: browser check, Lighthouse/Web Vitals nếu app chạy được, hoặc ít nhất responsive + interaction check.
- API: curl timing, focused API test, log duration hoặc static review query path.
- Database: kiểm tra index/constraint liên quan query mới.
- Worker: job enqueue/status/error path.
- AI/RAG: cache/retrieval limit/provider timeout/error state.
- Bundle/dependency: không thêm package nặng nếu có cách nhẹ hơn.

Final response nên ghi ngắn:

```txt
Performance: checked <what> / Not run: <reason>
```

Không cần chạy full performance audit cho mọi task nhỏ; áp dụng theo rủi ro và bề mặt thay đổi.
