# Current Codex Context

Last updated: 2026-08-19

File này chỉ là điểm vào nhanh; source of truth vẫn là `AGENTS.md`, docs domain
và code hiện tại.

## 1. Hướng phát triển hiện tại

Owner chốt và đã triển khai corrective M9.2 ngày 2026-08-19:

- Xóa hoàn toàn `visualIntent` bằng hard cutover; không legacy reader, dual
  schema, fallback hoặc field mới trùng nghĩa.
- Figure plan đích chỉ nhận version 3. Phase 1 giữ provenance/source target và
  alt/caption; Stage 2 có ảnh dùng ảnh + target + projection block, không ảnh thì
  dùng projection block.
- Example không gửi solution/answer/conclusions sang lượt dựng hình.
- Migration một chiều cancel/invalidate job/snapshot v2 đã được thêm; deploy phải
  cập nhật API/web/worker cùng window và restart worker.
- Plan: `.codex/plans/m9-2-remove-visual-intent-hard-cutover-plan.md`;
  quyết định: `docs/decisions/ADR-0018-remove-visual-intent-hard-cutover.md`.
- M9.17 đã thêm checkbox `Dùng ảnh gốc sách giáo khoa` cho Summary.
  Cờ chỉ được đọc sau khi Phase 1 validate/map xong; request OpenAI Phase 1
  giữ parity. Tập crop khớp chắc chắn được promote lần lượt thành nhiều
  raster asset cùng block; candidate mơ hồ/full-page/thiếu crop giữ
  `NEEDS_REVIEW`; cả lượt không enqueue Phase 2.

Owner chốt ngày 2026-08-12:

- Nhánh cũ `codex/m9-2-classhero-authoring-v3` giữ renderer hình JSON cũ tại
  commit `b4fc4637092a688ff8425341ebb661e3a2cab3fa`.
- Nhánh hiện tại `codex/m9-texlive-tikz` thay hoàn toàn hệ thống cũ bằng
  TeX Live + LaTeX/TikZ. Không giữ runtime/schema/test cũ trên nhánh này.
- Phạm vi task hiện tại chỉ là “Sinh kiến thức”/Lesson Summary. Quiz, Flashcard,
  Test, Explanation và Chat giữ text-only.
- Hình STEM phải hỗ trợ lớp 3–12, không dùng giới hạn lớp 3–9 cũ.
- Figure chỉ có light theme; dark UI đặt hình trên surface sáng.
- Owner chốt ADR-0015 ngày 2026-08-13: AI/admin chỉ cung cấp LaTeX figure snippet
  gồm optional local header allowlist rồi đúng một drawing root. AI được chọn
  `usetikzlibrary`/`usepgfplotslibrary`, local `tikzset`/`pgfplotsset` không đổi
  `compat` và `tdplotsetmaincoords` trong versioned toolbox manifest; backend là
  nơi duy nhất sở hữu document wrapper/package/compiler preamble và phạm vi
  toolbox. Không có bất kỳ compatibility path nào cho standalone source cũ.
  Implementation snippet-only đã hoàn tất.
- Không có pipeline Vision hậu kiểm riêng. Lượt chuyên vẽ nhận crop/full-page ảnh
  tham chiếu đã resolve từ đúng source reference để bám bố cục/nhãn/phong cách
  SGK; brief và reference snapshot được giữ bất biến theo revision.
- Mọi request OpenAI tách theo `learning_path.domain`: lõi trung tính + đúng một
  subject profile; không trộn rule/package Toán, Lý, Hóa. Subject được snapshot
  vào job/figure/source hash và dùng lại cho Summary, Quiz, Flashcard, Test cùng
  compile repair. Schema Lý/Hóa/General không nhận field GT–KL của Toán.
- Figure coverage của lượt sinh mới dựa trực tiếp quan hệ hình nguồn–block trong
  PDF: hình hỗ trợ ở phía trước hoặc phía sau thì Stage 1 bắt buộc tạo brief;
  không dùng title/keyword, mức sàn toàn môn hoặc semantic coverage gate backend.
