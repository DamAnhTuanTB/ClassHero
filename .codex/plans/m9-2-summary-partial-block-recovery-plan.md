# Kế hoạch gọn M9.2 - Block lỗi không làm mất toàn bộ tóm tắt

Ngày cập nhật: 2026-08-10
Trạng thái: `PLANNED` — chưa sửa code
Phạm vi bắt buộc: cô lập block lỗi để không chặn toàn bài. Nút tạo lại riêng
block là phase tùy chọn, không tính vào hotfix này.

## 1. Mục tiêu duy nhất

Nếu response tổng vẫn đọc được và xác định được block sở hữu lỗi:

- giữ và lưu toàn bộ block hợp lệ;
- block/hình còn render an toàn nhưng chưa đạt semantic/quality được giữ nguyên
  để admin nhìn thấy và gắn trạng thái `Cần review` ngay cạnh;
- block/hình hỏng cấu trúc, không thể render an toàn, vẫn giữ đúng vị trí bằng
  placeholder `Cần sửa` thay vì làm mất toàn bài;
- summary vẫn hiển thị cho admin ở `NEEDS_REVIEW`;
- không hiển thị raw JSON làm thông báo chính;
- admin có thể bấm `Chấp nhận hình này` nếu review thủ công và thấy hình vẫn dùng
  được; thao tác này không gọi AI;
- trạng thái `Cần review`/`Cần sửa` không khóa editor: admin vẫn sửa, thêm, xóa,
  sắp xếp block và lưu nháp như bình thường;
- không cho phát hành cho tới khi admin chấp nhận, sửa, xóa hoặc chủ động tạo lại
  thành công block lỗi.
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
- Không thay đổi renderer hình hoặc coverage engine đang có.

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

Không sửa database. Generation mới dùng content version 3, bổ sung type:

```json
{
  "type": "recovery_placeholder",
  "expectedBlockType": "example",
  "message": "Ví dụ này cần được kiểm tra và sửa lại.",
  "suggestion": "Thêm nội dung vào Đáp án (answer).",
  "technicalIssues": [
    { "path": "answer", "message": "Required" }
  ]
}
```

Nếu chỉ diagram lỗi nhưng text block hợp lệ, giữ nguyên text và gắn:

```json
{
  "visual": null,
  "recoveryIssue": {
    "status": "UNRENDERABLE",
    "scope": "DIAGRAM",
    "message": "Hình minh họa cần được kiểm tra và sửa lại.",
    "suggestion": "Bổ sung điểm hoặc sửa tham chiếu của đoạn bị thiếu."
  }
}
```

Với hình còn render được, giữ `visual` và đính kèm:

```json
{
  "visual": { "kind": "DIAGRAM_SPEC", "spec": {} },
  "recoveryIssue": {
    "status": "REVIEW_REQUIRED",
    "scope": "DIAGRAM",
    "message": "Hình minh họa chưa đạt kiểm tra và cần được review.",
    "suggestion": "Kiểm tra lại tọa độ hoặc bỏ ký hiệu bằng nhau chưa đúng."
  }
}
```

Technical issues được sanitize, giới hạn độ dài và chỉ hiển thị khi admin mở
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
- Với field JSON thiếu/sai, hiển thị tên tiếng Việt trước và key/path trong ngoặc,
  ví dụ `Đáp án (answer)` hoặc `Điểm B (points.B)`.
- Nếu chưa có mapping chuyên biệt, dùng fallback an toàn:
  `Kiểm tra và bổ sung trường <tên> (<path>)`, không bịa giá trị cần điền.

Ví dụ copy:

- `Vấn đề: AB và AD được đánh dấu bằng nhau nhưng độ dài trên hình chưa khớp.`
  `Gợi ý sửa: Điều chỉnh tọa độ hoặc bỏ ký hiệu bằng nhau chưa đúng.`
- `Vấn đề: Đoạn AB thiếu điểm B nên đoạn này chưa được vẽ.`
  `Gợi ý sửa: Thêm Điểm B (points.B) hoặc sửa đầu mút của đoạn AB.`
- `Vấn đề: Ví dụ đang thiếu phần đáp án.`
  `Gợi ý sửa: Thêm nội dung vào Đáp án (answer).`
- `Vấn đề: Công thức chưa hiển thị đúng ký hiệu.`
  `Gợi ý sửa: Kiểm tra lại cú pháp LaTeX của Công thức (content).`
- `Vấn đề: Ô hàng 2, cột 3 của bảng đang thiếu giá trị.`
  `Gợi ý sửa: Nhập giá trị cho Ô dữ liệu (rows[1].cells[2]).`

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
- Mỗi issue có `Gợi ý sửa` cụ thể; field JSON thiếu/sai hiển thị tên dễ hiểu và
  key/path trong ngoặc.
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
12. Field JSON thiếu/sai có `Gợi ý sửa` deterministic gồm tên dễ hiểu và key/path;
    gợi ý không gọi AI và không tự bịa giá trị.
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

| Phần | Ước tính |
| --- | ---: |
| Fixture tái hiện + test đỏ | 0,5-1 giờ |
| Tách validate theo block + partial mapping | 1,5-2 giờ |
| Persist warning + UI `Cần sửa` tối thiểu | 1-1,5 giờ |
| Focused regression + mobile smoke | 1-1,5 giờ |
| **Hotfix bắt buộc** | **4-6 giờ, khoảng nửa đến một ngày** |

Phase tùy chọn `Tạo lại` riêng block cần thêm khoảng **3-5 giờ** vì đây là một
API/job/provider flow mới có chống click lặp và chống ghi đè. Thời gian này không
được cộng vào hotfix nếu owner chỉ yêu cầu bỏ cơ chế chặn toàn bài.

Không cần gọi provider trả phí để sửa và xác minh hotfix vì đã có fixture/raw
error thật. Chi phí bắt buộc: **0 VNĐ**. Một live full-lesson smoke chỉ là bằng
chứng bổ sung sau khi local pass, phải được owner xác nhận riêng trước khi gọi.

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
6. Mỗi issue có `Gợi ý sửa` cụ thể, deterministic; field JSON thiếu/sai có tên
   tiếng Việt và key/path, không gọi AI và không bịa dữ liệu.
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
