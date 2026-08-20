# M9.2 — Tách semantic visual intent khỏi định danh nguồn hình ở Stage 1

Trạng thái: `IMPLEMENTED` ngày 2026-08-17

Mode: `Worker/Integration + API + regression UI`

Quyết định owner ngày 2026-08-17: sửa contract Stage 1 để mã hình/trang và vị
trí hình con không còn nằm trong `visualIntent`. Không dùng regex để xóa nhãn
trên dữ liệu cũ và không tạo thêm field trùng nghĩa với
`sourceReferences.figureLabel`.

## 1. Vấn đề hiện tại

Stage 1 hiện trả đồng thời:

```json
{
  "visualIntent": "Dùng Hình 5.26 để minh họa vectơ chỉ phương...",
  "sourceReferences": [
    {
      "packetPageNumber": 2,
      "printedPageLabel": "19",
      "figureLabel": "Hình 5.26"
    }
  ]
}
```

Prompt/schema còn cho phép `visualIntent` định danh hình hoặc hình con. Stage 2
sao chép field này nguyên vẹn cho cả `SOURCE_CROP_ONLY`, `CURRENT_ONLY` và
`NONE`. Vì vậy khi admin chọn ảnh hiện tại, provider vẫn nhận mã của ảnh SGK cũ
nhưng không có contract nào ánh xạ chắc chắn mã đó sang current revision.

Hệ quả:

- `CURRENT_ONLY` có thể bị kéo ngược về hình nguồn hoặc thêm lại chi tiết cũ;
- resolver đang dùng `visualIntent` như một phần query định vị crop, làm semantic
  goal và source locator phụ thuộc nhau;
- không thể sửa an toàn bằng regex vì mã hình có nhiều định dạng và một chuỗi
  tương tự có thể là nội dung chuyên môn hợp lệ;
- request preview nhìn hợp lệ về JSON nhưng semantics giữa các mode không nhất
  quán.

## 2. Mục tiêu và ngoài phạm vi

### Mục tiêu

- `visualIntent` luôn độc lập nguồn, chỉ mô tả mục tiêu chuyên môn và nội dung
  thị giác cần truyền đạt.
- `sourceReferences` sở hữu toàn bộ provenance/locator: trang packet, trang in,
  mã hình và phạm vi hình con.
- Stage 2 dựng provider brief khác nhau đúng theo
  `SOURCE_CROP_ONLY | CURRENT_ONLY | NONE` mà không suy đoán hoặc sửa chuỗi.
- Dữ liệu plan cũ vẫn đọc/sinh lại được; không migration phá hủy hoặc rewrite
  hàng loạt JSON đã persist.
- Preview và create thật tiếp tục dùng cùng composer và snapshot đúng request.

### Ngoài phạm vi

- Không đổi renderer TeX/TikZ, toolbox, compile/validator hoặc retry policy.
- Không thêm AI call để “làm sạch” intent và không gọi provider trả phí trong
  verification mặc định.
- Không thay caption/alt text hiển thị cho học sinh.
- Không thay OCR/Mathpix crop extraction hay tự crop lại PDF.
- Không thêm heuristic theo tên bài, lesson ID, figure cụ thể hoặc regex xóa mã
  hình.

## 3. Contract Stage 1 đích

### 3.1. Shape provider output mới

```json
{
  "visualIntent": "Minh họa vectơ chỉ phương của đường thẳng trong không gian.",
  "sourceReferences": [
    {
      "packetPageNumber": 2,
      "printedPageLabel": "19",
      "figureLabel": "Hình 5.26",
      "sourceTarget": {
        "scope": "WHOLE_FIGURE",
        "locator": null
      }
    }
  ],
  "altText": "Đường thẳng đi qua A, M và vectơ chỉ phương song song với đường thẳng.",
  "caption": "Vectơ chỉ phương của đường thẳng."
}
```

Nếu chỉ lấy một hình con:

```json
{
  "visualIntent": "So sánh trạng thái trước và sau phép biến đổi hình học.",
  "sourceReferences": [
    {
      "packetPageNumber": 4,
      "printedPageLabel": "21",
      "figureLabel": "Hình 3.1",
      "sourceTarget": {
        "scope": "SUBFIGURE",
        "locator": "panel (b) ở bên phải"
      }
    }
  ]
}
```

`sourceTarget` là locator nguồn, không phải checklist hình học:

- `WHOLE_FIGURE`: dùng toàn bộ hình mang `figureLabel`; nếu Mathpix tách hình
  thành nhiều crop bổ sung, giữ tất cả crop exact-match theo thứ tự ổn định.