- Owner chốt không cần compatibility cho taxonomy lần này: persisted schema và
  renderer chỉ nhận đúng năm block; không nhận `procedure`/extended block cũ,
  `solution=null` hay local figure ID kiểu `F01`. Bài cũ phải sinh lại.
- Quy tắc chất lượng hình sau audit Bài 14: hình phải ưu tiên một thông điệp thị
  giác chính như sách; problem/theory cung cấp draw list, còn solution/answer chỉ
  là oracle kiểm chứng và không mặc định được đưa lên canvas. Hình học giải tích
  dùng coverage theo block để không ép ví dụ tính ký hiệu thành hình lời giải.

Pipeline đã chốt:

```txt
OpenAI sinh Summary + figure plan, chưa sinh TikZ
  -> mỗi figure gọi model độc lập bằng brief của đúng block sở hữu
  -> model chỉ trả LaTeX figure snippet
  -> lưu snippet model nguyên bản
  -> source policy kiểm local header/library/root/declaration
  -> backend ghép compiler envelope theo subject profile
  -> DIAGRAM_RENDERING compile raw fragment.tex trong main.tex envelope chuẩn
  -> TeX Live sandbox
  -> source error: source + log -> bounded OpenAI repair
  -> source policy/validator/provider/timeout/network/storage/hạ tầng: không tự retry
  -> dvisvgm -> local SVG validator/sanitizer
  -> compile + validator pass: atomic promote asset R2 thành SUCCEEDED
  -> compile pass + validator fail: NEEDS_REVIEW, giữ artifact private
  -> student chỉ nhận current SVG/raster đã promote
```

Không gọi provider trả phí thật trong verification mặc định. Trước live OpenAI
test phải báo rõ số request và ước tính chi phí để owner duyệt.

## 2. Trạng thái triển khai

Đã có:

- Shared `TEX_FIGURE` contract và Summary content version 3.
- Prisma `stem_figures`, `stem_figure_render_attempts`, enums/relations/indexes
  và migration `20260812150000_texlive_stem_figures`.
- `ai_explanations.diagram_spec_json` đã bị xóa.
- Admin STEM figure API: list/get/delete, direct draft compile/apply, retry,
  create-new-AI và replace-upload; không còn route update source/approve/reject
  cũ. PDF/SyncTeX edit-session đã bị loại khỏi phạm vi.
- Summary generation tạo figure plan; mỗi figure dùng một paid call tập trung,
  sau đó tạo revision + durable render job và cộng gộp usage/cost vào generation.
- Worker snippet source policy, isolated renderer client, bounded AI repair,
  attempt audit, SVG validator và status lifecycle. Backend sở hữu compiler
  envelope; không còn local dependency recovery tự sửa source.
- Docker TeX renderer riêng: non-root, read-only, tmpfs, no network, resource
  limits, LuaLaTeX + dvisvgm; PDF chỉ là file trung gian tạm, response chỉ có SVG.
- R2 delivery asset chỉ được promote sau compile + validator pass; candidate lỗi
  không ghi đè current asset. Publish chỉ bị chặn khi reference hoạt động chưa có
  current asset hợp lệ.
- Admin figure panel và student current-asset renderer.
- Quiz/Test đã tách khỏi renderer cũ và giữ text-only.
- Prompt/test invariant lớp 3–12.
- Subject-specific prompt/input/schema boundary và package validator đã có test
  chống rò profile chéo môn, gồm cả compile repair và admin source edit.
- Prompt/schema lượt sinh mới khóa năm block, cặp theory–example, note linh hoạt,
  provenance, lời giải chi tiết và semantic figure brief. Example Toán có
  `isGeometry`: Hình học lớp 7–9 bắt buộc GT–KL; Hình học lớp 10–12 và nội dung
  không phải Hình học bắt buộc không có bảng GT–KL.

