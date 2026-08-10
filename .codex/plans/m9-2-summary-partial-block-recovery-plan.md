# Kế hoạch gọn M9.2 - Block lỗi không làm mất toàn bộ tóm tắt

Ngày cập nhật: 2026-08-10
Trạng thái: `DONE` — baseline và corrective pass phân loại
`REVIEWABLE`/`UNRENDERABLE` đã hoàn tất ngày 2026-08-10
Phạm vi bắt buộc: cô lập block lỗi để không chặn toàn bài. Nút tạo lại riêng
block là phase tùy chọn, không tính vào hotfix này.

Kết quả thực hiện:

- baseline đã commit trước khi làm tại `7eef4172`;
- transport/acceptance schema đã tách ở `lesson-summary-schema-v40`;
- generation chỉ có một provider attempt, không fallback/retry/repair tự động;
- block hợp lệ giữ nguyên; block lỗi cục bộ vẫn lưu/render phần an toàn và có
  `reviewIssues` thân thiện cho admin;
- admin sửa/lưu nháp/chấp nhận issue bình thường; chỉ publish bị chặn;
- focused API pass 9 file/148 test; Playwright pass laptop/iPad/Chromium mobile/
  WebKit mobile;
- live Bài 15 bằng `gpt-5.4` pass, 6/6 diagram hiển thị; artifact và ảnh đạt
  chuẩn đã lưu riêng;
- compiler preflight đã được bổ sung sau regression thực tế: `INTENT` có cấu
  trúc đúng nhưng thiếu dữ liệu để compiler dựng hình sẽ tạo placeholder
  `DIAGRAM_CANNOT_RENDER` tại block, không còn thoát ra làm thất bại toàn job;
  mọi compiler family có throw path đều đi qua cùng một boundary, kết quả hợp lệ
  được materialize một lần để mapper không compile lại;
- mapper có boundary cuối cho từng theory/example/note/application block; lỗi
  ngoài dự kiến dùng `BLOCK_CANNOT_PROCESS` và fallback nhỏ nhất thay vì fail job;
  focused M9.2 pass 9 file/148 test, worker persistence test pass và hai trạng
  thái review/placeholder pass 8 Playwright case trên 4 viewport;
- phase tùy chọn tạo lại riêng block không triển khai, đúng chỉ đạo owner.

## 1. Mục tiêu duy nhất

Nếu response tổng vẫn đọc được và xác định được block sở hữu lỗi:

- giữ và lưu toàn bộ block hợp lệ;
- block/hình còn render an toàn nhưng chưa đạt semantic/quality được giữ nguyên
  để admin nhìn thấy và gắn trạng thái `Cần review` ngay cạnh;
- block/hình hỏng cấu trúc, không thể render an toàn, vẫn giữ đúng vị trí bằng
  placeholder `Cần sửa` thay vì làm mất toàn bài;
- summary vẫn hiển thị cho admin ở `NEEDS_REVIEW`;
- không hiển thị raw JSON làm thông báo chính;
- admin chỉ có thể bấm `Chấp nhận hình này` khi hình vẫn dựng được và issue thuộc
  loại `REVIEWABLE`; thao tác này không gọi AI;
- hình đã thành placeholder `Hình lỗi` thuộc loại `UNRENDERABLE`, không có nút
  chấp nhận và backend không bao giờ coi `accepted=true` là hợp lệ;
- trạng thái `Cần review`/`Cần sửa` không khóa editor: admin vẫn sửa, thêm, xóa,
  sắp xếp block và lưu nháp như bình thường;
- không cho phát hành cho tới khi admin chấp nhận issue `REVIEWABLE`, hoặc sửa,
  xóa hay chủ động tạo lại thành công issue `UNRENDERABLE`.
- lần bấm `Bắt đầu tạo` ban đầu chỉ gọi AI đúng một lần; hệ thống không tự retry
  và không tự gọi AI để sửa các block lỗi;
- nếu triển khai phase tùy chọn, chỉ khi admin chủ động bấm `Tạo lại` tại một
  block lỗi thì hệ thống mới gọi AI thêm đúng một lần cho riêng block đó.

Chỉ fail toàn job khi provider không trả response đọc được, root JSON không thể
phân tách section/block, source stale hoặc database/hạ tầng lỗi.

## 2. Ranh giới bắt buộc của hotfix

- Không tự động gọi AI lần hai sau lượt tạo nội dung ban đầu.
- Không tự retry block lỗi, không chạy repair ngầm và không tự chuyển provider.
- Không tự tạo lại đồng loạt mọi block lỗi.
- Hotfix không thêm request provider và không phụ thuộc chức năng tạo lại block.

Những gì không làm trong bản sửa này:

- Không thêm preview chi phí cho từng lần tạo lại block.
- Không thêm enum, bảng hoặc Prisma migration.
- Không xây error taxonomy tổng quát cho mọi provider.
- Không thay đổi layout/coverage engine hoặc output của hình đã pass. Renderer
  chỉ tách structural-safe gate khỏi semantic acceptance để admin vẫn xem được
  hình cần review mà không làm suy giảm golden path.

Ngay sau hotfix, admin có thể chấp nhận hình render-safe, hoặc dùng editor hiện
có để sửa/xóa block `Cần review`/`Cần sửa`. Nút
`Tạo lại` riêng block là phase độc lập; nếu làm, chỉ thao tác chủ động đó mới
được phép phát sinh request AI mới.

## 3. Nguyên nhân cần sửa

