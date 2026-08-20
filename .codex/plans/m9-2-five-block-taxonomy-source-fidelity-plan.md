# M9.2 — Kế hoạch chuẩn hóa 5 loại block và giữ độ trung thực với sách giáo khoa

## 1. Trạng thái và mục tiêu

- Task sở hữu: `M9.2` — AI tạo tóm tắt/kiến thức bài học từ PDF packet.
- Mode của kế hoạch: corrective full-stack hẹp, trọng tâm AI prompt + structured
  output schema.
- Trạng thái: owner đã duyệt, đang triển khai và kiểm thử.
- Kế hoạch này tách riêng khỏi kế hoạch searchable PDF multimodal cũ; không thay
  thế cơ chế PDF packet, STEM figure lifecycle hoặc compiler retry đã chốt.

Mục tiêu của lần sửa đổi:

1. Mỗi lượt sinh mới chỉ tạo năm loại block nội dung:
   `knowledge`, `theorem`, `property`, `example`, `note`.
2. Xóa `procedure` khỏi output mới; phương pháp và trình tự giải được gộp vào
   `knowledge`.
3. Sau mỗi `knowledge`, `theorem` hoặc `property` luôn có đúng một `example`
   minh họa trực tiếp ngay sau nó.
4. `note` được đặt trước, giữa hoặc sau các cặp kiến thức–ví dụ miễn bổ trợ đúng
   phần nội dung cần chú ý.
5. Phân loại theorem/property theo ngữ nghĩa của nhãn, câu dẫn và nội dung, không
   chỉ so khớp từ khóa cố định.
6. Không rút ngắn quá mức phần kiến thức, phương pháp và lời giải so với nguồn;
   lời giải phải có mức diễn giải tương đương phong cách sách giáo khoa.
7. Nếu nguồn có hình trực tiếp bổ trợ cho block ở phía trước hoặc phía sau block,
   block bắt buộc có figure tương ứng. Nếu nguồn không có hình hỗ trợ, AI được tự
   quyết định có bổ sung hình hay không.
8. Giữ nguyên retry compiler, trạng thái figure, xóa, thay ảnh và sinh lại hình.
9. Khóa rõ ranh giới hai giai đoạn: lượt Summary ở giai đoạn 1 phải tạo figure
   brief đầy đủ về ngữ nghĩa; backend chỉ resolve/đóng gói ngữ cảnh nguồn; lượt
   chuyên vẽ ở giai đoạn 2 phải bám brief và ảnh tham chiếu để sinh TikZ.

> Thuật ngữ: schema đề cập trong kế hoạch là JSON response/structured-output
> schema nằm trong `text.format` gửi OpenAI. Đây không phải request body schema
> của endpoint admin.

## 2. Quyết định sản phẩm đã chốt

### 2.1. Taxonomy mới

| Block       | Nội dung sở hữu                                                                                    | Không được chứa                               |
| ----------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `knowledge` | Định nghĩa, khái niệm, công thức, quy tắc, phương pháp, trình tự thực hiện và giải thích kiến thức | Đề và lời giải của ví dụ độc lập              |
| `theorem`   | Phát biểu định lí và phần diễn giải cần thiết đi kèm trong nguồn                                   | Ví dụ không thuộc phát biểu định lí           |
| `property`  | Phát biểu tính chất và phần giải thích cần thiết đi kèm trong nguồn                                | Ví dụ không thuộc phát biểu tính chất         |
| `example`   | Đề bài, lời giải chi tiết, đáp án và hình trực tiếp thuộc ví dụ                                    | Lý thuyết mới không có trong block đứng trước |
| `note`      | Chú ý, nhận xét hoặc lưu ý bổ trợ đúng phần kiến thức liên quan                                    | Một unit kiến thức mới trá hình               |

`procedure` không còn là loại block sinh mới. Khi sách trình bày “Cách làm”,
“Phương pháp”, “Các bước thực hiện” hoặc một quy trình tương đương, AI đưa toàn
bộ nội dung đó vào `knowledge.content` và giữ cấu trúc đánh số/bullet bằng
Markdown.

### 2.2. Quy tắc nhận diện khối vàng

- Khung nền vàng là tín hiệu cho vùng nội dung định nghĩa, kiến thức, định lí
  hoặc tính chất; màu nền không tự quyết định loại block.
- AI phải đọc cùng lúc:
  - câu hoặc đoạn dẫn đứng trước khung;
  - nhãn/tiêu đề gần khung;
  - nội dung bên trong khung;
  - quan hệ với phần giải thích và ví dụ xung quanh.
- Nếu ngữ cảnh có ý nghĩa thông báo nội dung tiếp theo là định lí thì bắt buộc
  dùng `theorem`, kể cả khi không có nhãn độc lập “Định lí”. Ví dụ “Ta thừa nhận
  định lí sau” chỉ là một minh họa, không phải danh sách mẫu đóng.
- Nếu ngữ cảnh có ý nghĩa thông báo nội dung tiếp theo là tính chất thì bắt buộc
  dùng `property`, kể cả khi “Tính chất” nằm trong câu dẫn thay vì nhãn riêng.
- Tín hiệu theorem/property rõ ràng có ưu tiên cao hơn lựa chọn mặc định
  `knowledge`.
- Chỉ khi câu dẫn, tiêu đề và nội dung đều không cho biết rõ loại khối, AI mới tự
  chọn `knowledge`, `theorem` hoặc `property` theo ý nghĩa chuyên môn.
- Không hard-code một danh sách từ khóa hữu hạn; các câu ví dụ chỉ giúp model
  hiểu invariant ngữ nghĩa.

### 2.3. Quy tắc nhận diện note

- Dấu hiệu thường gặp là “Chú ý”, “Nhận xét” hoặc cách diễn đạt tương đương như
  “Lưu ý”.