Checks gần nhất:

- M9.17: API/web typecheck và scoped lint pass; backend regression 6/6 pass;
  full API suite 436 pass/6 skip; Playwright checkbox desktop + mobile 2/2 pass.
  Verification chỉ dùng mock/local artifact, không gọi provider trả phí.

- Searchable PDF Toán 12 scan thuần đã tạo bằng OCR local và promote sau
  equivalence 98/98 trang, similarity min/avg 1,0, 112/112 crop pass; Toán 7 dùng
  PDF searchable có sẵn. Summary gửi deterministic PDF packet bằng OpenAI
  `input_file detail=high`, không gửi OCR chunks.
- Live pilot mới: Bài 13 + Bài 14 Toán 12 và Bài 3 Toán 7, 31 Terra calls,
  38.325/110.000 VNĐ. 27 source AI, 26 qua source policy; 26/26 compiler
  invocation first-pass thành công, không compiler repair. Một source policy fail
  không auto retry; admin chủ động sinh mới và source mới first-pass pass.
- Visual review mới: 25/26 figure đạt rubric SGK (20 cao, 5 chấp nhận), F27 Bài
  13 cần sửa; Bài 14 có một bài camera tự biên soạn cần nêu giả thiết rõ. Prompt
  v2/v14 đã ưu tiên bài nguồn, giả thiết tường minh và bỏ pictogram trang trí.
- API full 340 pass/6 skip; shared/API/web typecheck và production build pass;
  clean database deploy đủ 37 migrations pass; targeted lint xanh. Full repo lint
  vẫn fail do nợ lint có sẵn ngoài phạm vi. Worker PID 33109 đã restart với code mới.
- Báo cáo/screenshot: `.codex/artifacts/m9.2-searchable-pdf-live-pilot/`.
- Live mở rộng 2026-08-14 hoàn tất Bài 15 Toán 12 và Bài 2 Toán 7: 9 Terra
  calls, 13.316 VND; cộng pilot searchable-PDF là 40 calls/51.641 VND trên ngân
  sách 110.000 VND. 7/7 figure compile thành công ở attempt đầu, repairCount=0;
  visual review 6 mức cao, 1 chấp nhận. Báo cáo/ảnh nằm tại
  `.codex/artifacts/m9.2-searchable-pdf-live-extended/`.
- Live mở rộng phát hiện và sửa ba lỗi validation: từ yếu `đường thẳng` ép hình
  sai trong analytical geometry; substring `số đối` khớp nhầm `sơ đồ`; text
  LaTeX thiếu cân bằng chưa có `MALFORMED_LATEX`. Hai lesson hiện có 0 review
  issue; full API 345 pass/6 skip, focused contract 70/70, typecheck/scoped lint
  xanh. Worker PID 36736 đã restart với code cuối; budget ALL/AI hard-stop ở
  availableVnd=0.

Các dòng live audit bên dưới là lịch sử các vòng TeX/TikZ trước searchable-PDF
pilot, chỉ dùng tham khảo; số liệu mới ở trên là trạng thái nghiệm thu hiện hành.

- Shared build: pass.
- API typecheck: pass.
- Web typecheck: pass.
- Focused TeX contract/processor/context: 55/55 pass; OpenAI live test được skip
  mặc định để không phát sinh chi phí.
- Focused TeX contract sau figure-coverage fix: 53/53 pass; API typecheck pass.
- Docker renderer build và smoke lớp 3/lớp 9/lớp 12/Lý-Hóa: pass.
- Snippet-only focused contract/lifecycle/worker: 85/85 pass; Prisma
  generate/validate và shared/API/web typecheck pass.
- Docker renderer smoke 8/8 pass sau khi envelope tự khai báo crop cho mọi
  drawing root trong manifest; regression chặn SVG Letter page chưa crop.