Hiện `lessonSummaryProviderOutputSchema` validate toàn object. Một lỗi ở
theory/example/note/application/diagram làm `generateStructured()` throw, nên
`persist()` không chạy và UI chỉ thấy `Tạo thất bại`.

Ca owner cung cấp có hai diagram lỗi cục bộ nhưng toàn bộ phần chữ vẫn bị bỏ:

- marker `AB, AD` khai báo bằng nhau nhưng tọa độ lệch quá 2%;
- segment `BC` bị lặp trong một marker.

## 4. Thiết kế tối thiểu

### 4.1. Tách parse tổng và validate block

Tạo transport schema đủ chặt để provider vẫn trả:

- title;
- sections/units;
- wrapper phân biệt theory, illustration, note và application exercise;
- candidate payload của từng block.

Transport schema chỉ bảo đảm đọc được ranh giới block. Sau provider call, backend
`safeParse` từng block bằng acceptance schema hiện có.

```text
response đọc được
→ duyệt từng block
→ block pass: map như hiện tại
→ block fail nhưng render-safe: giữ hình/block + badge Cần review
→ vài phần tử không render-safe: bỏ đúng phần tử lỗi, vẫn vẽ phần còn lại
→ không còn hình có ý nghĩa: recovery placeholder Hình lỗi
→ persist toàn summary NEEDS_REVIEW
```

Nếu không đọc được root/section/block ownership thì vẫn fail toàn job.

#### Pass-through invariant cho mọi block đã đạt chuẩn

- Block pass acceptance schema/semantic validator phải tiếp tục dùng nguyên
  mapper và renderer hiện tại; không chạy progressive sanitizer/fallback.
- `diagramSpec` của hình pass không được bị thêm, bớt, đổi tọa độ, marker, label,
  style hoặc thứ tự primitive bởi hotfix.
- Nội dung text, công thức, bảng, ví dụ và metadata của block pass cũng không
  được bị sửa, cắt hoặc sắp xếp lại bởi hotfix.
- Progressive rendering chỉ được kích hoạt trong nhánh `safeParse`/semantic check
  không pass.
- Bộ fixture và ảnh đã đạt chuẩn là golden baseline bắt buộc. Nếu normalized
  content/SVG hoặc screenshot của một hình pass thay đổi ngoài sai số render cho
  phép thì hotfix chưa đạt Definition of Done.

### 4.2. Progressive rendering — ưu tiên tối đa cho hình xuất hiện

1. `REVIEW_REQUIRED`: payload vẫn đủ cấu trúc để renderer hiển thị an toàn nhưng
   chưa đạt semantic/quality, ví dụ marker bằng nhau mâu thuẫn với tọa độ. Admin
   vẫn nhìn thấy nguyên hình và badge `Cần review` ngay cạnh hình. Admin có thể
   bấm `Chấp nhận hình này` sau khi tự kiểm tra; thao tác chỉ resolve warning,
   không gọi provider.
2. `PARTIAL_RENDER`: nếu chỉ một số primitive/marker/label hỏng, cô lập đúng phần
   tử đó và vẫn vẽ mọi phần còn an toàn khi kết quả còn có ý nghĩa. Badge phải
   ghi `Cần review` và cho admin biết phần tử nào không hiển thị; không tự đoán
   điểm, tọa độ hoặc quan hệ toán học còn thiếu.
3. `UNRENDERABLE`: chỉ dùng khi không thể tạo được bất kỳ hình có ý nghĩa nào,
   chẳng hạn thiếu toàn bộ điểm/tọa độ nền tảng hoặc mọi primitive chính đều tham
   chiếu dữ liệu không tồn tại. Khi đó mới hiển thị placeholder `Hình lỗi` đúng
   vị trí và giữ nguyên mọi phần chữ hợp lệ của block.

`Luôn hiển thị` nghĩa là admin luôn thấy summary và ưu tiên thấy toàn bộ hoặc một
phần hình nếu còn render được; placeholder toàn vùng hình là fallback cuối cùng
khi không còn output hình có ý nghĩa. Nó không có nghĩa ép renderer thực thi JSON
hỏng hoặc tự bịa dữ liệu toán học.
Student vẫn không thấy draft chưa được duyệt và publish vẫn bị chặn khi còn bất
kỳ issue chưa được admin resolve.

#### Cùng một cơ chế cho mọi loại block

Quy tắc không giới hạn ở hình vẽ mà áp dụng cho theory, theorem, property,
procedure, note, example, application exercise, bảng, biểu đồ, công thức và các
block summary khác:

1. Block còn render an toàn và còn ý nghĩa: vẫn hiển thị nguyên phần dùng được,
   gắn `Cần review` sát field/sub-block có vấn đề.
2. Chỉ một field/sub-block hỏng: cô lập đúng phần đó; không ẩn cả block.
3. Không còn nội dung cốt lõi nào có thể hiển thị an toàn: mới dùng placeholder
   cho riêng block đó.
4. Admin có thể chấp nhận phần còn render được, sửa hoặc xóa; chấp nhận không gọi
   AI.
5. Raw HTML/script, payload không an toàn hoặc dữ liệu có thể làm renderer crash
   tuyệt đối không được render chỉ để đạt mục tiêu “luôn hiển thị”.

Ví dụ:

- example có đề bài hợp lệ nhưng thiếu answer: vẫn hiện đề bài, vùng answer là
  `Cần sửa`;