- `SUBFIGURE`: dùng hình con/panel được chỉ rõ bởi `locator`.
- `locator=null` bắt buộc với `WHOLE_FIGURE`.
- `locator` khác rỗng bắt buộc với `SUBFIGURE`, tối đa 300 ký tự và chỉ mô tả vị
  trí/nhãn của phần cần lấy, không chứa hướng dẫn vẽ.

Figure không có nguồn tiếp tục dùng `sourceReferences=[]`; khi đó
`visualIntent` phải tự đủ về đối tượng, quan hệ và nhãn cần thiết để dựng mới.

### 3.2. Invariant semantic

- `figureLabel`, `printedPageLabel`, số trang và `sourceTarget.locator` không
  được lặp lại trong `visualIntent`.
- `visualIntent` được phép dùng danh từ “hình”, “hình hộp”, “hình con” theo nghĩa
  chuyên môn; chỉ cấm lặp exact normalized locator đã có ở field nguồn.
- Validator dùng so sánh chéo các field đã cấu trúc sau normalize Unicode/dấu
  câu, không dò một danh sách regex kiểu `Hình <số>`.
- Counterexample bắt buộc: `figureLabel="Hình 5.26"` vẫn chấp nhận
  `visualIntent="Minh họa hình hộp ABCD.A'B'C'D' và các cạnh khuất"` vì “hình
  hộp” là nội dung chuyên môn, không phải mã nguồn.
- Vi phạm tạo issue `SOURCE_LOCATOR_LEAKED_IN_VISUAL_INTENT` và chặn persist/
  enqueue Stage 2; backend không âm thầm cắt chuỗi hoặc tự đoán intent thay model.

### 3.3. Versioning

- Backend stamp `figurePlanContractVersion: 2` sau khi parse output Stage 1 mới;
  model không phải tự trả version hằng số.
- Provider output schema mới bắt buộc `sourceTarget` cho từng source reference.
- Persisted render-plan reader chấp nhận:
  - v2: `figurePlanContractVersion=2`, semantics mới;
  - legacy: thiếu version và thiếu `sourceTarget`.
- Writer mới chỉ ghi v2. Không rewrite `plan_json` hoặc `content_json` cũ trong
  migration.

## 4. Contract Stage 2 theo từng mode

| Mode                      | Ảnh gửi kèm                     | `visualIntent`                                              | Locator nguồn gửi provider                                               |
| ------------------------- | ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `SOURCE_CROP_ONLY` v2     | OCR crop hoặc PDF page fallback | Gửi semantic intent v2                                      | `reference.images[].label` + `sourceTarget`                              |
| `CURRENT_ONLY` v2         | Delivery asset current revision | Gửi semantic intent v2                                      | Không gửi `figureLabel/sourceTarget` cũ; reference chỉ là current figure |
| `NONE` v2                 | Không có ảnh                    | Gửi semantic intent tự đủ                                   | `reference={mode:"NONE"}`                                                |
| `SOURCE_CROP_ONLY` legacy | Snapshot/crop legacy            | Giữ intent legacy để không làm mất khả năng định vị cũ      | Giữ metadata legacy hiện có                                              |
| `CURRENT_ONLY` legacy     | Delivery asset current revision | **Bỏ `visualIntent` legacy khỏi provider brief**            | Không suy locator                                                        |
| `NONE` legacy             | Không có ảnh                    | Giữ intent legacy vì figure không nguồn vốn cần brief tự đủ | Không locator                                                            |

Với `CURRENT_ONLY` legacy, provider vẫn nhận `blockContent`, ảnh hiện tại
và `adminInstructions`; không tạo một “neutral intent” giả từ
chuỗi cũ.

Provider-facing reference v2 cho ảnh SGK:

```json
{
  "reference": {
    "mode": "SOURCE_CROP_ONLY",
    "images": [
      {
        "label": "Hình 5.26",
        "source": "OCR_CROP",
        "sourceTarget": {
          "scope": "WHOLE_FIGURE",
          "locator": null
        }
      }
    ]
  },
  "visualIntent": "Minh họa vectơ chỉ phương của đường thẳng trong không gian."
}
```

Binary `input_image` vẫn được ghép theo đúng thứ tự `reference.images`; OpenAI
không có custom label bên trong object `input_image`.

## 5. Workstream triển khai

### W1 — Schema và prompt Stage 1

File chính:

- `apps/api/src/modules/ai/types/lesson-summary.types.ts`
- `apps/api/src/modules/ai/utils/lesson-summary-prompt.ts`
- structured output schema/helper liên quan trong `apps/api/src/modules/ai/schemas/`

Thay đổi:

1. Thêm `sourceTarget` strict object vào mỗi `sourceReferences[]` của provider
   output.