- AI phải dựa vào chức năng bổ trợ/cảnh báo/nhấn mạnh của đoạn, không chỉ từ khóa.
- UI sở hữu nhãn loại block, nên `note.content` đi thẳng vào nội dung và không
  lặp tiền tố “Chú ý:”, “Nhận xét:” hoặc “Lưu ý:”.
- Note phải gắn về mặt ý nghĩa với unit gần nhất phù hợp nhưng không bắt buộc nằm
  cuối section hoặc cuối bài.

### 2.4. Quy tắc hình ở phía trước hoặc phía sau

- Với mỗi `knowledge`, `theorem`, `property` và `example`, AI kiểm tra hình ở cả
  phía trước và phía sau nội dung trong mạch đọc của PDF.
- Không yêu cầu hình phải nằm sát ngay block. Quan hệ được xác định bằng ngữ
  nghĩa, câu dẫn/tham chiếu, nhãn hình, đối tượng, ký hiệu, dữ kiện và bố cục
  trang.
- Nếu hình trực tiếp giải thích, minh họa hoặc cung cấp dữ kiện cho block thì
  figure là bắt buộc và phải có `sourceReferences` về đúng trang/hình nguồn.
- Nếu hình ở trước hoặc sau nhưng thuộc nội dung khác thì không gắn vào block.
- Nếu nguồn không có hình trực tiếp hỗ trợ, AI được:
  - để `figures=[]`; hoặc
  - tự đề xuất hình khi hình thực sự giúp học sinh hiểu đúng hơn.
- Không còn quy tắc “bài hình học thì mọi block bắt buộc có hình”. Quyết định bắt
  buộc nằm ở quan hệ block–hình nguồn, không nằm ở tên bài hoặc phân loại toàn bài.
- `note` không thuộc nhóm bắt buộc có figure.
- Khi có hình nguồn, brief phải ưu tiên bố cục, quan hệ, tỉ lệ tương đối, nhãn và
  phong cách sách giáo khoa; màu có thể thay đổi nếu hợp lý.
- Tô màu là thông tin ngữ nghĩa, không phải trang trí. AI phải xác định chính xác
  đối tượng/miền nào được tô, đường biên nào giới hạn miền và mục đích phân biệt
  của màu trong hình nguồn.
- Chỉ tô những miền mà nguồn hoặc nội dung chuyên môn yêu cầu. Không tô thêm miền
  lân cận, phần bù, mặt khuất, hình con khác hoặc vùng không mang cùng ý nghĩa.
- Với hình gồm nhiều hình con, trạng thái tô màu của từng hình con phải độc lập;
  không được sao chép màu từ một hình con sang các hình còn lại.
- Mảng màu phải nằm gọn trong đúng đường biên; không che nét, nhãn, marker, phần
  giao cần quan sát hoặc tràn sang vùng ngoài. Thứ tự vẽ/fill/clip phải bảo toàn
  đường biên nhìn thấy rõ.
- Có thể đổi hue so với sách, nhưng ánh xạ màu–đối tượng–ý nghĩa phải nhất quán.
  Không được dùng màu khác để che việc tô sai miền hoặc tô thừa.
- Summary model ở giai đoạn 1 được đọc toàn bộ PDF packet và là nơi phải tạo
  figure brief về ngữ nghĩa. Brief phải nói rõ hình nguồn nào hỗ trợ block, hình
  con nào cần tham chiếu, đối tượng/quan hệ/nhãn nào phải có, miền nào được tô và
  miền nào tuyệt đối không được tô.
- Nếu một crop hoặc trang chứa nhiều hình con, brief phải chọn rõ hình con đích
  (ví dụ `(a)`, `(b)`) hoặc nói rõ phải tái hiện tất cả. Nếu tái hiện nhiều hình
  con, trạng thái tô/không tô và quan hệ bắt buộc phải được mô tả riêng cho từng
  hình con; không dùng một câu chung mơ hồ cho toàn crop.
- Backend không tự sáng tác lại ý nghĩa hình, không tự đoán miền tô và không tự
  chọn hình con thay cho giai đoạn 1. Backend dùng `sourceReferences` để resolve
  crop OCR phù hợp; nếu không có crop usable thì dùng ảnh toàn trang PDF làm
  fallback, sau đó ghép ảnh với content của đúng block sở hữu và source evidence.
- Lượt chuyên vẽ ở giai đoạn 2 nhận brief đã ghép cùng các crop/ảnh trang tham
  chiếu resolve được theo contract hiện hành. Nếu figure không có nguồn hoặc
  không resolve được asset, lượt vẽ chỉ có text brief và không được giả vờ rằng
  đã nhìn thấy hình sách giáo khoa.

### 2.5. Quy tắc bảng giả thiết–kết luận

- Mỗi example Toán phải trả `isGeometry` để schema phân biệt Hình học với nội
  dung Số học/Đại số/Xác suất/Thống kê; không suy bằng một danh sách từ khóa ở
  backend.
- Mọi example Hình học lớp 7–9 bắt buộc `isGeometry=true` và bắt buộc có
  `geometryStatement` khác null, gồm ít nhất một dòng GT và một dòng KL.
- Hình học lớp 10–12 vẫn trả `isGeometry=true` nhưng bắt buộc
  `geometryStatement=null`; lời giải sử dụng trực tiếp dữ kiện, không dựng bảng
  GT–KL.
- Mọi example không phải Hình học trả `isGeometry=false` và bắt buộc
  `geometryStatement=null`.
- Quy tắc được khóa bằng prompt và output schema theo target grade; mapper chỉ
  lưu bảng GT–KL của đúng Hình học lớp 7–9.

## 3. Thiết kế structured output mới

### 3.1. Cấu trúc để vừa khóa cặp theory–example vừa cho note linh hoạt

Không dùng mảng block phẳng rồi thêm semantic validator. Provider schema tổ chức
mỗi section thành danh sách `items` có thứ tự:

```text
theorySection.items[]
├── UNIT
│   ├── theory: knowledge | theorem | property
│   └── example: example
└── NOTE
    └── note: note
```

Ví dụ output khái niệm:

```json
{
  "items": [
    {
      "itemType": "UNIT",
      "theory": { "type": "knowledge" },
      "example": { "type": "example" }
    },
    {
      "itemType": "NOTE",
      "note": { "type": "note" }
    },
    {
      "itemType": "UNIT",
      "theory": { "type": "theorem" },
      "example": { "type": "example" }
    }
  ]
}
```

Mapper chỉ flatten theo thứ tự:

- `UNIT` → `[theory, example]`;
- `NOTE` → `[note]`.

Nhờ vậy:

- schema bảo đảm cấu trúc cặp, không cần semantic gate mới;
- không thể gom nhiều theory rồi mới gom example;
- note có thể xuất hiện trước, giữa hoặc sau các unit;
- note không thể chen vào giữa theory và example bắt buộc.

### 3.2. Shape của các block mới

`knowledge`, `theorem`, `property` dùng chung shape:

```text
type
title
content
sourcePageNumbers[]
figures[]
```

`example`:

```text
type = example
problem
solution
answer
origin = SOURCE_EXACT | SOURCE_ADAPTED | AI_AUTHORED
sourcePageNumbers[]
geometryStatement
figures[]
```

`note`:

```text
type = note
content
sourcePageNumbers[]
```

Quy tắc provenance:

- `SOURCE_EXACT` và `SOURCE_ADAPTED`: `sourcePageNumbers` có ít nhất một trang.
- `AI_AUTHORED`: `sourcePageNumbers=[]`.
- Theory/note dựa trên nguồn luôn ghi trang packet tương ứng.
- Giữ `sourceEvidence` cấp section để chứng minh heading; provenance cấp block
  được bổ sung chứ không thay thế evidence cấp section.
- Không bắt AI chép đoạn evidence dài ở mỗi block.

### 3.3. Strictness và giới hạn nội dung

- Mọi title/content/problem/solution/answer bắt buộc `minLength >= 1` sau trim.
- Mỗi section có ít nhất một item; toàn bài có ít nhất một theory section và
  section bài tập vận dụng theo contract hiện hành.
- `solution` là string bắt buộc, không nhận `null` cho mọi example được sinh trong
  Summary.
- Nới trần ký tự để schema không ép model rút gọn:
  - theory content: dự kiến tối đa 6.000 ký tự;
  - note content: dự kiến tối đa 3.000 ký tự;
  - problem: dự kiến tối đa 4.000 ký tự;
  - solution: dự kiến tối đa 10.000 ký tự;
  - answer: dự kiến tối đa 3.000 ký tự.
- Các trần trên là giới hạn an toàn, không phải mục tiêu độ dài. Trước khi chốt
  code, đối chiếu fixture các bài đã có để tránh vừa quá hẹp vừa phình output vô
  ích.
- Description của schema nói ngắn gọn đúng trách nhiệm field, không lặp toàn bộ
  system prompt thành một prompt thứ hai.

### 3.4. Figure ID

- Bỏ `localId` khỏi output model.
- Backend tự cấp ID deterministic từ `blockPath + figureIndex` hoặc ID database.
- Figure brief có `visualIntent`, `sourceReferences`, `altText`, `caption`.
- Trách nhiệm từng field trong output giai đoạn 1:
  - `visualIntent`: semantic brief duy nhất. Khi có nguồn, field chỉ định danh
    hình/hình con đích và thông điệp chuyên môn; khi không có nguồn, field tự đủ
    về đối tượng, quan hệ và nhãn cần dựng;
  - `sourceReferences[]`: đúng trang/hình nguồn, giữ thứ tự khi có nhiều ảnh;
  - `altText`/`caption`: nội dung hỗ trợ hiển thị, không được dùng thay cho chỉ
    dẫn dựng hình trong `visualIntent`.
- Khi có ảnh nguồn, không chép lại checklist về nét, mũi tên, marker, màu/tô, vị
  trí hay tỉ lệ vào brief; ảnh là thẩm quyền duy nhất. Với nhiều hình con,
  `visualIntent` chỉ cần định danh rõ phần đích hoặc nói rõ cần tái hiện tất cả.
- Khi không có ảnh nguồn, `visualIntent` nêu đủ nội dung nhìn thấy cần thiết nhưng
  không thêm schema riêng cho từng bài hoặc hard-code màu/tọa độ cụ thể.
- Việc bỏ model-generated ID không thay đổi lifecycle, revision hoặc action hình.

### 3.5. Không có tương thích ngược

- Provider schema, persisted schema và renderer đều không nhận `procedure`.
- Example không nhận `solution=null`; figure plan không nhận local ID kiểu cũ.
- Không tự migrate hoặc chuyển đổi Summary cũ. Bài cũ cần dùng lại phải sinh lại
  theo contract mới.

### 3.6. Hợp đồng chuyển giao brief giữa hai giai đoạn

```text
Giai đoạn 1 — Summary multimodal đọc PDF packet
  -> tạo nội dung 5 loại block
  -> tạo figure plan/brief ngữ nghĩa cho từng figure
     (hình con đích, đối tượng, quan hệ, nhãn, inventory nét liền/khuất-đứt,
      tô/không tô, sourceReferences)
  -> structured-output schema validate shape

Backend
  -> cấp ID/path deterministic
  -> resolve sourceReferences thành OCR crop ưu tiên hoặc ảnh toàn trang fallback
  -> ghép owner block content + source evidence + reference assets
  -> snapshot brief/assets bất biến theo revision

Giai đoạn 2 — Figure generation
  -> nhận brief đã ghép và ảnh tham chiếu nếu resolve được
  -> đối chiếu đồng thời brief và ảnh nguồn
  -> dựng đủ khung hình cơ sở trước đường phụ, không thiếu cạnh/đoạn và giữ đúng
     trạng thái nét liền/khuất-đứt
  -> sinh một snippet LaTeX/TikZ tổng quát, đúng semantic fill và phong cách SGK
  -> compiler/validator/lifecycle hiện hành
```

