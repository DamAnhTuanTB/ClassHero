# DANH SÁCH BLOCK ĐỘNG CHO BẢN TÓM TẮT BÀI HỌC

## 1. Nguyên tắc sử dụng

- Các **đề mục lớn** của bản tóm tắt phải bám theo các đề mục lớn trong sách giáo khoa.
- Bên trong mỗi đề mục lớn, AI được tự chọn các block phù hợp từ danh sách cho phép.
- AI không bắt buộc sử dụng tất cả block.
- Không dùng block chỉ để lấp đầy cấu trúc.
- Không lặp lại cùng một kiến thức ở nhiều block khác nhau.
- Mỗi block nên lưu `sourceChunkIds` để truy vết nội dung OCR nguồn.
- Tạm thời không sử dụng block hình minh họa do AI trả về.

---

## 2. Các block cốt lõi

### 2.1. `key_knowledge` — Kiến thức trọng tâm

Dùng để tổng hợp các ý quan trọng học sinh cần ghi nhớ trong một đề mục.

```json
{
  "type": "key_knowledge",
  "title": "Kiến thức cần nhớ",
  "points": [
    "Ý kiến thức thứ nhất",
    "Ý kiến thức thứ hai"
  ],
  "sourceChunkIds": [
    "chunk-001"
  ]
}
```

**Nên dùng khi:**

- Một đề mục có nhiều ý chính cần hệ thống lại.
- Nội dung không phù hợp để tách riêng hoàn toàn thành định nghĩa, công thức hoặc quy tắc.
- Cần giúp học sinh ôn nhanh.

---

### 2.2. `definition` — Khái niệm hoặc định nghĩa

Dùng khi tài liệu giới thiệu thuật ngữ, đại lượng hoặc khái niệm mới.

```json
{
  "type": "definition",
  "title": "Khái niệm số hữu tỉ",
  "term": "Số hữu tỉ",
  "definition": "Số hữu tỉ là số viết được dưới dạng phân số...",
  "explanation": "Giải thích ngắn gọn, dễ hiểu cho học sinh.",
  "sourceChunkIds": [
    "chunk-001"
  ]
}
```

**Phù hợp với:**

- Khái niệm Toán học.
- Đại lượng Vật lí.
- Khái niệm, chất hoặc hiện tượng Hóa học.
- Thuật ngữ mới trong bài.

---

### 2.3. `rule` — Quy tắc

Dùng để trình bày quy tắc tính toán hoặc quy tắc thao tác.

```json
{
  "type": "rule",
  "title": "Quy tắc cộng hai số hữu tỉ",
  "statement": "Muốn cộng hai số hữu tỉ...",
  "steps": [
    "Viết các số dưới dạng phân số.",
    "Thực hiện phép cộng phân số."
  ],
  "conditions": [
    "Mẫu số phải khác 0."
  ],
  "sourceChunkIds": [
    "chunk-002"
  ]
}
```

**Ví dụ sử dụng:**

- Quy tắc cộng, trừ, nhân, chia.
- Quy tắc chuyển vế.
- Quy tắc dấu ngoặc.
- Quy tắc đổi đơn vị.
- Quy tắc hóa trị.

---

### 2.4. `formula` — Công thức hoặc hệ thức

Dùng khi bài học có công thức, hệ thức hoặc ký hiệu quan trọng cần ghi nhớ.

```json
{
  "type": "formula",
  "title": "Công thức cần nhớ",
  "formulas": [
    {
      "latex": "a + (-a) = 0",
      "explanation": "Tổng của hai số đối nhau bằng 0.",
      "conditions": []
    }
  ],
  "sourceChunkIds": [
    "chunk-002"
  ]
}
```

**Phù hợp với:**

- Công thức Toán học.
- Công thức Vật lí.
- Hệ thức hình học.
- Công thức và phương trình Hóa học.
- Ký hiệu quan trọng.

---

### 2.5. `property` — Tính chất

Dùng để trình bày một tính chất hoặc mối quan hệ quan trọng.

```json
{
  "type": "property",
  "title": "Tính chất bắc cầu",
  "statement": "Nếu a < b và b < c thì a < c.",
  "explanation": "Có thể dùng một số trung gian để so sánh hai số.",
  "sourceChunkIds": [
    "chunk-003"
  ]
}
```

**Ví dụ sử dụng:**

- Tính chất giao hoán, kết hợp.
- Tính chất hai góc đối đỉnh.
- Tính chất hai đường thẳng song song.
- Tính chất của chất hoặc hiện tượng.

---

### 2.6. `procedure` — Quy trình thực hiện

Dùng khi học sinh cần thực hiện theo một chuỗi bước cụ thể.

```json
{
  "type": "procedure",
  "title": "Cách biểu diễn số hữu tỉ trên trục số",
  "purpose": "Xác định điểm biểu diễn của một số hữu tỉ.",
  "steps": [
    {
      "order": 1,
      "content": "Viết số hữu tỉ dưới dạng phân số.",
      "latex": null
    },
    {
      "order": 2,
      "content": "Chia đoạn đơn vị theo mẫu số.",
      "latex": null
    }
  ],
  "sourceChunkIds": [
    "chunk-001",
    "chunk-002"
  ]
}
```