- Source editor Playwright light-theme desktop/tablet/mobile: 3/3 pass; đã
  chụp và xem trực quan. Renderer contact sheet 8 fixture cũng đã được
  xem bằng Chromium ở desktop/mobile.
- API/Web production build, scoped lint, migration deploy/status và prompt-preview
  Playwright desktop: pass.
- Full API: 291 pass, 6 skip, còn 2 failure M5 có sẵn (OpenAI refusal fixture và
  thiếu HNSW index trong test DB), không thuộc thay đổi M9.2.
- Repo-wide lint vẫn fail vì nợ lint ngoài phạm vi; scoped lint của các file task
  pass.
- Live provider matrix đã hoàn tất trên đúng Bài 13 Toán 12 Tập 2 với figure
  light-only: Luna 20/20 raw first-compile pass, Terra 10/10 pass, GPT-5.4 9/10
  ở full run rồi hình thay thế bằng prompt v6 pass 1/1; cả ba bản cuối không còn
  figure failed. Audit và ảnh desktop/tablet/mobile nằm tại
  `.codex/artifacts/m9-2-stem-figure-lifecycle/live-b13/visual-audit.md`.
- Tổng paid usage gắn với Bài 13 trong phiên triển khai là 83.663 VND/92 request,
  dưới trần 150.000 VND; không gọi thêm provider trong verification cuối.
- Root cause GPT-5.4 compile fail là macro PGF local trong một `scope` bị dùng ở
  sibling `scope`; prompt chuyên vẽ v6 thêm lexical-scope audit tổng quát. Summary
  output budget hiện scale theo target word count; deterministic provider output
  failure không lặp lại cùng paid request.
- Live Terra riêng cho Bài 14 Toán 12 Tập 2 đã hoàn tất: lượt toàn bài raw đầu
  tiên đạt 20/22, hai lỗi đều do dùng `tdplot_main_coords` trước
  `\tdplotsetmaincoords` dù compiler đã có `tikz-3dplot`. Prompt chuyên vẽ v7
  thêm bất biến khai-báo-trước-khi-dùng; hai regression source được sinh lại và
  đều compile ngay lần đầu, không AI repair. Prompt v8 tiếp tục thêm kiểm tra bố
  cục sau phép chiếu 2D và khoảng trắng cho nhãn, theo hướng tổng quát chứ không
  vá riêng bài.
- Trạng thái cuối Bài 14 là 22/22 `SUCCEEDED`, nhưng full-run ban đầu chưa chứng
  minh mục tiêu zero first-compile failure. Đối chiếu sau đó với 14 crop hình
  sách đính chính visual audit cũ: 5/22 hình đạt, 5/22 cần giản lược, 12/22 cần
  bỏ hoặc vẽ lại vì nhét phép tính/kết luận/đáp số. Root cause là coverage
  `ALL_REQUIRED` quá rộng cho hình học giải tích và prompt coi solution/answer
  như draw list. Prompt Summary v7 + figure v9 và coverage contextual đã sửa
  tổng quát; chưa gọi provider lại. Artifact nằm tại
  `.codex/artifacts/m9-2-stem-figure-lifecycle/live-b14/terra/visual-audit.md`.
- Bài 14 dùng 25 provider request, chi phí 29.171 VND. Tổng Bài 13 + Bài 14 là
  112.834 VND, dưới trần 150.000 VND. Summary đã trả về `NEEDS_REVIEW` và
  enrollment test tạm đã xóa.
- Quyền dữ liệu M9.2 được khóa lại theo feedback owner: worker tạo STEM figure
  chỉ được gửi brief văn bản; không được tải hoặc truyền crop OCR, ảnh sách hay
  ảnh tham chiếu lên Terra/OpenAI nếu chưa có chấp thuận riêng, rõ ràng. Ảnh sách
  chỉ được giữ cục bộ để Codex QA sau sinh. Cơ chế tự chọn tối đa 2 crop từng có
  trong lượt v9 là suy diễn sai phạm vi; 11 request figure v9 phải được xem là
  có khả năng đã mang attachment vì usage log không lưu manifest ảnh. Service đó
  đã bị gỡ; contract test khóa `inputImages === undefined` cho create-new.