Ranh giới trách nhiệm:

- Giai đoạn 1 quyết định **vẽ gì và ý nghĩa của từng phần hình**.
- Backend quyết định **lấy đúng asset nguồn nào và đóng gói dữ liệu ra sao**;
  backend không thay thế suy luận chuyên môn của giai đoạn 1.
- Giai đoạn 2 quyết định **biểu diễn brief đó bằng TikZ như thế nào**, nhưng không
  được đổi hình con đích, thêm vùng tô hoặc bỏ quan hệ mà brief đã khóa.
- Nếu brief có nguồn nhưng ảnh tham chiếu chứa nhiều candidate, backend có thể
  gửi tối đa số asset mà resolver hiện hành cho phép; `visualIntent` là chỉ dẫn
  xác định candidate/hình con nào cần dựng.
- Không thêm semantic visual gate hay automatic visual retry vào handoff này.

## 4. Nội dung prompt phải sửa

### 4.1. Bỏ các câu gây rút gọn

- Bỏ hoặc viết lại các câu như “súc tích nhưng đủ ý” nếu chúng khiến model ưu
  tiên rút ngắn hơn trung thực nguồn.
- `concise` chỉ được giảm lặp và câu dẫn dư; không được bỏ định nghĩa, điều kiện,
  công thức, trường hợp, giải thích, phương pháp hoặc bước suy luận có trong nguồn.
- Độ dài của nguồn là tín hiệu mức chi tiết: nguồn trình bày chi tiết thì output
  phải có mức diễn giải tương đương, không biến thành cheat sheet.

### 4.2. Fidelity của knowledge/theorem/property

Prompt yêu cầu giữ đầy đủ theo thứ tự nguồn:

1. Phát biểu/định nghĩa chính.
2. Điều kiện áp dụng và phạm vi.
3. Công thức, ký hiệu và ý nghĩa đại lượng.
4. Các trường hợp hoặc nhánh phương pháp.
5. Phần giải thích, suy luận hoặc các bước thực hiện mà sách dùng để dạy học sinh.
6. Kết luận/cách dùng mà nguồn nêu rõ.

Không được:

- biến một đoạn phương pháp nhiều bước thành một câu;
- chỉ giữ công thức rồi bỏ giải thích;
- bỏ điều kiện hoặc trường hợp đặc biệt;
- thay cách trình bày quen thuộc của sách bằng một phương pháp xa lạ khi nguồn đã
  có cách giải phù hợp.

### 4.3. Fidelity của example và solution

- Example phải minh họa trực tiếp theory cùng `UNIT`, không dùng kiến thức chính
  của unit khác.
- Problem tự đủ dữ kiện, nhưng không tự ý đổi bản chất ví dụ nguồn để dễ viết/vẽ.
- Solution phải bắt đầu thẳng vào lời giải và thể hiện đủ:
  - công thức/quy tắc được chọn;
  - dữ kiện được thay vào;
  - các phép biến đổi hoặc suy luận trung gian;
  - lý do của bước quan trọng;
  - kết luận theo đúng câu hỏi.
- Cấm solution chỉ gồm các câu gợi ý như “thay vào công thức”, “làm tương tự”,
  “suy ra ngay” hoặc “áp dụng định lí trên” mà không thực hiện phần tính/lập luận.
- Nếu sách có lời giải mẫu, ưu tiên thứ tự, kí hiệu, mức xuống dòng và phong cách
  kết luận của sách; được sửa lỗi OCR nhưng không tùy ý đổi phương pháp.
- `answer` chỉ chứa kết quả cuối, không thay thế phần diễn giải trong `solution`.

### 4.4. Nhận diện section tổng quát

- Section theo cấp đề mục lớn thật sự trong bài, dựa trên hierarchy của chính
  tài liệu: typography, numbering, khoảng cách, heading và quan hệ bao chứa.
- Không hard-code “1., 2., 3. luôn là section” hoặc “a), b), c) luôn là unit”.
- Không coi Hoạt động, Ví dụ, Luyện tập, Vận dụng, Chú ý, Nhận xét, caption hình
  hoặc marker trang là theory section.
- Nếu tài liệu không có heading lớn rõ ràng, dùng evidence nội dung có thật; không
  bịa heading nguồn.

### 4.5. Objectives

- Nếu nguồn có “Kiến thức, kĩ năng”, “Mục tiêu”, “Yêu cầu cần đạt” hoặc nhãn có
  cùng chức năng, chỉ chuẩn hóa objectives từ phần đó.
- Nếu nguồn không có phần tương ứng, trả `objectives=null`.
- Không tự thêm mục tiêu giáo dục chung ngoài PDF packet.

## 5. Phạm vi code tối thiểu khi triển khai

### 5.1. Prompt và provider response schema — owner chính

- `apps/api/src/modules/ai/utils/lesson-summary-prompt.ts`
  - thay taxonomy và hướng dẫn nhận diện;
  - gộp procedure vào knowledge;
  - thêm fidelity, solution và source-figure rules;
  - bỏ global geometry figure requirement trái quyết định mới;
  - bump prompt version.
- `apps/api/src/modules/ai/types/lesson-summary.types.ts`
  - thay provider schema thành ordered items `UNIT | NOTE`;
  - xóa procedure khỏi provider contract;
  - bắt solution, provenance và strictness mới;
  - làm rõ description của figure plan để giai đoạn 1 bắt buộc mô tả hình con,
    đối tượng/quan hệ và semantic fill trong các field tổng quát hiện có;
  - bỏ model-generated figure localId;
  - bump schema version.

### 5.2. Adapter bắt buộc để schema mới chạy

- `apps/api/src/modules/ai/utils/lesson-summary-mapper.ts`
  - flatten `UNIT | NOTE` đúng thứ tự;
  - map provenance/origin đúng dữ liệu model;
  - không hard-code mọi example thành `AI_AUTHORED`;
  - cấp/chuẩn bị figure ID deterministic phía backend.