- theory có nội dung đúng nhưng illustration lỗi: vẫn hiện toàn bộ theory, xử lý
  riêng illustration theo progressive rendering;
- note có một công thức LaTeX hỏng: vẫn hiện phần chữ an toàn, công thức đó có
  fallback và badge `Cần review`;
- bảng có một ô lỗi: vẫn hiện các ô/hàng an toàn và đánh dấu đúng ô lỗi;
- block không xác định được `type` và không còn nội dung cốt lõi có thể map: dùng
  placeholder cho riêng block, các block khác giữ nguyên.

### 4.3. Metadata gọn trong content JSON

Không sửa database và không tăng persisted wrapper version. Generation tiếp tục
dùng `lesson_summary_blocks.version=2`, bổ sung `reviewIssues[]` optional ở root
hoặc đúng block sở hữu lỗi:

```json
{
  "reviewIssues": [
    {
      "id": "DIAGRAM_NEEDS_REVIEW-abc123",
      "code": "DIAGRAM_NEEDS_REVIEW",
      "path": "sections.0.blocks.1.visual.spec",
      "message": "Hình vẽ còn chi tiết chưa khớp quy tắc toán học.",
      "suggestion": "Sửa các điểm, cạnh hoặc ký hiệu trong chi tiết kỹ thuật.",
      "technicalDetails": "markers.equalLengths.0: ...",
      "fingerprint": "sha256",
      "accepted": false
    }
  ]
}
```

Hình còn structural-safe giữ nguyên `visual`; chỉ marker/chi tiết không an toàn
được bỏ riêng khi xác định được. Khi không còn đủ dữ liệu để renderer dựng hình,
`visual` bị bỏ nhưng issue `DIAGRAM_CANNOT_RENDER` vẫn nằm đúng block để UI hiện
placeholder `Hình lỗi`. Field text bắt buộc bị trống nhận nội dung tạm
`[Cần bổ sung ...]` cùng issue cụ thể để block vẫn chỉnh sửa được.

Fingerprint chỉ bám target của issue (diagram spec hoặc field tương ứng). Admin
chấp nhận issue không gọi AI; nếu target thay đổi, acceptance cũ tự mất hiệu lực
và backend validate lại khi lưu.

Technical details được sanitize, giới hạn độ dài và chỉ hiển thị khi admin mở
`Chi tiết kỹ thuật`.

#### Copy `Cần review` dành cho admin

- Badge luôn đi cùng hai dòng ngắn ngay tại block/field có vấn đề:
  - `Vấn đề:` mô tả phần nào sai hoặc thiếu;
  - `Gợi ý sửa:` nêu một hoặc hai thao tác cụ thể admin có thể làm.
- Câu giải thích phải trả lời được: **phần nào** cần xem và **vấn đề là gì**;
  tránh các câu chung chung như `Dữ liệu không hợp lệ` hoặc `Validation failed`.
- Ưu tiên một câu, tối đa khoảng 140 ký tự; dùng ký hiệu toán học quen thuộc như
  `AB`, `AD`, `B` khi giúp admin xác định đúng vị trí.
- Không hiển thị path Zod, tên schema, stack trace hoặc raw JSON trong copy chính.
- Nút `Chi tiết kỹ thuật` là nơi tùy chọn để xem path/code đã sanitize.
- Gợi ý được map xác định từ validator code + field path; không gọi AI, không tự
  sửa dữ liệu và không suy đoán nội dung toán học còn thiếu.
- Với dữ liệu thiếu/sai, hai dòng chính chỉ hiển thị tên tiếng Việt dễ hiểu; tên
  trường và đường dẫn nội bộ chỉ nằm trong `Chi tiết kỹ thuật`.
- Nếu chưa có mapping chuyên biệt, dùng fallback an toàn:
  `Kiểm tra và bổ sung <tên phần dữ liệu>`, không bịa giá trị cần điền.

Ví dụ copy:

- `Vấn đề: AB và AD được đánh dấu bằng nhau nhưng độ dài trên hình chưa khớp.`
  `Gợi ý sửa: Điều chỉnh tọa độ hoặc bỏ ký hiệu bằng nhau chưa đúng.`
- `Vấn đề: Đoạn AB thiếu điểm B nên đoạn này chưa được vẽ.`
  `Gợi ý sửa: Thêm điểm B hoặc sửa đầu mút của đoạn AB.`
- `Vấn đề: Ví dụ đang thiếu phần đáp án.`
  `Gợi ý sửa: Thêm nội dung vào phần đáp án.`
- `Vấn đề: Công thức chưa hiển thị đúng ký hiệu.`
  `Gợi ý sửa: Kiểm tra lại các ký hiệu trong công thức.`
- `Vấn đề: Ô hàng 2, cột 3 của bảng đang thiếu giá trị.`
  `Gợi ý sửa: Nhập giá trị cho ô ở hàng 2, cột 3.`

### 4.4. Job và publish

- Partial summary persist thành công: job `SUCCEEDED`, summary `NEEDS_REVIEW`.
- Result có `outcome=SUCCEEDED_WITH_WARNINGS` và `blockingIssueCount`.
- Card hiển thị `Đã tạo, có 2 mục cần review`, CTA `Mở để kiểm tra`.
- `PUT summary` với `APPROVED` bị reject nếu còn placeholder/recovery issue.
- `Chấp nhận hình này` dùng flow lưu draft hiện có để resolve
  `REVIEW_REQUIRED`; backend vẫn kiểm tra đúng block đang được review và ghi
  audit theo flow cập nhật summary hiện có.