2. Sửa description của `visualIntent`: cấm provenance/locator, chỉ giữ semantic
   intent; khi không nguồn vẫn phải tự đủ.
3. Sửa figure coverage policy: model phải đặt figure/page/subfigure locator vào
   `sourceReferences`, không nhắc chúng trong `visualIntent`.
4. Thêm cross-field validator cho exact normalized locator leakage.
5. Không thêm `semanticChecklist`, visual constraints hoặc taxonomy hình mới.

### W2 — Mapper, persist và compatibility reader

File chính:

- `apps/api/src/modules/ai/utils/lesson-summary-mapper.ts`
- `apps/api/src/workers/services/lesson-summary-generation.service.ts`
- `apps/api/src/modules/stem-figures/utils/stem-figure-generation-brief.ts`
- `apps/api/src/modules/stem-figures/types/stem-figure-generation.types.ts`
- `apps/api/src/modules/ai/types/lesson-summary.types.ts`

Thay đổi:

1. Backend stamp `figurePlanContractVersion=2` khi cấp `localId`.
2. Persist `sourceTarget` trong `stem_figures.plan_json` và generation brief.
3. Reader tách schema v2/legacy; không nới provider output schema mới chỉ để đọc
   dữ liệu cũ.
4. `contentJson.figures[].visualIntent` tiếp tục là debug/display copy nhưng với
   Summary mới sẽ mang semantics source-neutral.
5. Admin-created figure plan cũng được stamp v2 và bắt đầu
   `sourceReferences=[]`.

Không cần Prisma migration vì các field nằm trong JSON; chỉ thêm migration nếu
implementation quyết định materialize version thành cột riêng, việc này không
được mặc định trong plan.

### W3 — Resolver và immutable reference snapshot

File chính:

- `apps/api/src/modules/stem-figures/services/figure-reference-resolver.service.ts`
- reference snapshot types/readers tương ứng

Thay đổi:

1. Resolver query dùng `figureLabel + sourceTarget.locator`, không dùng
   `visualIntent`.
2. `WHOLE_FIGURE` giữ toàn bộ exact-match complementary crop theo thứ tự hiện
   tại.
3. `SUBFIGURE` chỉ loại crop khi manifest có bằng chứng exact cho locator; nếu
   chưa đủ bằng chứng, giữ các exact-match crop và chuyển locator cho Stage 2,
   không đoán một crop gần nghĩa.
4. PDF-page fallback mang `sourceTarget` để Stage 2 định vị hình con nhưng không
   đưa packet/PDF provenance thừa vào provider prompt.
5. Snapshot revision giữ version/target bất biến để retry không đổi ảnh hoặc
   locator.

### W4 — Provider brief và mode isolation

File chính:

- `apps/api/src/modules/stem-figures/services/stem-figure-repair.service.ts`
- `apps/api/src/modules/stem-figures/services/stem-figures.service.ts`
- `apps/api/src/workers/processors/stem-figure-rendering.processor.ts`
- `apps/api/src/modules/stem-figures/types/stem-figure-provider-request.types.ts`

Thay đổi:

1. `toProviderGenerationBrief` nhận contract version và dựng đúng ma trận ở mục 4.
2. `SOURCE_CROP_ONLY` v2 gửi source target trong `reference.images`.
3. `CURRENT_ONLY` v2 gửi semantic intent nhưng không gửi locator SGK.
4. `CURRENT_ONLY` legacy bỏ intent thay vì sanitize.
5. Preview/create/worker dùng cùng một composer; snapshot ghi đúng request thực
   tế sau mode isolation.
6. Tăng prompt/schema version để cache/audit không trộn contract cũ và mới.

### W5 — UI preview và API serializer

File chính:

- `apps/web/features/admin/ai-generation/components/admin-stem-figure-create-ai-dialog.tsx`
- `apps/web/features/admin/ai-generation/types/admin-ai-generation.types.ts`
- `apps/web/features/admin/ai-generation/schemas/admin-ai-generation-schemas.ts`
- serializer/API preview tương ứng phía backend

Thay đổi:

1. JSON viewer tự hiển thị `sourceTarget` trong provider brief; không thêm form
   mới cho admin.
2. Với plan legacy + `CURRENT_ONLY`, preview phải cho thấy `visualIntent` đã bị
   lược bỏ, không chỉ ẩn ở UI.
3. UI không tự biến đổi intent, không tự suy version và không gửi object key/
   locator do client dựng.

## 6. Regression test bắt buộc

### Contract/schema local