- `apps/api/src/workers/services/lesson-summary-generation.service.ts`
  - nhận figure plan từ giai đoạn 1, resolve reference assets và dựng generation
    brief cho giai đoạn 2;
  - giữ nguyên ưu tiên OCR crop, fallback ảnh toàn trang và snapshot reference;
  - không tự bổ sung semantic bị thiếu hoặc tự đoán hình con/miền tô;
  - không đổi retry hoặc lifecycle.
- `apps/api/src/modules/stem-figures/utils/stem-figure-generation-brief.ts`
  - chuyển nguyên `visualIntent`, `sourceReferences` từ giai đoạn 1 và chỉ enrich
    bằng đúng owner block, source evidence/assets;
  - không làm mất chỉ dẫn riêng cho từng hình con khi serialize brief.
- `apps/api/src/modules/stem-figures/services/figure-reference-resolver.service.ts`
  - dùng brief để xếp hạng crop đúng hình/trang;
  - giữ full-page fallback khi không có crop usable;
  - không dùng ranking kỹ thuật để viết lại ý nghĩa chuyên môn của hình.
- `apps/api/src/modules/stem-figures/services/stem-figure-repair.service.ts` và
  prompt chuyên vẽ:
  - giai đoạn 2 phải ưu tiên brief + ảnh nguồn, đặc biệt với hình nhiều hình con
    và semantic fill;
  - compile repair vẫn chỉ sửa lỗi compiler theo contract cũ.
- Shared/API/web types và renderer liên quan:
  - hỗ trợ theorem/property nhất quán;
  - xóa toàn bộ nhánh procedure/extended block cũ;
  - không redesign UI ngoài việc chỉ hiển thị đúng năm block mới.

### 5.3. Tài liệu phải đồng bộ trong lượt implementation

- `docs/06-ai-rag-spec.md`.
- `docs/implementation/M9.md` phần `M9.2` và Done criteria.
- `docs/api/learning-paths-lessons.md` nếu content JSON contract public/admin đổi.
- `docs/02-user-flows.md` nếu mô tả thứ tự block/figure hiện hành cần sửa.
- `.codex/context/current-context.md` và code index nếu entrypoint đổi.
- Không tạo task code mới; giữ `M9.2`.

## 6. Những việc không làm trong lần sửa này

- Không thêm semantic visual gate hoặc một pipeline đánh giá AI mới.
- Không hard-code Bài 13, Bài 14, Bài 15, tên lesson, figure ID hoặc số liệu cụ thể.
- Không khôi phục sourceTopics/sourceCandidates/hint parser.
- Không thay raw OpenAI file payload: adapter hiện đã upload PDF, dùng `file_id`
  và hỗ trợ `input_file.detail=high` đúng SDK.
- Không tự tăng max output lên 24K/32K nếu chưa có bằng chứng output bị cắt.
- Không đổi model mặc định chỉ dựa trên cảm nhận; model được benchmark riêng.
- Không thay đổi chính sách dữ liệu ngoài luồng hiện hành: chỉ gửi các OCR
  crop/ảnh trang được backend resolve từ đúng `sourceReferences`; không gửi cả
  tài liệu hoặc asset không liên quan sang lượt chuyên vẽ.
- Không đổi database schema nếu content JSON hiện tại chứa được field mới.
- Không sửa retry, xóa/thay/sinh lại hình hoặc trạng thái figure.

## 7. Cơ chế retry phải giữ nguyên

- Chỉ tự động retry khi compiler báo lỗi biên dịch.
- Số lần retry dùng đúng giới hạn hiện hành.
- Mỗi lần retry phải gửi toàn bộ compiler errors của lượt compile đó cho OpenAI
  sửa; không chỉ gửi lỗi đầu tiên.
- Không tự retry vì:
  - hình chưa đẹp hoặc chưa giống nguồn;
  - prompt/schema validation;
  - nội dung ngắn hoặc sai taxonomy;
  - timeout/network/provider error ngoài contract hiện hành;
  - cảnh báo visual hoặc đánh giá bằng mắt.
- Candidate mới chỉ thay asset cũ sau khi compile/validate kỹ thuật thành công;
  các action hình giữ nguyên luồng cũ.

## 8. Kế hoạch triển khai theo phase

### Phase 0 — Khóa baseline không tốn phí

- Snapshot prompt và JSON Schema hiện tại từ preview.
- Lưu fixture đại diện cho:
  - khung có nhãn độc lập “Định lí”;
  - câu dẫn có ý nghĩa định lí nhưng không có nhãn độc lập;
  - tính chất có câu dẫn;
  - khung vàng không có tín hiệu loại rõ;
  - note ở đầu/giữa/cuối;
  - hình hỗ trợ ở phía trước, phía sau và hình không liên quan;
  - phương pháp nhiều bước;
  - lời giải nguồn chi tiết.
- Fixture chỉ là regression case; rule production luôn tổng quát.

### Phase 1 — Viết lại prompt

- Thay taxonomy và invariant nhận diện semantic.
- Chỉ phân loại theorem/property khi có semantic cue từ nhãn/câu dẫn bên ngoài
  phát biểu; bảng điều kiện/tiêu chuẩn/quy tắc/phương pháp xét không có cue phải
  là knowledge, dù nội dung là công thức quan trọng hoặc chuỗi tương đương.
- Thêm cấu trúc `UNIT | NOTE` và trách nhiệm từng block.
- Thêm fidelity cho kiến thức/phương pháp/lời giải.
- Bảo toàn bố cục toán học của nguồn: `\Leftrightarrow`, hệ ngoặc nhóm, bullet,
  dấu `:` trước danh sách/display và xuống dòng có chủ đích; không văn xuôi hóa.
- Thay figure coverage toàn bài bằng quan hệ hình–block ở trước hoặc sau.
- Thêm semantic fill invariant: đúng miền, không tô thừa, không tràn và không
  lan trạng thái màu giữa các hình con.