- Save draft vẫn hoạt động kể cả block đang `Cần review`/`Cần sửa`; warning không
  được disable field, block action hoặc nút lưu nháp.
- Sau mỗi lần admin lưu draft, backend kiểm tra lại các block đã thay đổi: issue
  đã hết thì tự gỡ badge; issue còn thì cập nhật lời giải thích, nhưng vẫn lưu
  draft. Chỉ payload có rủi ro bảo mật hoặc làm hỏng cấu trúc root mới bị từ chối.
- Student không thấy nội dung vì student API chỉ trả summary đã duyệt.

### 4.5. Phase tùy chọn — tạo lại một block theo thao tác của admin

- Thêm action admin-only nhận `summaryId` và định danh ổn định của block lỗi.
- Backend tự lấy source/context, loại block mong đợi và issue hiện tại; client
  không được tự gửi system prompt hay schema tùy ý.
- Mỗi thao tác tạo một request AI riêng, chỉ yêu cầu output của đúng loại block.
- Output vẫn qua acceptance schema và semantic validator hiện có.
- Nếu hợp lệ, thay atomically đúng block đích rồi tính lại
  `blockingIssueCount`; các block khác giữ nguyên byte-for-byte.
- Nếu không hợp lệ/provider lỗi, chỉ block đích báo `Tạo lại chưa thành công` và
  vẫn ở trạng thái `Cần sửa`.
- Không có vòng lặp tự động sau lần thất bại; muốn thử tiếp, admin phải chủ động
  bấm lại.

## 5. Các bước triển khai

### Bước 1 — Fixture tái hiện

- Thêm fixture đúng hai lỗi trong ảnh owner.
- Thêm một fixture text block lỗi, ví dụ example thiếu answer.
- Viết test đỏ chứng minh hiện lỗi con làm toàn job fail.

### Bước 2 — Backend partial mapping

- Tách transport schema và acceptance schema.
- Tạo helper `safeMapLessonSummaryBlock()`.
- Tạo mapper deterministic `buildAdminRecoveryIssue(code, path, params)` trả về
  `message`, `suggestion`, `fieldLabel` và sanitized `technicalIssues`.
- Dùng dictionary tên field tiếng Việt dùng chung cho UI/API; lỗi chưa có mapping
  chuyên biệt dùng fallback theo path, không gọi AI.
- Map lỗi cục bộ thành placeholder/issue.
- Persist summary partial `NEEDS_REVIEW`.
- Giữ fail-closed cho root/provider/source/database.

### Bước 3 — Publish guard và UI tối thiểu

- Chặn `APPROVED` khi còn issue.
- Card không in raw job error cho partial case.
- Summary editor hiển thị placeholder đúng vị trí.
- Mọi field/block render-safe vẫn được hiển thị, có badge `Cần review` và action
  `Chấp nhận` không gọi AI; với hình dùng copy cụ thể `Chấp nhận hình này`.
- Mỗi badge có câu giải thích tiếng Việt ngắn, cụ thể; raw validator chỉ nằm
  trong `Chi tiết kỹ thuật`.
- Mỗi issue có `Gợi ý sửa` cụ thể; dữ liệu thiếu/sai hiển thị tên tiếng Việt dễ
  hiểu, còn tên trường và đường dẫn chỉ nằm trong `Chi tiết kỹ thuật`.
- Không đặt `disabled`/`readOnly` lên block chỉ vì có issue; giữ nguyên toàn bộ
  thao tác sửa, thêm, xóa, sắp xếp và lưu nháp của editor hiện tại.
- Admin cũng có thể sửa/xóa block lỗi bằng editor hiện có.

### Bước 4 — Kiểm thử hotfix

- Focused schema/mapper/worker/API tests.
- API typecheck/build và web lint/typecheck liên quan.
- Một browser smoke ở viewport mobile quan trọng nhất; không mở rộng thành ma
  trận responsive/theme đầy đủ trong hotfix backend này.
- Chạy toàn bộ golden fixture M9.2 từ cache; assert hình pass giữ nguyên
  `diagramSpec`/normalized SVG và đối chiếu screenshot đại diện để bảo đảm không
  làm hỏng block/hình đang đạt. Không gọi provider cho regression này.

### Phase tùy chọn sau hotfix — Manual block regeneration

- Thêm action/job tạo lại đúng một block theo thao tác admin.
- Reuse prompt builder, context loader, `AiService` và validator hiện có.
- Thay đúng block theo compare-and-set/version để không ghi đè sửa đổi mới hơn.
- Thêm pending/disabled/error state riêng cho nút `Tạo lại`.
- Không gọi action này từ worker của lượt tạo summary ban đầu và không tự retry.

## 6. Test case bắt buộc

1. Diagram equal-length sai nhưng render-safe: text và hình vẫn hiện cho admin,
   badge cạnh hình là `Cần review`.
2. Duplicate marker nhưng render-safe: chỉ hình đó bị `Cần review`.
3. Diagram có một primitive thiếu reference nhưng phần còn lại có ý nghĩa: bỏ
   đúng primitive lỗi, vẫn vẽ phần còn lại và gắn `Cần review`.
4. Diagram không còn điểm/primitive chính nào có thể render: text vẫn hiện, vùng
   hình thành placeholder `Hình lỗi`.
5. Example thiếu answer: đề bài vẫn hiện, chỉ vùng answer thành `Cần sửa`.
6. Note có một công thức lỗi: phần chữ an toàn vẫn hiện, chỉ công thức có fallback
   và `Cần review`.
