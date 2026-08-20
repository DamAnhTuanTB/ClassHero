# M9.2 — Exact `figureLabel` reconciliation trên toàn PDF packet

Trạng thái: `IMPLEMENTED` ngày 2026-08-20

Mode: `Worker/Integration + API`

Quyết định owner ngày 2026-08-20: khi Stage 1 trả đúng
`sourceReferences.figureLabel` nhưng sai trang, backend phải tìm exact nhãn
hình trên toàn bộ các trang thuộc packet. Backend chỉ tự sửa trang khi
có một vị trí canonical duy nhất; không fuzzy-match, không chọn bừa
khi nhiều trang trùng nhãn.

## 1. Bằng chứng và root cause

Ca live `Hình 4.16` đã được kiểm tra bằng dữ liệu persist và
OCR artifact hiện có:

- OpenAI `gpt-5.6-luna` trả:
  `figureLabel="Hình 4.16"`, `packetPageNumber=3`,
  `printedPageLabel="21"`.
- Packet manifest canonical:
  - packet 2 -> PDF page 21 -> trang in 20;
  - packet 3 -> PDF page 22 -> trang in 21.
- OCR image manifest có crop usable:
  `captionCandidate="Hinh 4.16"`, `pageNumber=21`,
  `isUsableForAi=true`.
- Resolver hiện tại chỉ lọc image bằng
  `image.pageNumber === sourcePdfPageNumber` của trang do model chọn. Vì
  không tìm thấy Hình 4.16 trên PDF page 22, backend ghi
  `figure_label_not_matched_using_page_fallback` và render nguyên
  `page-22.png`.
- Mapper hiện chỉ kiểm `packetPageNumber` nằm trong range, sau đó giữ
  nguyên cả ba field do provider trả. Backend chưa reconcile
  `figureLabel` với OCR inventory và packet manifest.

Root cause hệ thống gồm hai lớp:

1. Provider chọn sai trang dù đọc đúng nhãn hình.
2. Backend tin trang do provider chọn và thiếu exact-label recovery trên
   toàn packet, nên fallback sang nguyên trang sai.

## 2. Mục tiêu

- Dùng `figureLabel` formal là bằng chứng định danh mạnh hơn trang
  model dự đoán.
- Tìm exact normalized identity trên mọi trang thật sự nằm trong packet,
  không tìm trên cả cuốn sách ngoài phạm vi lesson packet.
- Nếu exact identity chỉ xuất hiện trên một packet page, backend tự
  canonicalize `packetPageNumber` và `printedPageLabel` theo manifest, sau đó
  dùng crop exact hoặc fallback đúng trang canonical.
- Persist plan canonical để API/UI, retry, M9.17 và Stage 2 cùng thấy một
  trang đúng; raw provider output vẫn giữ nguyên cho audit.
- Tải mỗi OCR image manifest tối đa một lần trong một lượt resolve
  Summary; không nhân chi phí I/O theo số figure.
- Không phá behavior multi-crop, `WHOLE_FIGURE`, `SUBFIGURE`, M9.17 dùng
  crop gốc SGK và full-page fallback hiện tại.

## 3. Ngoài phạm vi

- Không hard-code `Hình 4.16`, lesson ID, trang 20/21 hoặc tên sách.
- Không fuzzy-match nhãn, semantic-rank hình lân cận hoặc dùng nội dung
  block để đoán trang.
- Không gọi thêm OpenAI, Gemini hoặc Mathpix.
- Không OCR lại PDF, không đổi pipeline tạo image manifest.
- Không tự động rewrite hàng loạt `stem_figures.plan_json` cũ.
- Không đổi Prisma schema, REST response shape hoặc UI.
- Không coi `printedPageLabel` do model trả là canonical khi packet manifest
  đã có mapping xác định.

## 4. Invariant và thứ tự authority

Thứ tự authority cho mỗi source reference:

1. Exact normalized `figureLabel` trong OCR image inventory của packet.
2. Packet manifest bất biến để map
   `packetPageNumber <-> lessonDocumentId + sourcePdfPageNumber -> printedPageLabel`.