- Thêm complete-stroke invariant: kiểm kê đủ cạnh/đoạn, vai trò và trạng thái
  nhìn thấy-liền hoặc khuất-đứt; không suy rằng một nét không cần vẽ chỉ vì đã có
  đầu mút, nhãn, cung góc hay đường phụ.
- Trước khi viết output, lập inventory mọi hình/crop nguồn và gắn với block được
  hỗ trợ; sau khi viết đối chiếu lại toàn bộ inventory, không được trả mọi
  `figures=[]` khi nguồn có hình liên quan trực tiếp.
- Yêu cầu giai đoạn 1 tạo brief tự đủ: chọn rõ hình con đích, mô tả riêng từng
  hình con cần dựng, vùng tô/không tô và mọi quan hệ bắt buộc.
- Ground objectives và section hierarchy.
- Loại instruction trùng hoặc gây rút gọn.

### Phase 2 — Thay structured output schema

- Tạo ordered items `UNIT | NOTE`.
- Xóa procedure khỏi provider union.
- Bắt buộc solution string không rỗng.
- Thêm block-level provenance và example origin.
- Làm chặt description của `visualIntent` và `sourceReferences` để structured
  output giai đoạn 1 mang đủ ngữ nghĩa cho lượt chuyên vẽ, không thêm checklist
  song song hoặc field riêng theo từng bài.
- Bỏ localId khỏi figure output.
- Nới field ceilings có kiểm soát và bump schema version.

### Phase 3 — Mapper và contract mới

- Flatten ordered items thành block list cho API/UI hiện có.
- Map origin/source pages chính xác.
- Cấp figure ID deterministic.
- Resolve OCR crop/ảnh toàn trang từ `sourceReferences`, enrich brief và giữ
  snapshot reference bất biến.
- Kiểm chứng backend chuyển nguyên chỉ dẫn hình con và semantic fill từ giai đoạn
  1, không tự diễn giải lại.
- Không giữ legacy reader/schema/renderer; Summary cũ phải sinh lại.
- Xác nhận raw provider adapter không bị thay đổi ngoài schema/prompt.

### Phase 4 — Củng cố prompt chuyên vẽ ở giai đoạn 2

- Yêu cầu model đọc đồng thời brief và ảnh nguồn; brief khóa semantic, ảnh nguồn
  khóa bố cục/phong cách/biên trực quan.
- Nếu crop có nhiều hình con, chỉ dựng hình con được brief chọn; nếu brief yêu
  cầu tất cả thì giữ trạng thái tô riêng của từng hình con.
- Không tự thêm fill để trang trí, không tô đồng loạt các hình con và không suy
  rộng màu từ một panel sang panel khác.
- Dựng đủ khung hình cơ sở trước đường phụ; mỗi cạnh/đoạn có path tường minh và
  đúng trạng thái nét liền/nét khuất đứt theo ảnh nguồn cùng ngữ nghĩa che khuất.
- Với sơ đồ chuyển động, tách quỹ đạo không đầu tên khỏi vectơ hướng; nhãn điểm
  đầu, điểm cuối và nhãn vectơ có vùng riêng, không chồng hoặc nhân đôi vai trò.
- Giữ source TikZ tổng quát và tự audit cú pháp để tối ưu first-compile; không
  thêm template hoặc nhánh đặc biệt cho bài live.
- Không thay đổi compiler retry: lỗi thị giác không được tự động gọi lại AI.

### Phase 5 — Test local và docs

- Cập nhật docs source-of-truth M9.2.
- Chạy unit/schema/mapper/prompt tests.
- Chạy fake-provider integration từ preview → enqueue → worker mapping.
- Chạy shared/API/web typecheck, targeted lint/build và `git diff --check`.
- Restart worker sau khi sửa code worker/background job.

### Phase 6 — Live test có kiểm soát

- Chỉ chạy khi local gates pass.
- Trước lượt trả phí, đọc usage hiện có, tính ngân sách còn lại và báo phạm vi +
  upper-bound VND; không chạy lặp nếu cache/artifact hợp lệ đủ kiểm chứng.
- Ưu tiên theo thứ tự:
  1. Bài 15 Toán 12 để kiểm độ đầy đủ của kiến thức/phương pháp/lời giải.
  2. Một bài Hình học Toán 12 có hình nguồn trước/sau block để kiểm figure
     grounding và first-compile.
  3. Một bài Đại số Toán 7 trong khóa/buổi học có sẵn để kiểm tính tổng quát khác
     lớp, khác dạng bài.
- Dùng course và lesson đang có; không tạo dữ liệu khóa học mới nếu không cần.
- Không tự paid retry cho lỗi nội dung/schema/visual.

### Phase 7 — Đánh giá bằng mắt và bàn giao

- Chụp ảnh màn hình source PDF và toàn bộ Summary sinh ra ở cùng phạm vi nội dung.
- Chụp UI admin/student ở desktop và mobile cho block/figure đại diện.
- Đối chiếu thủ công từng section, block, example và figure.
- Ghi artifact audit có pass/fail, bằng chứng trang và lý do; không chỉ kết luận
  chung “trông ổn”.

## 9. Ma trận test bắt buộc

### 9.1. Prompt contract

- Có đúng năm loại block mới; không còn mô tả provider `procedure`.
- Có câu nói rõ method/procedure source phải vào `knowledge`.
- Có nhận diện theorem/property theo nghĩa của câu dẫn, không chỉ exact label.
- Ví dụ “Ta thừa nhận định lí sau” chỉ xuất hiện như minh họa, không thành keyword
  whitelist.
- Có quy tắc yellow box là vùng candidate, không phải classifier duy nhất.
- Có figure rule kiểm tra cả phía trước và phía sau, không dùng từ “liền kề”.
- Không có global “mọi block hình học bắt buộc có hình”.
- Có quy tắc tô đúng miền/đối tượng, không tô thừa, không tràn qua biên và xử lý
  độc lập từng hình con; màu được phép khác nhưng semantics phải giữ nguyên.