7. Một application exercise không còn nội dung cốt lõi để render: chỉ exercise
   đó thành placeholder, toàn phần lý thuyết vẫn được lưu.
8. Root JSON bị cắt/không parse được: job fail, summary cũ không bị ghi đè.
9. Còn issue thì không publish; admin vẫn save draft được.
10. UI không in raw JSON/Zod array làm copy chính.
11. Mỗi issue có copy tiếng Việt chỉ đúng đối tượng và nguyên nhân; không dùng
    câu chung chung `Dữ liệu không hợp lệ`.
12. Dữ liệu thiếu/sai có `Gợi ý sửa` tất định bằng tiếng Việt dễ hiểu; tên trường
    và đường dẫn chỉ nằm trong `Chi tiết kỹ thuật`; gợi ý không gọi AI và không
    tự bịa giá trị.
13. Lượt tạo ban đầu có ba block lỗi vẫn chỉ gọi provider đúng một lần.
14. Hotfix không phát sinh bất kỳ request AI bổ sung nào.
15. Admin bấm `Chấp nhận`: warning được resolve, block/field giữ nguyên và không
    có provider request.
16. Mọi golden block/diagram đã pass trước hotfix vẫn đi đúng mapper/renderer cũ;
    content không đổi; riêng hình có `diagramSpec` và normalized SVG không đổi.
17. Admin sửa một block `Cần review` và lưu nháp: save thành công; hết lỗi thì
    badge tự gỡ, còn lỗi thì badge/copy được cập nhật; editor không bị khóa.

Test 18-19 chỉ áp dụng nếu owner yêu cầu làm phase `Tạo lại` riêng block:

18. Bấm `Tạo lại` ở block A chỉ thay block A; block B và các block hợp lệ giữ
    nguyên.
19. Tạo lại thất bại không làm mất summary; không tự retry.

## 7. Thời gian và chi phí đúng phạm vi

| Phần                                       |                             Ước tính |
| ------------------------------------------ | -----------------------------------: |
| Fixture tái hiện + test đỏ                 |                            0,5-1 giờ |
| Tách validate theo block + partial mapping |                            1,5-2 giờ |
| Persist warning + UI `Cần sửa` tối thiểu   |                            1-1,5 giờ |
| Focused regression + mobile smoke          |                            1-1,5 giờ |
| **Hotfix bắt buộc**                        | **4-6 giờ, khoảng nửa đến một ngày** |

Phase tùy chọn `Tạo lại` riêng block cần thêm khoảng **3-5 giờ** vì đây là một
API/job/provider flow mới có chống click lặp và chống ghi đè. Thời gian này không
được cộng vào hotfix nếu owner chỉ yêu cầu bỏ cơ chế chặn toàn bài.

Không cần gọi provider trả phí để sửa và xác minh hotfix vì đã có fixture/raw
error thật. Chi phí bắt buộc: **0 VNĐ**. Một live full-lesson smoke chỉ là bằng
chứng bổ sung sau khi local pass, phải được owner xác nhận riêng trước khi gọi.

Owner đã cho phép live test. Hai smoke `gpt-5.4` thành công, không fallback; lượt
có artifact ghi nhận 93.647 input token (92.928 cached), 4.125 output token,
97.772 total token, latency 43.424 ms và ước tính khoảng 2.173 VNĐ. Tổng hai lượt
thành công ước tính khoảng 4,3-4,5 nghìn VNĐ; một thử nghiệm `gpt-4.1` bị 429 trước
khi hoàn tất do TPM 93.668 vượt quota 30.000 nên không có completion/chi phí đáng
kể. Tổng vẫn thấp hơn nhiều ngân sách owner cho phép.

## 8. Definition of Done

1. Lỗi có block/field ownership không làm fail toàn summary.
2. Mọi block và field còn render an toàn, còn ý nghĩa đều hiển thị và chỉnh sửa
   được; fallback chỉ thay đúng phần hỏng nhỏ nhất có thể cô lập.
3. Hình render-safe nhưng chưa đạt vẫn hiện cho admin với badge `Cần review` sát
   vùng hình và có thể được admin chấp nhận không cần gọi AI; nếu chỉ vài phần tử
   hỏng thì vẫn vẽ phần còn lại. Placeholder `Hình lỗi` chỉ xuất hiện khi không
   còn hình có ý nghĩa nào có thể render.
4. Không raw JSON làm thông báo chính.
5. Mọi badge `Cần review` có lời giải thích tiếng Việt ngắn, dễ hiểu, chỉ rõ đối
   tượng và nguyên nhân; chi tiết kỹ thuật được thu gọn riêng.
6. Mỗi issue có `Gợi ý sửa` cụ thể, tất định; phần chính chỉ dùng tên tiếng Việt,
   tên trường/đường dẫn nằm trong chi tiết kỹ thuật, không gọi AI và không bịa dữ liệu.
7. Không publish khi còn issue; save draft vẫn được.
8. `Cần review`/`Cần sửa` không làm editor read-only hoặc disabled; admin sửa,
   thêm, xóa, sắp xếp và lưu nháp bình thường.
9. Root/provider/source/database lỗi vẫn fail an toàn và không ghi đè bản cũ.
10. Focused tests/typecheck/build/lint pass.
11. Mobile smoke và golden cũ không regress.
12. Lượt tạo summary ban đầu luôn chỉ có một provider request và hotfix không tự
    phát sinh request AI bổ sung.