**Phù hợp với:**

- Quy trình giải một dạng toán.
- Cách vẽ hoặc dựng hình.
- Cách tiến hành thí nghiệm.
- Cách cân bằng phương trình Hóa học.
- Cách đổi đơn vị.

**Phân biệt với `rule`:**

- `rule`: nêu quy tắc tổng quát.
- `procedure`: trình bày từng bước thao tác cụ thể.

---

### 2.7. `example` — Ví dụ minh họa

Dùng khi context có ví dụ đủ rõ để AI tóm tắt lại.

```json
{
  "type": "example",
  "title": "Ví dụ nhận biết số hữu tỉ",
  "problem": "Chứng minh 0,6 là số hữu tỉ.",
  "solutionSteps": [
    {
      "order": 1,
      "explanation": "Viết số thập phân dưới dạng phân số.",
      "latex": "0,6 = \\frac{6}{10} = \\frac{3}{5}"
    }
  ],
  "answer": "0,6 là số hữu tỉ.",
  "sourceChunkIds": [
    "chunk-001"
  ]
}
```

**Quy tắc sử dụng:**

- Chỉ dùng khi ví dụ có trong context.
- Không tự sáng tác số liệu mới.
- Không đưa quá nhiều ví dụ trùng dạng.
- Ưu tiên ví dụ đại diện cho phương pháp.

---

### 2.8. `note` — Chú ý hoặc nhận xét

Dùng cho nội dung bổ sung quan trọng nhưng không phải một kiến thức chính độc lập.

```json
{
  "type": "note",
  "title": "Chú ý",
  "content": "Số 0 không là số hữu tỉ dương và cũng không là số hữu tỉ âm.",
  "sourceChunkIds": [
    "chunk-003"
  ]
}
```

**Có thể chứa:**

- Điều kiện đặc biệt.
- Trường hợp ngoại lệ.
- Mẹo thực hiện.
- Nhận xét trong sách.
- Cách làm ngắn hơn.

---

### 2.9. `common_mistake` — Lỗi thường gặp

Dùng khi context có căn cứ rõ ràng để xác định lỗi học sinh dễ mắc.

```json
{
  "type": "common_mistake",
  "title": "Nhầm vị trí số âm trên trục số",
  "mistake": "Cho rằng số âm có giá trị tuyệt đối lớn hơn nằm bên phải.",
  "correction": "Trên trục số, số bé hơn luôn nằm bên trái.",
  "sourceChunkIds": [
    "chunk-003"
  ]
}
```

**Quy tắc sử dụng:**

- Chỉ dùng khi có căn cứ từ chú ý, nhận xét, lời giải hoặc cách trình bày trong context.
- Không tự bịa lỗi phổ biến.
- Nên đặt trong đúng đề mục chứa kiến thức liên quan.

---

## 3. Các block cho định lí và lập luận

### 3.1. `theorem` — Định lí

Dùng khi sách trình bày một định lí.

```json
{
  "type": "theorem",
  "title": "Tổng ba góc trong một tam giác",
  "statement": "Tổng ba góc trong một tam giác bằng 180°.",
  "hypotheses": [
    "ABC là một tam giác."
  ],
  "conclusion": "\\widehat{A} + \\widehat{B} + \\widehat{C} = 180^\\circ",
  "sourceChunkIds": [
    "chunk-010"
  ]
}
```

**Nên tách rõ:**

- Phát biểu.
- Giả thiết.
- Kết luận.

---

### 3.2. `proof` — Chứng minh hoặc lập luận

Dùng khi context có phần chứng minh, suy luận hoặc giải thích.

```json
{
  "type": "proof",
  "title": "Chứng minh định lí",
  "given": [
    "ABC là một tam giác."
  ],
  "goal": "Chứng minh tổng ba góc bằng 180°.",
  "idea": "Kẻ đường thẳng qua A song song với BC.",
  "steps": [
    {
      "order": 1,
      "statement": "Kẻ đường thẳng xy qua A và song song với BC.",
      "reason": "Dùng tính chất hai đường thẳng song song."
    }
  ],
  "conclusion": "Tổng ba góc của tam giác ABC bằng 180°.",
  "sourceChunkIds": [
    "chunk-010"
  ]
}
```

**Phù hợp với:**

- Chứng minh hình học.
- Chứng minh định lí.
- Suy luận ra công thức.
- Giải thích một tính chất.

---

## 4. Các block tổ chức và hệ thống hóa kiến thức

### 4.1. `comparison` — So sánh hoặc phân biệt

Dùng khi cần phân biệt hai hoặc nhiều khái niệm dễ nhầm.