3. Trang và nhãn trang do provider trả chỉ là requested location, không
   phải canonical location.

Quy tắc exact identity:

- Tái sử dụng normalization Unicode/dấu và parser formal identity hiện có,
  ví dụ `Hình 4.16`, `Hinh 4.16`, `Fig. 4.16` cùng identity `4.16`.
- `Hình 4.16` không exact-match `Hình 4.15`, `Hình 4.160` hoặc
  `Hình 4.16a`.
- Nhiều crop cùng exact identity trên cùng một canonical page là các
  panel bổ sung hợp lệ, không phải nhiều vị trí mơ hồ.
- Cùng identity xuất hiện trên nhiều canonical packet page khác nhau
  là ambiguous; backend không tự chọn.
- Mọi index key phải gồm `lessonDocumentId + sourcePdfPageNumber`, không
  chỉ dùng `pageNumber`, vì nhiều document có thể cùng số trang PDF.

## 5. Luồng backend đích

```text
provider output sourceReference
  -> parse formal figure identity
  -> claimed packet page exact lookup
     -> có exact: giữ trang, canonicalize printedPageLabel từ manifest
     -> không exact: global exact lookup trên các page thuộc packet
        -> đúng 1 canonical page:
             relocate packet page + printed label
             -> có usable crop: dùng crop exact
             -> crop unusable: fallback nguyên trang canonical
        -> nhiều canonical page:
             không relocate, đánh ambiguous/cần review
        -> không có exact:
             giữ page-fallback hiện tại trên requested page
  -> persist canonical plan + immutable reference snapshot
  -> M9.17 auto-promote crop hoặc Stage 2 nhận reference đúng
```

Chi tiết các nhánh:

1. **Exact ngay requested page**
   - Giữ `packetPageNumber`.
   - Ghi đè `printedPageLabel` bằng giá trị manifest nếu manifest có.
   - Giữ toàn bộ complementary exact crops theo giới hạn hiện tại.

2. **Exact duy nhất ở trang khác trong packet**
   - Thay `packetPageNumber` và `printedPageLabel` trong effective plan.
   - `sourceTarget` và `figureLabel` giữ nguyên.
   - Snapshot asset dùng canonical packet page.
   - Ghi warning audit `figure_label_exact_match_relocated` và lưu requested
     page/label dưới metadata optional của reference snapshot.

3. **Exact evidence có nhưng crop không usable**
   - Vẫn được dùng để canonicalize trang.
   - Không auto-promote crop; render full PDF page của canonical location.

4. **Trùng exact identity trên nhiều packet page**
   - Không rewrite plan.
   - Snapshot `status="ambiguous"`, warning
     `figure_label_exact_match_multiple_pages`.
   - Không auto-promote M9.17; admin phải review. Requested-page fallback có
     thể giữ là evidence preview nhưng không được coi là exact crop.

5. **Không có formal label hoặc không có exact evidence trong packet**
   - Giữ behavior hiện tại; không semantic guess.

6. **Manifest thiếu `printedPageLabel`**
   - Giữ provider label nếu có như informational value, kèm warning;
     không tự suy số trang bằng offset.

## 6. Thiết kế code và file

### W1 — Tách exact identity helper dùng chung

File dự kiến:

- Tạo
  `apps/api/src/modules/stem-figures/utils/figure-label-identity.ts`.
- Sửa
  `apps/api/src/modules/stem-figures/services/figure-reference-resolver.service.ts`.

Thay đổi:

- Di chuyển normalization/extraction formal identity hiện có sang pure utility.
- Export helper so sánh exact identity để selector của requested page và
  packet-wide index dùng cùng một rule.
- Không thêm regex theo môn, bài, chapter hoặc fixture.

### W2 — Xây packet-wide exact-label index theo batch

File chính:

- `apps/api/src/modules/stem-figures/services/figure-reference-resolver.service.ts`
- Có thể tách pure grouping/reconciliation sang
  `apps/api/src/modules/stem-figures/utils/figure-reference-reconciliation.ts`
  nếu service vượt trách nhiệm I/O.