- Terra Bài 14 text-only v10 sinh 15/15 source compile thành công ở raw lần đầu,
  không AI repair; tuy nhiên visual audit chưa đạt gate 90% hình tương đương chất
  lượng sách vì có mặt phẳng bị co hẹp, thân vectơ khó thấy, nhãn che nét và lặp
  phương trình/toạ độ không cần thiết. Prompt Summary v9 + figure v11 bổ sung
  visual legibility gate tổng quát ở kích thước mobile, không phải vá từng bài.
- Forensic review video đối chiếu nằm tại
  `.codex/artifacts/m9-2-stem-figure-lifecycle/external-tool-video-review/forensic-review.md`.
  Snippet/screenshot rời không được coi là raw first-output nếu thiếu provenance.

Trạng thái bàn giao: implementation, live validation và visual/responsive review
đã hoàn tất. Summary live đã trả về `NEEDS_REVIEW`; enrollment test tạm đã xóa.
Worker đang chạy code mới trong phiên này; khi owner khởi động lại dev stack về
sau vẫn phải restart worker để load processor/module mới.

## 3. File chính của hướng mới

- `docs/15classhero_he_thong_ve_hinh_texlive_latex_tikz.md`
- `apps/api/src/modules/stem-figures/`
- `apps/api/src/workers/processors/stem-figure-rendering.processor.ts`
- `apps/api/src/workers/services/stem-figure-rendering-worker.service.ts`
- `apps/api/tex-renderer/server.mjs`
- `apps/api/Dockerfile.tex-renderer`
- `apps/web/features/admin/ai-generation/components/admin-stem-figures-panel.tsx`
- `apps/web/components/common/content/stem-figure.tsx`
- `packages/shared/src/schemas/stem-figure.ts`

`.codex/artifacts/` là artifact local/untracked của owner; không xóa hoặc commit.

Owner chốt ngày 2026-08-13: trong modal Tạo Kiến thức, toàn bộ nội dung đang hiển
thị ở hai ô Quy tắc hệ thống/Câu lệnh người dùng là hai prompt cuối gửi OpenAI.
Backend/worker không được cắt, khôi phục hoặc nối ngầm subject profile, yêu cầu
hình hay prompt khác. Prompt mặc định phải được dựng đầy đủ và hiển thị trước;
tab Dữ liệu gửi đi phản ánh request cuối gồm prompt, context, schema và cấu hình
model. Validation/schema/sandbox vẫn là lớp kỹ thuật riêng.

Owner chốt rule tổng quát hóa ngày 2026-08-14: mọi prompt, heuristic, validator,
semantic gate, policy và kỹ thuật khắc phục AI phải xuất phát từ invariant dùng
lại được giữa nhiều bài/lớp; không hard-code Bài 13, F16, mã lesson/figure, số
liệu hoặc hình cụ thể để vá case. Live case chỉ là regression fixture; bản sửa
production phải có counterexample hợp lệ chống overfit. Ngoại lệ theo source chỉ
được phép khi là product contract do owner chốt và đã được ghi rõ trong docs.

Owner chốt nguyên tắc sửa lỗi ngày 2026-08-14: phải xác định và sửa đúng owner
tối thiểu của nguyên nhân gốc trước, không tự mở rộng thành thêm gate, pipeline
hoặc kiến trúc khi chưa có bằng chứng cần thiết. Với lỗi AI rút gọn nội dung và
lời giải của M9.2, hai owner hiện tại là prompt mặc định và JSON response schema
gửi OpenAI; chỉ cân nhắc lớp backend mới nếu kiểm chứng sau sửa vẫn thất bại.
Khi chỉnh prompt, ưu tiên thay đúng câu đang mơ hồ hoặc xung đột; không thêm block
dài, quy trình phụ hoặc ví dụ nếu một ràng buộc ngắn đã diễn đạt đủ invariant.