13. Hình đã pass giữ nguyên `diagramSpec` và đi qua mapper/renderer cũ; fallback
    không được chạy trên happy path.
14. Mọi block không phải hình đã pass cũng giữ nguyên content và đi qua
    mapper/renderer cũ; fallback không được chạy trên happy path.

## 9. Corrective pass — phân loại lỗi đồng bộ và bỏ chấp nhận “Hình lỗi”

Kết quả thực hiện ngày 2026-08-10:

- compiler có nhánh trả spec kèm semantic diagnostics; strict compiler dùng cho
  golden vẫn giữ nguyên hành vi;
- recovery giữ hình structural-safe dưới dạng `DIAGRAM_NEEDS_REVIEW`, chỉ dùng
  `DIAGRAM_CANNOT_RENDER` khi thật sự không còn spec an toàn;
- review issue có resolution `ACCEPT_OR_FIX | FIX_ONLY`, dữ liệu cũ được suy ra
  theo code; backend ép hard issue về `accepted=false` và chống payload giả;
- UI chỉ hiện nút chấp nhận cho issue reviewable. Placeholder hard diagram chỉ
  có `Xóa hình lỗi`; xóa chỉ cập nhật editor local, reload trước Lưu phục hồi dữ
  liệu server, còn bấm `Lưu nội dung` mới gửi đúng một upsert;
- focused API regression đạt 5 file/125 test, API integration 6/6, API typecheck
  đạt; Playwright review/delete đạt 8/8 và artifact live đạt 4/4 trên Chromium
  laptop/iPad/mobile cùng WebKit mobile;
- live Bài 15 gọi đúng một lần bằng `gpt-5.4-2026-03-05`, 0 review issue,
  93.647 input token (92.928 cached), 5.371 output token, 56.129 ms; chi phí ước
  tính khoảng 2.640 VNĐ theo price snapshot trong repo và tỷ giá 25.000 VNĐ/USD;
- bốn ảnh live đã duyệt nằm trong
  `anh-chup-hinh-toan-dat-chuan/co-che-review-tung-block/`; bốn ảnh minh họa
  placeholder được tách riêng tại
  `anh-chup-hinh-toan-can-sua/co-che-hinh-loi-khong-the-ve/`.

### 9.1. Lý do phải có corrective pass

Hotfix hiện tại đã giữ được toàn bài, nhưng đang dùng compiler strict làm đồng
thời hai nhiệm vụ khác nhau:

1. quyết định hình có thể dựng an toàn hay không;
2. quyết định hình có đúng đầy đủ quy tắc toán học hay không.

Vì vậy một hình đã được compiler dựng thành SVG an toàn nhưng còn thiếu điểm/ký
hiệu semantic vẫn bị hạ xuống `DIAGRAM_CANNOT_RENDER`. UI lại render nút
`Chấp nhận hình này` cho mọi mã bắt đầu bằng `DIAGRAM_`, kể cả placeholder thật
sự không có hình. Hai hành vi này đều phải sửa tại nguồn, không vá riêng từng
ảnh hoặc chỉ ẩn nút bằng CSS.

### 9.2. State machine duy nhất cho mọi block

| Trạng thái nội bộ | Nội dung hiển thị | Trạng thái admin | Có nút chấp nhận | Cách giải quyết |
| --- | --- | --- | --- | --- |
| `VALID`/`AUTO_FIXED` | Hình hoặc block hoàn chỉnh | Không cảnh báo | Không cần | Lưu bình thường |
| `REVIEWABLE` | Giữ nguyên phần dựng/đọc được | `Cần review` | Có | Chấp nhận hoặc sửa |
| `UNRENDERABLE` | Placeholder tại đúng phần hỏng | `Cần sửa` | **Không** | Sửa, xóa hoặc chủ động tạo lại |

Quy tắc bắt buộc:

- `DIAGRAM_NEEDS_REVIEW` chỉ được tạo khi `visual.spec` còn render an toàn.
- `DIAGRAM_CANNOT_RENDER` chỉ được tạo khi không còn spec có ý nghĩa để render.
- `BLOCK_CANNOT_PROCESS` và mọi placeholder hard-error khác cũng là `FIX_ONLY`,
  không có nút chấp nhận.
- `accepted=true` chỉ có hiệu lực với issue `ACCEPT_OR_FIX`.
- Issue `FIX_ONLY` luôn unresolved cho tới khi dữ liệu được sửa/xóa; không thể
  lách bằng payload gửi trực tiếp tới API.

### 9.3. Hợp đồng issue dùng chung

- Bổ sung resolution policy nội bộ vào review issue:
  `ACCEPT_OR_FIX | FIX_ONLY`.
- Không cần Prisma migration vì issue đang nằm trong `contentJson`.
- Dữ liệu cũ thiếu policy được backend suy ra theo mã issue rồi chuẩn hóa khi
  đọc/lưu; không buộc admin sinh lại bài.
- Reconciler luôn ép `accepted=false` cho `FIX_ONLY`. Save draft vẫn thành công
  để không tái tạo lỗi chặn luồng; nếu request đòi `APPROVED`, publish guard trả
  lỗi tiếng Việt vì hard issue vẫn chưa được sửa.
- Nếu sau này có endpoint accept riêng, endpoint phải trả lỗi nghiệp vụ cho
  `FIX_ONLY`; frontend không phải là lớp bảo vệ duy nhất.