- Có câu bắt buộc giai đoạn 1 tạo brief, chọn rõ hình con đích và mô tả trạng thái
  tô/không tô riêng khi crop chứa nhiều hình.
- Có fidelity và cấm hint-only solution.
- Không chứa rule riêng cho tên bài/khối cụ thể.

### 9.2. Schema

- Accept `knowledge`, `theorem`, `property`, `example`, `note` đúng shape.
- Reject provider output có `procedure`.
- Mỗi `UNIT` bắt buộc có một theory và một example.
- `NOTE` có thể nằm trước, giữa hoặc sau các `UNIT`.
- Reject example có `solution=null`, rỗng hoặc thiếu.
- SOURCE_EXACT/SOURCE_ADAPTED cần trang nguồn; AI_AUTHORED không giả trang nguồn.
- Figure không cần localId từ model.
- Note không bị bắt có figures.
- Figure plan có field tổng quát đủ để ghi hình con đích, quan hệ, miền tô và
  miền cấm tô mà không hard-code schema theo bài.

### 9.3. Mapper và persisted contract

- Flatten luôn tạo `[theory, example]` liền nhau.
- Note giữ đúng vị trí tương đối trong items.
- Origin không còn bị hard-code `AI_AUTHORED`.
- Figure ID không trùng giữa các block.
- Persisted schema và renderer từ chối procedure/extended block cũ.

### 9.4. Figure pipeline regression

- Giai đoạn 1 trả nguyên brief ngữ nghĩa; backend không tự tạo thêm miền tô hoặc
  tự chọn một hình con khác.
- Source figure ở trước block → figure plan có source reference đúng.
- Source figure ở sau block → figure plan có source reference đúng.
- Hình gần đó nhưng không hỗ trợ block → không bị gắn nhầm.
- `sourceReferences` resolve được OCR crop thì giai đoạn 2 nhận crop; không có crop
  usable thì nhận ảnh toàn trang fallback; không có asset thì chỉ nhận text brief.
- Crop nhiều hình con nhưng block chỉ cần một hình → brief định danh hình con đích
  và giai đoạn 2 không dựng nhầm các hình còn lại.
- Crop nhiều hình con và cần dựng tất cả → brief có trạng thái tô/không tô riêng
  cho từng hình con, backend chuyển nguyên sang giai đoạn 2.
- Không có hình nguồn → cả `figures=[]` và hình AI-authored hợp lý đều hợp lệ.
- Fixture miền tô một phần → chỉ đúng miền đó được tô, các miền còn lại không tô.
- Fixture nhiều hình con → mỗi hình con giữ đúng trạng thái tô riêng, không bị
  tô đồng loạt hoặc lấy nhầm màu của hình con khác.
- Fixture có miền chung/đường biên cong → fill không tràn ra ngoài, không che nét
  biên, nhãn hoặc marker cần quan sát.
- Fixture nguồn không tô màu → worker không tự thêm mảng màu mang ý nghĩa giả.
- First compile đo trên raw output trước mọi repair.
- Compiler retry fixture chứng minh toàn bộ lỗi của lượt compile được gửi lên.
- Lỗi ngoài compiler không phát sinh automatic retry.

### 9.5. Content fidelity

- Mọi định nghĩa, điều kiện, công thức, trường hợp và phương pháp quan trọng của
  source pages đều có trong block tương ứng.
- Không có knowledge/method block bị rút thành một câu khi nguồn trình bày nhiều
  bước.
- Mọi example có lời giải hoàn chỉnh, không có hint-only solution.
- Mọi dữ kiện dùng trong solution/answer xuất hiện trong problem hoặc figure
  nguồn tương ứng.
- Phong cách lập luận, ký hiệu, xuống dòng và kết luận gần với sách giáo khoa.

## 10. Rubric đánh giá live bằng mắt

Mỗi bài được chấm riêng theo bảng sau:

| Tiêu chí          | Điều kiện đạt                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bao phủ kiến thức | Không thiếu định nghĩa, điều kiện, công thức, phương pháp hoặc trường hợp quan trọng trong phạm vi trang                                                |
| Phân loại block   | Theorem/property đúng semantic cue; không dùng knowledge để né nhãn rõ                                                                                  |
| Cấu trúc          | 100% theory có example ngay sau; note nằm ở vị trí bổ trợ hợp lý                                                                                        |
| Độ chi tiết       | Knowledge và solution có mức diễn giải tương đương nguồn, không thành outline/hint                                                                      |
| Phong cách SGK    | Thuật ngữ, ký hiệu, thứ tự suy luận, xuống dòng và kết luận phù hợp cấp lớp                                                                             |
| Figure coverage   | 100% block có hình nguồn trực tiếp hỗ trợ đều có figure; không ép hình cho block không cần                                                              |
| Tương đồng hình   | Bố cục, đối tượng, quan hệ, tỉ lệ tương đối và nhãn rất phù hợp với hình nguồn; màu được phép khác hợp lý                                               |
| Tô màu            | Đúng miền/đối tượng và đúng từng hình con; không tô thừa, không tràn qua biên, không che nét/nhãn/marker; hue có thể khác nếu ánh xạ ý nghĩa giữ nguyên |
| Bố cục UI         | Block dễ đọc, title/content/solution không dồn, hình không tràn hoặc che nội dung                                                                       |
| Compile           | Mục tiêu raw first-compile sát 100%; báo riêng numerator/denominator và không tính repair vào raw pass                                                  |

Mỗi failure phải ghi:

- lesson/section/block/figure;
- trang nguồn;
- ảnh source và ảnh output;
- lỗi thuộc prompt, schema, mapper hay figure worker;
- invariant tổng quát dùng để sửa, không ghi patch riêng cho case.

## 11. Acceptance gates cuối

- 0 block `procedure` trong mọi output mới.
- 100% `knowledge/theorem/property` có đúng `example` ngay sau khi flatten.
- Note xuất hiện hợp lý ở ít nhất ba vị trí before/between/after trong fixture và
  không bị schema ép cuối bài.