Owner bổ sung rule hình ngày 2026-08-14 sau visual audit Bài 15: lỗi thiếu nét
hoặc sai nét liền/nét khuất thuộc prompt/schema của hai giai đoạn, không phải FE
hay compiler. Stage 1 phải kiểm kê từng cạnh/đoạn với hai đầu mút, vai trò và
trạng thái hiển thị; Stage 2 dựng đủ khung cơ sở trước đường phụ và xuất path
tường minh đúng nét liền/đứt. Rule phải tổng quát, không nhắc case hoặc ID live.

Visual audit Bài 15 cùng ngày phát hiện thêm hai invariant nguồn:
`theorem`/`property` cần semantic cue thực sự từ nhãn hoặc câu dẫn bên ngoài
phát biểu; một bảng điều kiện/tiêu chuẩn/phương pháp xét không có cue phải là
`knowledge`, không được suy loại từ nội dung công thức. Khi SGK trình bày bằng
`\Leftrightarrow`, hệ ngoặc nhọn, bullet và câu dẫn có dấu `:`, Summary phải giữ
cấu trúc tương đương, không văn xuôi hóa hoặc xuống dòng tùy tiện.

Paid rerun prompt v4/schema v3 ngày 2026-08-14 sinh 16 block nhưng trả rỗng toàn
bộ `figures[]`; schema cũ bắt buộc field nhưng cho phép mảng rỗng nên output vẫn
hợp lệ. Prompt/schema hiện yêu cầu inventory toàn bộ hình/crop nguồn trước khi
soạn và đối chiếu lại sau khi soạn; không được trả mọi figure plan rỗng khi có
hình trực tiếp hỗ trợ. Lượt v4/v3 này là live failure, không dùng nghiệm thu.

Visual audit v7/v6 phát hiện sơ đồ chuyển động có nhãn vectơ chồng nhãn điểm cuối
và vai trò mũi tên khó đọc. Rule tổng quát mới tách quỹ đạo không đầu tên khỏi
vectơ hướng, đồng thời dành vùng riêng cho nhãn điểm đầu/điểm cuối/nhãn vectơ.

Kế hoạch corrective đang triển khai tại
`.codex/plans/m9-2-five-block-taxonomy-source-fidelity-plan.md`. Prompt/schema đã
chuyển sang `items = UNIT | NOTE`, provider không sinh `procedure`, backend tự cấp
figure ID, bỏ heuristic `ALL_REQUIRED` khỏi production path và Stage 2 được siết
theo brief + ảnh nguồn + semantic fill. Retry compiler/lifecycle không đổi. Chưa
gọi paid provider trong vòng sửa đổi này; phải snapshot kết quả cũ rồi live test
Bài 15 và lưu screenshot/audit trước khi nghiệm thu.

Ngày 2026-08-14, figure inline có thêm `Xem hình trong sách giáo khoa`: modal
đọc immutable reference snapshot, hiển thị crop nguồn và cho `Dùng hình này`.
Backend chỉ nhận OCR crop còn thuộc đúng snapshot hash/head, sao chép + chuẩn hóa
thành file `AI_DIAGRAM` và revision `ADMIN_UPLOAD`; PDF-page fallback không được
dùng trực tiếp, không gọi AI/retry. Live Bài 15 Hình 5.32 đã tạo revision v4 từ
crop SGK thành công. Prompt Stage 2 v20 đồng thời sửa invariant cung góc kề nhau:
mỗi góc đúng một cung trong sector riêng, không có đoạn cong chồng lấn; live v20
compile first-pass, `repairCount=0` và hai arc path có khoảng rời nhau.

Caption figure cũng được tách contract: `sourceReferences.figureLabel` giữ mã
SGK để resolver tìm crop, còn caption UI phải là mô tả sư phạm có nghĩa hoặc
`null`. Prompt v9 + schema v8 reject caption chỉ là `Hình/Figure + số`; không sửa
bằng heuristic hậu kỳ hoặc hard-code theo Bài 15.