### 9.4. Tách “dựng được” khỏi “đúng hoàn toàn” trong compiler/recovery

1. Giữ API compiler strict hiện tại cho golden/acceptance path.
2. Thêm kết quả compile có chẩn đoán, không làm mất spec vừa dựng được:
   - `VALID`: spec qua structural và semantic validation;
   - `REVIEWABLE`: spec qua structural/render-safe nhưng còn semantic issues;
   - `UNRENDERABLE`: intent không có compiler phù hợp hoặc không tạo được spec
     structural-safe.
3. Recovery luôn chạy structural safety trước semantic acceptance.
4. Nhãn chữ thừa có thể bỏ tất định thì sanitize và trả `AUTO_FIXED`, không tạo
   cảnh báo oan.
5. Primitive/marker/label lỗi cục bộ được loại đúng phần tử; nếu phần còn lại
   vẫn biểu diễn được ý chính thì trả `REVIEWABLE`, không placeholder.
6. Không tự đổi archetype/variant hoặc bịa thêm điểm để cứu intent sai hoàn toàn.

Kỳ vọng với 8 lỗi Bài 15 đang lưu:

- 2 lỗi nhãn chữ thừa: tự sửa an toàn, hình hiện và không cảnh báo;
- 3 compiler đã dựng được spec nhưng semantic còn thiếu điểm khai báo: hình vẫn
  hiện với `Cần review` và có thể chấp nhận;
- 3 intent có archetype/variant không có bộ dựng tương ứng: giữ placeholder
  `Hình lỗi`, không có nút chấp nhận.

### 9.5. Backend review/publish

- Tạo helper phân loại resolution policy dùng chung cho create/reconcile/list.
- Reconcile issue cũ theo fingerprint nhưng không giữ `accepted=true` nếu issue
  hiện là `FIX_ONLY`.
- `listUnresolvedLessonSummaryReviewIssues()` luôn trả hard issue bất kể client
  gửi cờ accepted nào.
- `PUT` ở `NEEDS_REVIEW` vẫn lưu được các sửa đổi khác và trả content đã chuẩn
  hóa; không fail toàn draft chỉ vì client cũ gửi sai cờ.
- `PUT` ở `APPROVED` tiếp tục bị chặn nếu còn `REVIEWABLE` chưa chấp nhận hoặc
  bất kỳ `FIX_ONLY` nào.
- Message/gợi ý sửa dùng tiếng Việt dễ hiểu; thuật ngữ/path kỹ thuật chỉ nằm
  trong phần chi tiết.

### 9.6. UI admin

- Chỉ render nút `Chấp nhận hình này` khi issue là `ACCEPT_OR_FIX` **và** hình
  thực tế đang hiện.
- Placeholder `Hình lỗi` không render nút chấp nhận; chỉ hiển thị vấn đề, gợi ý
  sửa và nút destructive `Xóa hình lỗi` cho admin.
- `Xóa hình lỗi` chỉ xuất hiện với diagram `FIX_ONLY`; không xuất hiện với hình
  `REVIEWABLE`, block hợp lệ hoặc giao diện chỉ đọc của học sinh.
- Khi bấm `Xóa hình lỗi`, editor cập nhật ngay bản nháp local giống thao tác bấm
  dấu `x` trong khối JSON: xóa `visual` lỗi và đúng các review issue hard-error
  thuộc hình đó; không xóa block, nội dung, lời giải, đáp án hoặc hình sibling.
- Thao tác xóa **không gọi API**, không autosave và không hiện thành công giả.
  Placeholder/cảnh báo biến mất ngay trên bản đang chỉnh, nhưng tải lại trang
  trước khi lưu sẽ nhận lại dữ liệu đã lưu cũ.
- Chỉ khi admin bấm nút `Lưu nội dung` ở cuối editor, toàn bộ thay đổi local mới
  đi qua API upsert hiện có. Backend reconcile payload; nếu block không còn hình
  lỗi thì hard issue biến mất trong bản đã lưu.
- Nếu lưu thất bại, dữ liệu trên server không đổi; bản chỉnh local vẫn còn để
  admin sửa tiếp hoặc bấm lưu lại theo đúng hành vi editor hiện tại.
- Không mở confirm dialog riêng cho nút này vì đây chưa phải thao tác ghi dữ liệu;
  mốc xác nhận/persist duy nhất là nút `Lưu nội dung`, giống luồng xóa JSON.
- Xóa hình không được hiểu là “chấp nhận hình” và không gọi AI.
- Hard-error của block không phải hình cũng không có `Chấp nhận khối này`.
- Tiêu đề panel đổi theo tập issue:
  - chỉ reviewable: `n vấn đề cần sửa hoặc chấp nhận`;
  - chỉ hard-error: `n vấn đề cần sửa`;
  - hỗn hợp: `n vấn đề cần xử lý`.
- Không tự gọi AI, không tự retry và không thêm action giả. Nút tạo lại riêng
  block vẫn nằm ngoài corrective pass nếu owner chưa yêu cầu phase đó.
- Giữ light/dark và responsive hiện có; mobile là viewport ưu tiên khi review.

### 9.7. Thứ tự triển khai

1. **Test đỏ từ dữ liệu thật:** đóng băng 8 case Bài 15 thành fixture và test ba
   nhóm auto-fix/reviewable/unrenderable.
2. **Compiler/recovery:** trả spec kèm semantic diagnostics thay vì vứt spec khi
   assert semantic thất bại.
3. **Issue contract/backend:** resolution policy, legacy normalization,
   publish guard và chống giả `accepted=true`.