- 100% semantic cue rõ cho theorem/property được phân loại đúng trong live audit.
- 100% example có solution không rỗng và không có hint-only solution trong bộ
  acceptance.
- 100% source-supported figures trong mẫu audit có figure plan đúng block và
  source reference đúng trang.
- 100% crop nhiều hình con trong mẫu audit có brief xác định rõ hình con đích hoặc
  trạng thái riêng của tất cả hình con cần dựng; giai đoạn 2 bám đúng lựa chọn đó.
- 0 figure thừa chỉ vì bài được gắn nhãn hình học.
- 0 hình tô sai miền, tô thừa sang phần/hình con khác hoặc tô tràn qua đường biên
  trong bộ live visual audit.
- Raw first-compile đạt mục tiêu sát 100%, ưu tiên 100%; mọi repair được báo riêng.
- Retry compiler và lifecycle ảnh giữ nguyên, test hồi quy pass.
- Shared/API/web typecheck, focused test, lint/build phù hợp và diff check pass.
- Screenshot + visual audit của ba bài live được lưu thành artifact.
- Tổng chi phí không vượt ngân sách owner đã duyệt sau khi trừ usage đã phát sinh.

## 12. Rủi ro và cách kiểm soát

| Rủi ro                                             | Cách kiểm soát trong phạm vi prompt/schema                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Model coi mọi khung vàng là knowledge              | Ưu tiên semantic cue theorem/property và test nhiều cách diễn đạt                                                      |
| Model rút gọn vì style concise                     | Quy định concise chỉ bỏ lặp, không bỏ nội dung sư phạm bắt buộc                                                        |
| Schema item wrapper làm output dài hơn             | Giữ wrapper tối thiểu và descriptions ngắn                                                                             |
| Provenance sai                                     | Yêu cầu page numbers khách quan; audit bằng source packet, không fuzzy hợp thức hóa                                    |
| Figure ở gần nhưng thuộc nội dung khác             | Prompt yêu cầu chứng minh quan hệ ngữ nghĩa/cross-reference trước khi gắn                                              |
| Brief giai đoạn 1 mơ hồ khi crop có nhiều hình con | Schema description buộc định danh hình con đích hoặc mô tả riêng từng hình; backend chỉ chuyển tiếp, không tự đoán     |
| Backend resolve đúng trang nhưng sai crop          | Rank bằng figure label + visual intent + essential elements, giữ candidate/snapshot và fallback ảnh trang để đối chiếu |
| Hình compile được nhưng tô sai/thừa/tràn           | Prompt và figure brief khóa semantic fill; local visual audit đối chiếu source; không biến lỗi visual thành auto retry |
| Tăng field ceiling làm output tốn token            | Ceiling chỉ là trần; theo dõi actual output tokens trước khi đổi route limit                                           |
| Summary cũ không còn hợp schema                    | Không có compatibility path; snapshot khi cần đối chiếu rồi sinh lại theo contract mới                                 |
| Prompt tốt nhưng model vẫn variance                | Benchmark cùng fixture/model config; không thêm gate mới trước khi có bằng chứng                                       |

## 13. Rollout và rollback

- Bump prompt version và schema version cùng lượt deploy.
- Preview và worker phải dùng cùng version/snapshot; job version cũ không chạy với
  mapper mới.
- Deploy API và worker đồng bộ, sau đó restart worker.
- Smoke bằng fake provider trước, rồi mới live paid provider.
- Summary cũ không tự regenerate để tránh chi phí và thay đổi nội dung ngoài ý
  muốn.
- Rollback theo cặp prompt/schema/mapper version; không giữ dual provider schema
  cho procedure.

## 14. Checklist triển khai

- [x] Owner duyệt kế hoạch.
- [x] Khóa baseline fixtures và prompt/schema snapshot.
- [x] Sửa system/user prompt tổng quát.
- [x] Sửa provider response schema `UNIT | NOTE`.
- [x] Xóa procedure khỏi provider/persisted schema/renderer và gộp method vào knowledge.
- [x] Bắt solution chi tiết, không nullable.
- [x] Thêm block provenance và example origin.
- [x] Backend cấp figure ID.
- [x] Bổ sung semantic fill + target-subfigure rules vào output brief của giai
      đoạn 1.
- [x] Bảo toàn brief khi backend resolve crop/ảnh trang và enrich cho giai đoạn 2.
- [x] Củng cố prompt giai đoạn 2 để bám brief + ảnh nguồn, không tự thêm/tô nhầm
      hình con.
- [x] Thêm inventory nét vẽ tổng quát để không thiếu cạnh/đoạn và giữ đúng nét
      liền/nét khuất đứt.
- [x] Buộc prompt/schema kiểm kê toàn bộ hình nguồn trước khi quyết định
      `figures[]`, sau live failure trả rỗng toàn bộ.
- [x] Sửa mapper theo contract mới; không có compatibility path.
- [x] Đồng bộ docs M9.2.
- [x] Chạy local tests/typecheck/lint/build; `diff --check` chạy ở gate cuối.
- [x] Restart worker.
- [x] Báo chi phí dự kiến và ngân sách còn lại trước live test.
- [ ] Live test Bài 15 Toán 12.
- [ ] Live test một bài Hình học Toán 12.
- [ ] Live test một bài Đại số Toán 7.
- [ ] Chụp screenshot và hoàn tất visual audit.
- [ ] Báo raw first-compile, retry, content fidelity và chi phí thực tế.

## 15. Lệnh triển khai đề xuất sau khi owner duyệt

```text
/task-full M9.2 triển khai .codex/plans/m9-2-five-block-taxonomy-source-fidelity-plan.md
```

Không coi việc tạo file kế hoạch hoặc auto-approve trong IDE là lệnh triển khai.
Chỉ bắt đầu sửa production code sau khi owner xác nhận rõ.