```json
{
  "type": "comparison",
  "title": "Phân biệt số hữu tỉ âm và số hữu tỉ dương",
  "columns": [
    "Tiêu chí",
    "Số hữu tỉ âm",
    "Số hữu tỉ dương"
  ],
  "rows": [
    [
      "Vị trí trên trục số",
      "Nằm trước O",
      "Nằm sau O"
    ]
  ],
  "sourceChunkIds": [
    "chunk-003"
  ]
}
```

**Phù hợp với:**

- Phân biệt khái niệm.
- So sánh trường hợp.
- Hệ thống dấu hiệu nhận biết.
- Đối chiếu các công thức.

---

### 4.2. `data_table` — Bảng dữ liệu hoặc bảng tổng hợp

Dùng khi tài liệu có bảng dữ liệu cần giữ lại hoặc khi nội dung phù hợp để hệ thống hóa thành bảng.

```json
{
  "type": "data_table",
  "title": "Phân loại chỉ số WHtR",
  "columns": [
    "Mức độ",
    "Khoảng giá trị"
  ],
  "rows": [
    [
      "Tốt",
      "0,42 < WHtR \\le 0,52"
    ]
  ],
  "note": null,
  "sourceChunkIds": [
    "chunk-001"
  ]
}
```

**Phân biệt với `comparison`:**

- `comparison`: dùng để phân biệt các khái niệm hoặc trường hợp.
- `data_table`: dùng để trình bày dữ liệu hoặc hệ thống hóa thông tin.

---

### 4.3. `application` — Vận dụng hoặc liên hệ thực tế

Dùng khi tài liệu có tình huống thực tế đáng giữ lại trong bản tóm tắt.

```json
{
  "type": "application",
  "title": "Ứng dụng chỉ số WHtR",
  "context": "Chỉ số WHtR được tính từ vòng bụng và chiều cao.",
  "knowledgeUsed": [
    "Tỉ số",
    "So sánh số hữu tỉ"
  ],
  "explanation": "Dùng giá trị WHtR để đối chiếu với bảng phân loại.",
  "sourceChunkIds": [
    "chunk-001"
  ]
}
```

**Quy tắc sử dụng:**

- Không đưa mọi bài tập vận dụng vào tóm tắt.
- Chỉ giữ tình huống giúp học sinh hiểu ý nghĩa kiến thức.
- Không tự bổ sung dữ kiện ngoài context.

---

### 4.4. `section_recap` — Ghi nhớ đề mục

Dùng ở cuối một đề mục lớn để tổng hợp nhanh nội dung đã học.

```json
{
  "type": "section_recap",
  "title": "Ghi nhớ",
  "points": [
    "Số hữu tỉ viết được dưới dạng phân số a/b với b khác 0.",
    "Mỗi số hữu tỉ có một số đối."
  ],
  "sourceChunkIds": [
    "chunk-001",
    "chunk-002"
  ]
}
```

**Lưu ý:**

- Không bắt buộc dùng cho mọi section.
- Chỉ nên dùng khi section dài hoặc có nhiều kiến thức.
- Tránh lặp lại hoàn toàn nội dung của `key_knowledge`.

---

## 5. Danh sách block chính thức

```ts
type LessonSummaryBlockType =
  | "key_knowledge"
  | "definition"
  | "rule"
  | "formula"
  | "property"
  | "procedure"
  | "example"
  | "note"
  | "common_mistake"
  | "theorem"
  | "proof"
  | "comparison"
  | "data_table"
  | "application"
  | "section_recap";
```

Tổng cộng: **15 block động**.

Block `figure_reference` đã được loại bỏ khỏi danh sách này.

---

## 6. Bộ block đề xuất cho MVP

### Nhóm nên triển khai trước

```ts
const MVP_BLOCK_TYPES = [
  "key_knowledge",
  "definition",
  "rule",
  "formula",
  "property",
  "procedure",
  "example",
  "note",
  "common_mistake",
  "theorem",
  "proof"
] as const;
```

### Nhóm có thể bổ sung sau

```ts
const EXTENDED_BLOCK_TYPES = [
  "comparison",
  "data_table",
  "application",
  "section_recap"
] as const;
```

---

## 7. Cấu trúc cấp bài học và đề mục

Các nội dung sau không phải block động:

```json
{
  "lessonId": "math-7-lesson-1",
  "title": "Bài 1. Tập hợp các số hữu tỉ",
  "objectives": [],
  "sections": [],
  "warnings": []
}
```

Mỗi đề mục lớn có cấu trúc:

```json
{
  "order": 1,
  "sourceHeading": "Tên đề mục nhận diện từ OCR",
  "displayHeading": "Tên đề mục đã chuẩn hóa",
  "sourceChunkIds": [
    "chunk-001"
  ],
  "blocks": []
}
```

Nguyên tắc chung:

> Đề mục lớn được lấy từ sách giáo khoa. Block được lựa chọn theo bản chất nội dung bên trong từng đề mục. AI không bắt buộc sử dụng toàn bộ block được cung cấp.