Thay đổi:

1. Thêm batch API `resolveMany({ manifest, plans })`; `resolve()` cũ trở thành
   wrapper cho single-plan flow.
2. Lấy unique `lessonDocumentId` từ toàn bộ `manifest.pages`, không chỉ
   từ requested pages do provider chọn.
3. Tải mỗi `imageManifestObjectKey` một lần, parse một lần.
4. Chỉ index image nằm trên cặp document/PDF page có trong packet.
5. Index exact identity -> canonical packet page -> các OCR image candidate.
6. Phân biệt image có label evidence với crop có
   `isUsableForAi=true`; evidence unusable vẫn định vị trang nhưng không
   được auto-promote.
7. Cache PDF bytes/render page như hiện tại và chỉ render fallback sau
   khi canonical location đã được quyết định.

### W3 — Trả effective plan cùng reference snapshot

File chính:

- `apps/api/src/modules/stem-figures/services/figure-reference-resolver.service.ts`
- `apps/api/src/workers/services/lesson-summary-generation.service.ts`
- Các reader/type `FigureReferenceSnapshot` tương ứng trong
  `apps/api/src/modules/stem-figures/`.

Contract nội bộ đích:

```ts
type ReconciledFigureReference = {
  plan: StemFigureRenderPlan;
  snapshot: FigureReferenceSnapshot;
};
```

- `plan` là bản canonical để persist và build generation brief.
- `snapshot.references[].planReference` phản ánh effective reference.
- Khi relocate, snapshot giữ optional requested page/label để debug.
- Raw `providerOutput` trong `ai_generations.output_json` không bị sửa, nên
  audit vẫn phân biệt được model output và backend canonicalization.
- Reader snapshot cũ phải tiếp tục đọc được; optional metadata không
  bắt buộc backfill hay Prisma migration.

### W4 — Persist và các consumer dùng canonical result

File chính:

- `apps/api/src/workers/services/lesson-summary-generation.service.ts`
- `apps/api/src/modules/stem-figures/services/stem-figures.service.ts` nếu
  single-figure refresh cần nhận effective plan.
- `apps/api/src/modules/stem-figures/utils/stem-figure-generation-brief.ts`
  chỉ kiểm parity; không thêm logic tìm trang ở layer này.

Thay đổi:

1. Thay `Promise.all(resolve mỗi figure)` bằng một `resolveMany` cho toàn bộ
   figure draft của Summary.
2. `stem_figures.plan_json` lưu effective/canonical plan.
3. `stem_figure_revisions.reference_snapshot_json`, generation brief, M9.17
   source crop và Stage 2 queue đều dùng cùng canonical result.
4. `sourceReferences.figureLabel` và `sourceTarget` không bị thay đổi.
5. API serializer không thêm response field mới; UI tự hiển thị packet
   page/printed label đã canonical hóa từ `planJson`.

### W5 — Docs khi implementation được owner cho phép

Cập nhật sau khi code/test pass:

- `docs/implementation/M9.md`: thêm invariant exact-label packet-wide recovery.
- `docs/06-ai-rag-spec.md`: ghi authority giữa provider reference, OCR exact
  label và packet manifest.
- `.codex/plans/codex-execution-plan.md`: đánh corrective M9.2 hoàn tất.

Không cần đổi `docs/04-database-model.md`, `docs/05-api-contract.md`,
env hay migration nếu implementation giữ đúng phạm vi trên.

## 7. Regression tests bắt buộc

File test chính:

- `apps/api/test/m9.2-stem-figure-contract.test.ts`
- `apps/api/test/m9.17-textbook-source-images.test.ts`
- Tách test pure utility riêng nếu file M9.2 tiếp tục quá lớn.

Ca phải khóa:

1. **Regression tổng quát từ ca Hình 4.16**
   - Provider chọn packet page 3/printed 21.
   - Exact label chỉ có ở packet page 2/printed 20.
   - Kết quả dùng OCR crop packet 2; không render PDF page của packet 3.
   - Fixture dùng nhãn/trang giả lập trung tính hoặc ghi ca live chỉ là
     regression evidence; production code không chứa giá trị riêng của ca.