Corrective runtime cùng ngày tách `stemFigureRenderPlanSchema` khỏi schema output
caption: thao tác `Tạo mới bằng AI` chỉ parse các trường ngữ nghĩa cần dựng hình,
còn alt/caption kế thừa từ revision head. Nhờ vậy việc siết caption output không
chặn resolve crop/tái sinh một figure có render-plan hợp lệ.

Ngày 2026-08-14, luồng tạo lại figure được đổi thành preview-first: nút `Tạo mới
bằng AI` mở modal Stage 2 mặc định crop SGK; ba mode crop/current/both dựng lại
đúng ảnh và provider fields, có `adminInstructions`, rồi chỉ nút xác nhận trong
modal mới enqueue. Nút trace cũ đổi thành `Edit` và prefill lần tạo gần nhất;
editor TikZ đổi nhãn `Chỉnh sửa mã code`; manual `Retry bằng AI` bị bỏ khỏi UI.
Request snapshot được ghi trước budget reservation để cả lần bị budget gate chặn
vẫn truy vết được. API preview không gọi provider và không phát sinh chi phí.

Ngày 2026-08-16, owner chốt lại acceptance gate của pipeline hình: raw output
Stage 2 phải đồng thời biên dịch thành công ngay attempt đầu và đạt visual gate.
Khi có hình SGK, crop nguồn thực gửi provider là chuẩn đối chiếu bố cục, hướng,
topology, nhãn và marker; khi không có hình nguồn, output phải đạt ngôn ngữ minh
họa SGK từ brief và style toàn bài. Không tính source sửa tay là first-pass pass.

Lượt xác nhận cuối chạy mới trọn Bài 15 bằng `gpt-5.6-terra`, gồm Stage 1 và 6
call Stage 2, generation `8708b40e-1b24-495e-aa8e-64b282bf0fc4`: 6/6 figure
compile attempt 1, `repairCount=0`, và 6/6 visual gate đạt khi đối chiếu đúng crop
SGK thực gửi. Hình 5.32 giữ đúng 60° hai cung, 30° một cung. Chi phí lượt này
11.937 VND; bằng chứng nằm tại
`.codex/artifacts/m9-2-terra-live-b15/full-v29-2026-08-16/`.

Owner đính chính visual gate cùng ngày: ba output Bài 15 vẫn có nhãn đè/chạm nét,
nhãn bị đẩy quá xa và có nét hình học thừa; vì vậy kết luận visual pass của các
đợt v29--v32 không hợp lệ dù source đều compile. Nguyên nhân được xác nhận là
prompt v30--v33 tích lũy quá nhiều quy tắc vá riêng về nhãn, sector, khoảng cách,
canvas và marker, làm model ưu tiên câu chữ kỹ thuật hơn ảnh sách giáo khoa.
Stage 2 chuyển sang prompt v37 ngắn và linh động: ảnh SGK là chuẩn trực quan cao nhất, brief
chỉ kiểm chứng ý nghĩa, cấm thiếu/thừa nét, nhãn phải gần đúng đối tượng và không
chạm nét, rồi kiểm first-pass compile. Với đoạn được gọi tên bằng hai đầu mút,
source phải nối trực tiếp hai đầu mút thay vì coi đường gấp khúc là tương đương.
Provider brief đã bỏ toàn bộ `visualConstraints` suy diễn cũ về góc, hướng
tia, path và tọa độ; sau hard cutover chỉ còn projection thật của block,
reference mode/metadata và yêu cầu admin. Không gửi lesson title, section heading
hoặc `reference.images=[]`; khi không ảnh chỉ gửi `reference.mode=NONE`. Không thêm công thức
vị trí riêng của một fixture vào prompt chung. Mẹo chỉ được giữ khi ngắn,
giải quyết một lớp lỗi phổ biến trên nhiều hình; nhãn chạm/che nét là
một lớp lỗi như vậy. Các output lỗi chỉ được giữ làm regression evidence.