4. **UI:** điều kiện nút accept, copy panel, placeholder hard-error và thao tác
   `Xóa hình lỗi` chỉ cập nhật local editor; tái sử dụng nút `Lưu nội dung` để
   persist mọi thay đổi cùng lúc.
5. **Regression:** focused API/worker/web tests, typecheck/build/lint phù hợp và
   toàn bộ golden diagram từ cache để khóa happy path.
6. **Browser:** Chromium laptop/iPad/mobile và WebKit mobile, light/dark; chụp
   riêng ảnh đạt/ảnh lỗi và đánh giá thủ công.
7. **Live Bài 15:** chỉ chạy sau khi local/cache pass, một lượt model đã cấu
   hình, không tự retry; đối chiếu từng hình và trạng thái UI rồi lưu ảnh.
8. **Docs:** cập nhật AI contract, API contract, UI pages và context sau khi code
   thực sự pass; không ghi Done trước khi có bằng chứng.

### 9.8. Test bắt buộc bổ sung

1. Hình structural-safe nhưng semantic thiếu điểm vẫn render và có đúng một nút
   chấp nhận.
2. `DIAGRAM_CANNOT_RENDER` có placeholder nhưng không có nút chấp nhận.
3. Placeholder diagram có nút `Xóa hình lỗi`; bấm nút chỉ bỏ local visual +
   diagram hard issue, giữ nguyên toàn bộ text và sibling.
4. Bấm xóa không phát sinh request API/provider; placeholder biến mất trong
   editor nhưng reload trước khi lưu phục hồi dữ liệu server cũ.
5. Bấm `Lưu nội dung` sau khi xóa mới phát sinh một request upsert và làm thay
   đổi tồn tại sau reload.
6. API lưu thất bại không đổi dữ liệu server; editor giữ bản local để admin thử
   lưu lại và hiển thị thông báo dễ hiểu.
7. `BLOCK_CANNOT_PROCESS` không có nút chấp nhận khối.
8. Client gửi hard issue với `accepted=true`: draft vẫn lưu nhưng response chuẩn
   hóa về false; publish vẫn bị chặn.
9. Dữ liệu legacy chưa có resolution policy vẫn đọc được và được phân loại đúng.
10. Sửa/xóa nguyên nhân hard issue rồi lưu: issue tự biến mất và có thể publish.
11. Tất cả reviewable issue hiện có vẫn chấp nhận được, không gọi provider.
12. Tất cả golden đã đạt giữ nguyên normalized spec/SVG và không phát sinh issue.
13. Job vẫn chỉ gọi provider đúng một lần; corrective pass không tự repair.
14. UI không có overflow ở mobile, iPad, laptop; trạng thái và nút đúng ở cả hai
    theme.

### 9.9. File/layer dự kiến chạm

- Compiler/recovery API:
  `compile-diagram-intent.ts`, `diagram-semantic-validator.ts`,
  `lesson-summary-recovery.ts`.
- Review contract/service API:
  `lesson-summary.types.ts`, `lesson-summary-review.ts`,
  `lesson-summaries.service.ts`, serializer liên quan.
- UI feature:
  `summary-block-renderer.tsx` cập nhật local content; admin summary tab giữ
  nguyên quyền sở hữu mutation của nút `Lưu nội dung`. Không thêm endpoint,
  mutation hay confirm dialog riêng cho thao tác xóa hình.
- Tests:
  partial-recovery unit, M9.2 integration, worker persistence và Playwright admin
  generation.
- Docs sau khi pass:
  `docs/06-ai-rag-spec.md`, `docs/api/learning-paths-lessons.md`,
  `docs/08-ui-pages-and-components.md`, `docs/implementation/M9.md` và context.

Không dự kiến thêm package, đổi database hoặc đổi renderer golden path.

### 9.10. Thời gian, live cost và Definition of Done

| Phần | Ước tính |
| --- | ---: |
| Fixture + test đỏ | 0,5-1 giờ |
| Compiler/recovery classification | 1,5-2,5 giờ |
| Backend invariant + legacy normalization | 1-1,5 giờ |
| UI + copy + xóa hình lỗi local + responsive states | 0,5-1 giờ |
| Regression, browser, screenshot, review thủ công | 1,5-2,5 giờ |
| **Tổng** | **5-8,5 giờ, khoảng một ngày làm việc** |

Local/cache test không tốn provider. Một lượt live Bài 15 dự kiến khoảng
**2.200-3.000 VNĐ** dựa trên usage gần nhất; đặt trần **5.000 VNĐ**, dừng để đánh
giá nếu lượt đầu còn lỗi thay vì tự gọi lại.

Corrective pass chỉ được coi là Done khi:

1. Ba trạng thái trên nhất quán từ recovery → contentJson → API → UI.
2. Hình render-safe không còn bị placeholder oan.
3. `Hình lỗi` và block hard-error không có nút chấp nhận và không thể được backend
   coi là đã resolve.
4. Mọi placeholder hình lỗi có nút `Xóa hình lỗi`; bấm xóa chỉ sửa bản local,
   giữ nguyên nội dung chữ và không gọi API. Chỉ nút `Lưu nội dung` mới persist
   thay đổi và ghi audit qua flow upsert hiện có.
5. Admin vẫn sửa/lưu draft được; chỉ publish bị chặn.
6. Golden cũ không regress; Bài 15 và ma trận responsive/theme có screenshot đã
   review thủ công.