1. Accept neutral intent + `figureLabel` + `WHOLE_FIGURE`.
2. Accept neutral intent chứa từ “hình” chuyên môn nhưng không lặp mã nguồn.
3. Reject intent lặp exact normalized `figureLabel`.
4. Reject intent lặp exact normalized `sourceTarget.locator`.
5. Reject `SUBFIGURE` có locator null/rỗng và `WHOLE_FIGURE` có locator khác
   null.
6. Figure `sourceReferences=[]` vẫn bắt buộc intent tự đủ.

### Resolver/snapshot

7. Resolver không còn phụ thuộc `visualIntent` để rank crop.
8. Whole figure nhiều crop exact-match giữ đủ panel và thứ tự.
9. Subfigure locator có/không có bằng chứng manifest đều đi đúng fallback đã
   định nghĩa.
10. Retry dùng đúng source target và asset snapshot cũ.

### Provider request matrix

11. Source v2 gửi neutral intent + source target + đúng ảnh.
12. Current v2 gửi neutral intent, current asset và không có mã hình SGK.
13. None v2 gửi self-contained intent, không có ảnh/images.
14. Current legacy bỏ visual intent, giữ block/current image/admin instructions.
15. Source/none legacy vẫn hoạt động.
16. Preview payload deep-equal request composer dùng khi enqueue/worker, ngoài
    byte ảnh bị ẩn.

### Counterexample và UI

17. `figureLabel="Hình 5.26"` + intent “Minh họa hình hộp...” phải pass.
18. JSON preview hiển thị source target ở source mode và không hiển thị locator
    SGK ở current mode.
19. E2E đổi mode reset preview như hiện tại và request mới phản ánh đúng contract.

### Paid gate tùy chọn

Sau khi toàn bộ local test pass và owner duyệt chi phí, chạy tối đa ba live case:

- một whole textbook figure;
- một subfigure/multi-panel source;
- một current revision với admin instruction.

Phải báo trước model, số call và chi phí ước tính; mặc định không chạy live.

## 7. Rollout và rollback

1. Deploy reader v2/legacy trước hoặc cùng writer v2 trong một release atomic.
2. Bump prompt/schema version; không reuse request draft/cache v1 làm v2.
3. Theo dõi tỷ lệ `SOURCE_LOCATOR_LEAKED_IN_VISUAL_INTENT`, Stage 1 parse fail,
   crop fallback, Stage 2 first-pass compile và `NEED_REVIEW` theo contract
   version/reference mode.
4. Rollback bằng cách ngừng writer v2 và quay provider prompt/schema về version
   cũ; reader v2 vẫn giữ để dữ liệu đã ghi trong cửa sổ rollout không bị mất.
5. Không rollback bằng cách rewrite plan v2 thành legacy hoặc xóa source target.

## 8. Docs cần cập nhật khi implementation được duyệt

- `docs/06-ai-rag-spec.md`: thay quyết định “visualIntent định danh hình/hình
  con” và “không tách field” bằng contract source-neutral + source target.
- `docs/api/learning-paths-lessons.md`: provider preview/generate brief theo mode
  và compatibility legacy.
- `docs/database/ai-rag-chat.md`: semantics/version của `plan_json` và reference
  snapshot JSON.
- `docs/implementation/M9.md`: corrective scope trong `M9.2`.
- `docs/implementation/feature-coverage-matrix.md`: coverage schema/resolver/
  provider/test v2.
- Thêm ADR mới cho quyết định dài hạn tách source locator khỏi semantic intent;
  không sửa ADR cũ theo cách làm mất lịch sử.

Không cần đổi `docs/01-product-scope.md`, `docs/02-user-flows.md`, UI design docs,
dependency graph hoặc thứ tự roadmap vì hành vi người dùng, UI layout và dependency
milestone không đổi.

## 9. Thứ tự thực thi và gate hoàn thành

1. Viết test contract v2/legacy fail trước.
2. Sửa schema/prompt Stage 1 và stamp plan version.
3. Nâng compatibility reader, generation brief và reference snapshot.
4. Tách resolver khỏi `visualIntent`.
5. Áp mode matrix trong một provider composer dùng chung preview/create/worker.
6. Cập nhật UI/API types và E2E preview.
7. Chạy API focused tests, API full test, API/web typecheck, ESLint, web focused
   E2E; không chạy live provider.
8. Cập nhật source-of-truth docs/ADR sau khi behavior và test đã khớp.

Done khi:

- Stage 1 mới không thể persist locator nguồn trong `visualIntent`;
- Stage 2 current v2 không nhận bất kỳ mã/trang/locator SGK nào;
- plan legacy vẫn đọc được và current legacy không bị sanitize đoán mò;
- resolver không dùng semantic intent để chọn source asset;
- preview phản ánh đúng request generate thật;
- mọi local check pass và chưa phát sinh paid provider call.