Owner chốt ngưỡng nghiệm thu hình có nguồn ngày 2026-08-16: output mới
phải giống ít nhất 95/100 so với ảnh SGK. Trước khi chấm điểm, thiếu/thừa
nét mang nghĩa, nối sai đỉnh, sai nhãn, sai nét liền/khuất, marker hoặc
trạng thái tô là hard fail. Biên dịch thành công không thay thế visual gate.

Live read-only F002 v36 sau khi bỏ prompt vá cục bộ đã first-compile pass và
khôi phục đủ nét trực tiếp `AD'`, nhưng vẫn fail gate 95%: tỷ lệ khung
artwork nguồn xấp xỉ 1,44, output xấp xỉ 1,99, tức bị kéo ngang gần 38%.
Không apply output này. Prompt v37 thêm một invariant tổng quát cho mọi hình
có nguồn: không kéo giãn/nén, giữ gần tỷ lệ khung bao và vị trí tương
đối của các điểm chính. Chi phí live v36 là 697 VND.

Root cause dữ liệu đầu vào tiếp theo được xác nhận: resolver đã tự render
lại crop Mathpix từ trang PDF với padding bằng 75% chiều rộng/cao bbox, khiến
Hình 5.24 chuẩn bị thay bằng ảnh chứa cả lời giải, caption và số trang. Owner
chốt Mathpix đã crop tốt và hệ thống không được crop lại. Resolver nay gửi
nguyên `objectKey` OCR crop đã khớp nhãn; chỉ render nguyên trang PDF khi không
có crop Mathpix đáng tin cậy theo fallback product contract.

Live F002 sau sửa resolver đã xác nhận request dùng đúng crop Mathpix gốc,
first-compile pass và topology đủ, nhưng vẫn fail gate 95% do tỷ lệ hình bị
kéo ngang và nhãn chưa sát nguồn. Output không được apply. Kết quả này
chứng minh sửa input là cần thiết nhưng prompt + Terra sinh TikZ hiện tại
chưa đủ để bảo đảm 95% một cách ổn định. Không nối thêm mẹo prompt;
cần một quyết định pipeline nếu muốn enforce 95% tự động. Chi phí hai call
v37 là 537 + 650 VND; cộng v36 trong vòng này là 1.884 VND.

Ngày 2026-08-17, owner chốt lại precedence của modal `Tạo mới bằng AI`: ảnh tham
chiếu và `Yêu cầu cho hình mới` (`adminInstructions`) là hai nguồn thẩm quyền duy
nhất, ngang hàng theo phạm vi. Ảnh là ground truth của baseline; field admin là
ground truth của đúng delta sửa đổi/bổ sung. Mọi phần ảnh ngoài delta phải được
giữ nguyên; block sở hữu chỉ dùng kiểm chứng phần ảnh không quyết định. Yêu cầu
mơ hồ không cho phép thiết kế lại toàn hình. Khi field rỗng/blank, provider JSON,
system prompt và user prompt mặc định không được chứa key hoặc câu nhắc tới yêu
cầu bổ sung; compiler repair cũng không tự thêm câu này. Chỉ safety, output/TeX
contract, khả năng compile và tính đúng nội tại đứng cao hơn. Corrective M9.2 đã
cập nhật preview/create/repair và regression ba mode.

Ngày 2026-08-19, owner chốt Stage 2 chỉ nhận projection của đúng block
sở hữu figure. Backend không còn suy block đứng trước thành `pairedTheory`,
không lưu field này trong generation brief và không gửi nó sang provider.

## 4. Khi nào cập nhật file này

Cập nhật khi pipeline đổi, task hoàn tất, có blocker hoặc task ưu tiên tiếp theo
thay đổi. Không ghi secret/token/dữ liệu người dùng thật.