2. **Canonical printed label**
   - Packet page đúng nhưng model trả sai `printedPageLabel`.
   - Backend ghi nhãn từ manifest.

3. **Requested page đã exact**
   - Giữ trang requested và complementary crops; không search result khác
     làm đổi trang đã được corroborate.

4. **Nhiều exact crops cùng trang**
   - Giữ tối đa bốn crop theo order/dedup hiện tại.

5. **Cùng identity ở nhiều trang hoặc nhiều document**
   - Trả ambiguous, không arbitrary relocation, không M9.17 auto-promote.

6. **Counterexample hình lân cận**
   - Yêu cầu `Hình 5.26`, packet chỉ có `Hình 5.25`; không match.
   - Behavior page fallback hiện tại được giữ.

7. **Parent/subfigure identity**
   - `Hình 4.16` không tự match `Hình 4.16a`.
   - Khi exact parent figure nằm ở trang khác, `SUBFIGURE.locator` được
     giữ nguyên sau relocate.

8. **Crop không usable nhưng label exact**
   - Canonicalize đúng trang, sau đó fallback nguyên canonical PDF page;
     không quay lại requested page sai.

9. **Packet nhiều document có cùng PDF page number**
   - Mapping dùng document identity, không trộn hai file.

10. **Persistence/audit parity**
    - `stem_figures.plan_json` và reference snapshot là canonical.
    - `ai_generations.output_json.providerOutput` vẫn là raw provider value.
    - Generation brief/M9.17 asset dùng canonical packet page.

11. **Không ảnh hưởng AI-authored figure**
    - `GENERATED_FROM_BRIEF` và `sourceReferences=[]` giữ nguyên.

## 8. Verification khi thực thi

Không gọi paid provider trong bộ check mặc định.

```bash
pnpm --filter @learning-path/api exec vitest run \
  test/m9.2-stem-figure-contract.test.ts \
  test/m9.17-textbook-source-images.test.ts

pnpm --filter @learning-path/api typecheck
git diff --check
```

Thêm một inspect-only check dùng packet manifest và OCR artifact cache hiện
có, không gọi OpenAI/Mathpix, để xác nhận ca live cho kết quả:

- effective `packetPageNumber=2`;
- effective `printedPageLabel="20"`;
- asset `source="OCR_CROP"`; snapshot reference có `sourcePdfPageNumber=21`;
- không có `page-22.png` trong reference result mới.

Vì implementation sẽ sửa worker/service dùng trong background job, sau khi
check pass phải restart worker/dev process trước khi owner thử lại:

```bash
pnpm dev
```

## 9. Tiêu chí Done

- Exact formal label ở duy nhất một trang trong packet tự sửa được trang
  model chọn sai.
- Ca Hình 4.16 resolve về packet 2/trang in 20 và dùng OCR crop hiện có.
- `printedPageLabel` persist lấy từ canonical manifest khi mapping có sẵn.
- Nhiều trang exact hoặc không exact không bị backend chọn bừa.
- Raw provider output vẫn nguyên vẹn cho audit.
- M9.17 chỉ auto-promote exact usable crop; ambiguous/page fallback vẫn
  `NEEDS_REVIEW`.
- Resolver batch không tải lặp OCR image manifest theo từng figure.
- Focused tests, API typecheck và diff check pass.
- Docs M9.2/AI-RAG được cập nhật trong lượt implementation.

## 10. Thứ tự thực thi sau khi owner duyệt

1. W1: tách exact identity utility và khóa unit tests.
2. W2: build batch packet index + pure reconciliation branches.
3. W3: trả effective plan/snapshot và giữ backward reader.
4. W4: nối canonical result vào persist, M9.17 và Stage 2.
5. Chạy focused tests + typecheck + inspect-only live artifact.
6. Cập nhật docs, restart worker và bàn giao owner test lại.

Không thực thi các bước trên chỉ vì plan/artifact được IDE
auto-approve; phải chờ owner xác nhận rõ bằng lời.
