# Kế hoạch M9.2 - Phủ 90-100% dạng hình Toán 3-9

## 1. Mục tiêu và ranh giới

Mục tiêu của lượt nâng cấp này là biến phần vẽ hình của lesson summary từ một
schema primitive tổng quát thành một hệ thống có danh mục dạng hình, bộ dựng hình
deterministic và tiêu chí đo coverage rõ ràng cho chương trình Toán 3-9 bộ Kết
nối tri thức với cuộc sống.

- Kiểm kê `100%` bài/mục trong SGK và SBT chính thống có yêu cầu hình minh họa,
  mô hình, bảng, biểu đồ, trục số, hệ tọa độ hoặc sơ đồ.
- Giai đoạn này chỉ cam kết các mức `SIMPLE`, `MEDIUM`, `HARD`; tạm loại
  `VERY_COMPLEX` khỏi mẫu số coverage triển khai.
- Mục tiêu chính: hỗ trợ và nghiệm thu ít nhất `95%` ô dạng-hình × biến-thể trong
  phạm vi; ngưỡng chấp nhận tối thiểu là `90%`, stretch goal là `98-100%`.
- Toàn bộ phạm vi được triển khai trong **một delivery wave của M9.2**. Các họ
  hình không được tách thành nhiều lần giao sản phẩm hoặc chờ nghiệm thu riêng;
  chỉ phát hành khi cổng tích hợp chung của cả wave đạt.
- Không hiểu `100% coverage` là mọi đề toán tùy ý đều sinh đúng ở lần đầu. Nó là
  tỷ lệ trên inventory đã định danh, có fixture và tiêu chí nghiệm thu.
- Không dùng số lượng screenshot làm coverage vì một dạng hình có thể được chụp
  lặp trên nhiều viewport/theme. Baseline hiện có 39 case ID đại diện chỉ là bộ
  hồi quy ban đầu, chưa phải mẫu số chính thức.

Không thuộc phạm vi giai đoạn này:

- Hình động hoặc thao tác dựng hình nhiều trạng thái cần timeline.
- Truy vết/tái tạo tùy ý một hình scan phức tạp từ ảnh nguồn.
- Hình không gian có thiết diện dày đặc, nhiều mặt khuất hoặc chứng minh nâng cao
  vượt chương trình phổ thông đã chọn.
- Sơ đồ có hơn 32 nhãn ngữ nghĩa, hơn 5 cụm đối tượng phụ thuộc nhau hoặc không
  thể đọc rõ trong một SVG tĩnh trên điện thoại.
- Raw SVG/script do model trả về và image-generation provider.

### Trạng thái triển khai ngày 2026-08-10

- Baseline trước wave đã được commit tại `7f561b15`.
- Prompt/schema hiện tại: `lesson-summary-prompt-v54` /
  `lesson-summary-schema-v40`.
- Control plane có 50 ô inventory thuộc đủ tám family, 50/50 ô có compiler và
  golden local đạt; 86 fixture semantic đã qua 100/100 visual test, tạo 688 ảnh
  locator-only và 32 contact sheet trên bốn thiết bị × hai theme.
- Gate A đã duyệt 44 ví dụ lẻ, 352 ảnh và 24 contact sheet; Playwright đạt 8/8
  cấu hình. Chi phí đã commit `18.863 VNĐ`.
- Gate B đã duyệt 21 bài thật Toán 3-9, 152 block hình, 1.216 ảnh và 21 contact
  sheet; Playwright đạt 8/8 cấu hình. Chi phí Gate B tăng thêm `112.985 VNĐ`,
  tổng wave `131.848 VNĐ`. Compiler fingerprint cuối là
  `1a1c46ddd9865a7b`; lượt biên dịch/chụp cuối dùng cache, không phát sinh paid
  call mới.
- Tổng bộ đã duyệt gồm 2.256 ảnh và 77 contact sheet. Bộ ảnh cũ được chuyển phục
  hồi sang `anh-chup-hinh-toan-can-sua/`; ảnh đạt chuẩn mới khớp đầu ra test cuối.
- Source catalog đã có chương trình Bộ GDĐT và đủ 14 tập SGK Toán 3-9; page audit
  hiện xác minh exact page cho 19/50 ô. Báo cáo cuối ghi 39/50 ô có live evidence,
  11/50 ô đủ ba gate local + live + exact-page, nhưng vẫn giữ `0 SUPPORTED` và
  `releaseStatus=IN_PROGRESS` cho đến khi W1 khóa đủ inventory/SBT và các ô live
  còn thiếu được nghiệm thu; không dùng số fixture/screenshot để overclaim coverage.
- Mọi ảnh ở commit/thư mục đạt chuẩn cũ là golden candidate. Chỉ ảnh có review
  record source-backed mới được bảo vệ; candidate còn lỗi phải demote linh hoạt.

## 2. Cách phân loại độ khó

| Mức | Quy tắc phân loại thực dụng |
| --- | --- |
| `SIMPLE` | Một hệ hình/đối tượng chính, không quá 2 quan hệ ngữ nghĩa, không quá 12 nhãn có nghĩa. |
| `MEDIUM` | 2-3 đối tượng tương tác hoặc một hệ tọa độ/bảng dữ liệu, không quá 5 quan hệ phụ thuộc, không quá 24 nhãn. |
| `HARD` | Hình tĩnh nhiều bước nhưng không quá 5 cụm đối tượng, không quá 32 nhãn, không quá 2 đường tròn hoặc 2 hệ quy chiếu. |
| `VERY_COMPLEX` | Vượt một trong các ngưỡng trên, cần hoạt ảnh/nhiều trạng thái, hoặc mật độ khiến hình không thể đọc đáng tin cậy trên mobile. |

Mức khó được gắn theo độ phức tạp của **hình phải dựng**, không lấy nguyên nhãn độ
khó của câu hỏi. Một bài suy luận khó nhưng chỉ cần tam giác đơn giản vẫn có thể
là `SIMPLE` hoặc `MEDIUM` đối với engine vẽ hình.

## 3. Mẫu số coverage và inventory chính thống

Tạo manifest versioned, ví dụ
`apps/api/test/fixtures/math-diagram-curriculum-inventory.json`, với mỗi mục:

- lớp, tập, chương, bài, trang và loại nguồn `SGK|SBT`;
- mô tả ngắn yêu cầu trực quan, không sao chép dài nội dung có bản quyền;
- `family`, `archetype`, `semanticVariant`, `difficulty`;
- dữ kiện bắt buộc, quan hệ cần kiểm chứng và annotation phải xuất hiện;
- trạng thái `SUPPORTED|PARTIAL|UNSUPPORTED|VERY_COMPLEX_EXCLUDED`;
- fixture/golden case dùng để nghiệm thu và lý do nếu bị loại.

Quy trình tạo mẫu số:

1. Lập danh mục tất cả mục cần hình từ nguồn chính thống.
2. Chuẩn hóa các bài tương đương thành ô
   `family + archetype + semanticVariant + difficulty`.
3. Hai bài chỉ dùng chung một ô khi primitive, quan hệ toán học, chiến lược bố trí
   nhãn và validator giống nhau; đổi số đơn thuần không tạo ô mới.
4. Mọi mục nguồn phải map được tới một ô hoặc có lý do loại rõ ràng.
5. Khóa inventory theo version trước khi công bố phần trăm coverage.

Các chỉ số công bố:

```text
inventory_classification = classified_source_items / all_source_items
supported_coverage = passed_supported_cells / eligible_cells
family_coverage = passed_cells_in_family / eligible_cells_in_family
```

`eligible_cells` chỉ gồm `SIMPLE|MEDIUM|HARD`; danh sách
`VERY_COMPLEX_EXCLUDED` vẫn phải công khai trong báo cáo để không che coverage.

## 4. Ma trận họ dạng hình cần phủ

### A. Nền tảng tiểu học và mô hình trực quan

- Tia số/trục số tự nhiên, số thập phân và phân số; thước đo, nhiệt kế, timeline.
- Mô hình mảng, nhóm bằng nhau, sơ đồ thanh một/nhiều phần, so sánh hơn-kém,
  mô hình phân số diện tích/độ dài.
- Bảng hàng-cột, bảng giá trị đơn giản, lịch và đồng hồ có vạch/chấm tâm.
- Chu vi, diện tích, hình ghép/lưới ô vuông, hình chữ L, bản đồ/đường đi/tỉ lệ.

### B. Trục số và mặt phẳng tọa độ

- Điểm trên trục số, khoảng/đoạn/nửa khoảng, đầu mút đóng-mở.
- Điểm trên Oxy, đường dóng tọa độ, đối xứng/tịnh tiến và khoảng cách.
- Miền nghiệm đơn giản trên trục số hoặc mặt phẳng; biên nét liền/nét đứt.

### C. Đại số và đồ thị

- Hàm tỉ lệ thuận/nghịch, đường thẳng, hệ hai đường thẳng và giao điểm.
- Parabol, giao đường thẳng-parabol, nghiệm/giao trục/đỉnh/trục đối xứng.
- Đồ thị đoạn thẳng theo bảng giá trị, bài chuyển động và quan hệ thực tế.
- Điểm dựng bắt buộc có tên ngắn và đường dóng; điểm lấy mẫu làm mượt phải ẩn.

### D. Bảng, thống kê và xác suất

- Bảng số liệu/tần số/tần số tương đối; bảng hai chiều và bảng giá trị hàm.
- Biểu đồ tranh, cột/cột kép, đoạn thẳng, quạt tròn, histogram.
- Không gian mẫu dạng bảng, cây xác suất/sơ đồ cây và các sơ đồ đếm hữu hạn.

### E. Hình học phẳng nền tảng

- Điểm, đoạn, đường, tia, góc; song song, vuông góc, cắt tuyến.
- Tam giác và tứ giác; đa giác đều, đường tròn, cung, dây, bán kính, đường kính.
- Trung điểm, trung trực, trung tuyến, đường cao, phân giác, đường trung bình.
- Đối xứng trục/tâm, phép biến đổi đơn giản, bằng nhau và đồng dạng.

### F. Hình học phẳng mức khó

- Thales, tam giác đồng dạng, hệ thức lượng trong tam giác vuông và lượng giác.
- Tiếp tuyến, dây cung, góc nội tiếp/ở tâm, tứ giác nội tiếp, đường tròn nội/ngoại
  tiếp, hai dây cắt nhau và các cấu hình đường tròn tối đa hai đường tròn.
- Bài khoảng cách/chiều cao, thang-tường, bóng nắng, bản đồ và dựng hình tĩnh.

### G. Hình không gian và bài toán ứng dụng

- Lập phương, hộp chữ nhật, lăng trụ, chóp, trụ, nón, cầu ở mức SGK tĩnh.
- Hình khai triển, kích thước cạnh/chiều cao/bán kính, diện tích và thể tích.
- Mặt khuất chỉ dùng nét đứt khi có giá trị đọc hình; nhãn kích thước neo đúng cạnh.

### H. Tập hợp và sơ đồ

- Venn 1-3 tập, tập con/phần giao/phần bù, tập vũ trụ.
- Flow/tree/network và sơ đồ tình huống thực tế hữu hạn có ý nghĩa toán học.

## 5. Kiến trúc đích

Không tiếp tục yêu cầu model tự nghĩ toàn bộ tọa độ cho các họ hình phổ biến.
Luồng đích:

```text
đề bài + ngữ cảnh nguồn
        ↓
diagramIntent có ngữ nghĩa
        ↓
template/compiler theo family + archetype
        ↓
semantic validators
        ↓
label/layout solver
        ↓
diagramSpec v2 hiện có
        ↓
safe deterministic SVG renderer
```

### 5.1. `diagramIntent`

Provider chỉ mô tả ý định có cấu trúc:

- họ hình/archetype và viewport ưu tiên;
- entity toán học: điểm, đoạn, đường tròn, hàm, bảng, series dữ liệu;
- quan hệ: thuộc, thẳng hàng, vuông góc, song song, bằng nhau, tiếp xúc, đồng dạng;
- số đo/đơn vị, annotation cần hiện và annotation phải ẩn;
- vai trò điểm: đỉnh, tâm, điểm dựng, điểm lấy mẫu, giao điểm, chân đường cao.

Các intent phổ biến dùng discriminated union hẹp. Không dùng một object tùy ý có
hàng chục field optional hoặc raw primitive làm contract chính với provider.

### 5.2. Compiler/template registry

- Mỗi archetype có compiler versioned, ví dụ `coordinate.points.v1`,
  `function.quadratic.v1`, `geometry.right-triangle.v1`.
- Compiler tính tọa độ từ dữ kiện, chọn miền nhìn, bước chia trục, điểm dựng và
  primitive; model không được tự chọn tùy tiện các chi tiết này.
- Output cuối vẫn là `diagramSpec` v2 để không phá API/database/renderer đang có.
- Spec raw hiện tại chỉ là fallback cho archetype chưa có compiler và luôn giữ
  trạng thái `NEEDS_REVIEW`.
- Ghi compiler/template version vào diagnostics/log của generation; delivery wave
  hiện tại không đổi public API.

### 5.3. Semantic validator bắt buộc

Bổ sung validator theo family, ngoài invariant vuông góc/bằng nhau/song song đang
có:

- incidence, collinearity, point-on-segment/line/circle;
- midpoint, division ratio, intersection, concurrency;
- radius/chord/tangent, cyclicity, angle/bisector;
- similarity/congruence ratios, polygon không tự cắt;
- điểm thuộc hàm, giao đồ thị, nghiệm và symmetry của parabol;
- scale/tick/axis mapping và đường dóng tọa độ;
- bảng/biểu đồ khớp dữ liệu và tổng tỷ lệ;
- dimension/unit neo đúng cạnh, bán kính hoặc chiều cao.

Lỗi invariant làm compiler/mapper reject fixture trước khi render. Cảnh báo trình
bày không được dùng để che lỗi toán học.

### 5.4. Label/layout solver dùng chung

- Tạo candidate theo loại nhãn: point, vertex, center, side length, angle, axis,
  function, region, set và caption.
- Ưu tiên vùng trống gần anchor nhất; tối ưu đồng thời khoảng cách tới anchor,
  va chạm text-text, text-stroke, text-marker và biên viewport.
- Đổi hướng trước khi tăng khoảng cách. Dùng offset có giới hạn; leader line chỉ
  là phương án cuối và chỉ ở họ hình cho phép theo quy ước SGK.
- Đo bounding box trên kích thước SVG thật. Tên điểm trên mobile tối thiểu khoảng
  `10px`; không text nào được đè nét hoặc bị cắt.
- Cùng input, compiler version và viewport phải tạo cùng layout để golden test ổn định.

## 6. Mô hình triển khai một delivery wave

Toàn bộ công việc dưới đây thuộc **một task M9.2 duy nhất**, dùng chung một
integration branch, một inventory, một quality dashboard và một release gate.
Không phát hành riêng từng family. Workstream được làm đồng thời khi độc lập và
merge liên tục vào integration branch; dependency chỉ quyết định thứ tự merge,
không tạo thêm giai đoạn sản phẩm.

### W1 - Curriculum inventory và coverage control plane

- Lập manifest chính thống, taxonomy và danh sách loại `VERY_COMPLEX`.
- Map 39 case ID hiện có và toàn bộ case mới vào inventory.
- Lập reference catalog SGK/SBT/SGV/tài liệu tập huấn chính thống và kiểm định lại
  bộ ảnh đạt chuẩn hiện có trước khi cho phép dùng làm golden nội bộ.
- Tạo coverage reporter theo family, variant, difficulty, viewport và theme.
- Khóa denominator versioned; mọi thay đổi inventory phải hiện diff coverage.

### W2 - Intent/schema/compiler foundation

- Tạo discriminated `diagramIntent`, compiler registry/context và diagnostics.
- Viết adapter từ compiler output sang persisted `diagramSpec` v2.
- Giữ fallback raw spec có kiểm soát; không đổi endpoint/public response.
- Cung cấp shared geometry/data primitives để W3-W6 triển khai song song.

### W3 - Elementary, number line, table và chart engines

- Array, tape, fraction, measurement, clock, perimeter/area/composite shape.
- Number line, interval, table, pictogram, bar/double-bar, line, pie, histogram.
- Table/chart validator bảo đảm dữ liệu, tỷ lệ và căn chỉnh đúng.

### W4 - Coordinate và graph engines

- Axis/range/tick compiler, coordinate projection và transformation.
- Line, proportional/inverse, system, quadratic, inequality và applied graph.
- Point-construction policy, sampling policy và function/data validators.

### W5 - Plane geometry engines

- Basic primitives, triangle/quadrilateral/polygon, parallel-transversal.
- Congruence, similarity, notable lines, Thales và right-triangle relations.
- Circle/chord/tangent/cyclic/incircle cùng semantic validators tương ứng.

### W6 - Spatial, applied và schematic engines

- Solids, nets, visible/hidden edges, dimension/radius/height anchors.
- Ladder/height/scale/map và applied static constructions.
- Venn, probability tree, flow/network và finite real-world schematics.

### W7 - Global label/layout và responsive renderer

- Solver nhãn dùng chung cho mọi family, không vá vị trí theo từng ảnh.
- Mobile-first density profile, actual SVG text measurement và bounded offset.
- Light/dark, viewport adaptation, collision audit và backward compatibility.

W7 bắt đầu ngay với W2 trên primitives nền; mỗi compiler W3-W6 phải tích hợp
candidate/anchor contract của W7, không đợi đến cuối mới sửa nhãn.

### W8 - Test matrix, live matrix và release control

- Unit/property tests chạy cùng lúc với compiler/validator tương ứng.
- PR smoke khoảng 60 case; full suite dự kiến 250-400 ô/biến thể.
- Render mobile Chromium, mobile WebKit, iPad và laptop, cả light/dark.
- Shadow comparison với raw spec cũ, feature flag và rollback path.
- Tách ảnh đạt chuẩn/ảnh lỗi; giáo viên review thủ công từng case dựa trên
  reference catalog, không duyệt chỉ bằng cảm giác hoặc overlap detector.

W8 nhận fixture ngay khi W1 định danh một ô và không chờ toàn bộ compiler hoàn
thành mới bắt đầu test.

### Luồng tích hợp trong cùng wave

```text
W1 inventory ────────────────┐
                            ├─→ W8 coverage + golden + live matrix
W2 schema/compiler core ─┬───┤
                        ├─→ W3 elementary/data ─┐
                        ├─→ W4 coordinate/graph ├─→ integration branch
                        ├─→ W5 plane geometry ──┤
                        └─→ W6 spatial/schematic┘
W7 label/layout ────────────────────────────────┘
```

### Một release gate duy nhất

Chỉ bật compiler mới trong production khi đồng thời đạt tất cả điều kiện:

1. Inventory phân loại `100%` mục nguồn và công khai mọi excluded case.
2. Supported coverage toàn cục `>=95%` hoặc owner chấp nhận ngưỡng thực tế nhưng
   tuyệt đối không dưới `90%`.
3. Không family được công bố supported nào dưới `90%`.
4. Toàn bộ compiler/semantic invariant/schema/typecheck pass.
5. Golden cross-device/light-dark pass `100%` với các ô supported.
6. Không text bị cắt hoặc đè nét trong bộ golden đã duyệt.
7. Live sample đạt SLO theo độ khó, không phát sinh provider repair call.
8. Bài cũ pass backward-compatibility; rollback flag đã được diễn tập.

Nếu một workstream chưa đạt, toàn wave tiếp tục ở trạng thái development/shadow;
không release phần đã xong như một phiên bản feature riêng.

## 7. Chỉ tiêu chất lượng

| Chỉ tiêu | SIMPLE | MEDIUM | HARD |
| --- | ---: | ---: | ---: |
| Geometry/data invariant pass từ compiler | >= 99% | >= 97% | >= 93% |
| Live provider ra intent hợp lệ ở lần đầu | >= 95% | >= 90% | >= 85% |
| Không crash/schema-invalid khi render spec đã compile | 100% | 100% | 100% |
| Golden cross-device đã hỗ trợ | 100% | 100% | 100% |

Toàn bộ golden case còn phải đạt:

- `0` text bị cắt;
- `0` text đè nét/marker hoặc text khác;
- nhãn ở vùng trống gần anchor, đúng phía và đọc được trên mobile;
- trục/tick/scale, điểm dựng và annotation đúng quy ước của family;
- light/dark không mất contrast;
- không sinh primitive/marker không có ý nghĩa toán học.

Live provider metric đo khả năng hiểu đề; compiler metric đo tính đúng đắn của hệ
thống. Live output hợp lệ vẫn giữ `NEEDS_REVIEW`; không dùng SLO để bỏ bước duyệt.

## 8. Chiến lược test và chi phí

### 8.1. Nguyên tắc

- Local compiler, validator, fixture, property test, render và screenshot không
  gọi provider trả phí; chỉ bước lấy `diagramIntent`/lesson output mới tính phí.
- Cache mọi live result theo model snapshot + reasoning + prompt/contract version
  + fixture ID. Sửa compiler/renderer/layout phải tái sử dụng output đã cache.
- Model live chính là `gpt-5.4` vì các lượt M9.2 trước cho kết quả ổn định hơn
  `gpt-4.1` và `gpt-5.6-luna`; không trộn model trong coverage score chính.
- Không thêm repair/judge call tự động. Paid retry chỉ dùng khi root cause nằm ở
  intent do model trả về, không dùng để chữa lỗi compiler/renderer.
- Mọi paid call đi qua reservation/hard-stop M9.12. Hết ngân sách thì dừng trước
  provider call, giữ artifact đã có và xin owner cấp thêm; không tự vượt trần.

### 8.2. Cơ sở tính giá

Bảng giá kế hoạch chốt ngày `2026-08-10`, theo
[OpenAI GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4):

- input: `$2.50 / 1M token`;
- cached input: `$0.25 / 1M token`;
- output: `$15.00 / 1M token`;
- tỷ giá kế hoạch: `25.500 VNĐ/USD`, khớp snapshot đang dùng trong repo.

Công thức estimate cho từng request:

```text
estimatedVnd = ceil((
  uncachedInputTokens × 2.50
  + cachedInputTokens × 0.25
  + outputTokens × 15.00
) / 1_000_000 × 25_500)
```

Upper bound dưới đây không trừ prompt caching, nên chi phí thực tế thường thấp hơn:

| Profile | Token reserve | Upper bound/request |
| --- | ---: | ---: |
| Diagram-only | 12.000 input + 4.000 output | 2.295 VNĐ |
| Bài thật/full lesson | 16.000 input + 16.000 output | 7.140 VNĐ |

Test phải khóa `maxOutputTokens` đúng profile. Nếu preview cho thấy input/output
reserve lớn hơn, phải tính lại bảng và xin owner xác nhận trước khi gọi.

### 8.3. Ma trận request và ngân sách

| Nhóm live test | Số request | Đơn giá tối đa | Thành tiền tối đa |
| --- | ---: | ---: | ---: |
| Calibration: 1 ca cho mỗi trong 8 family | 8 diagram-only | 2.295 VNĐ | 18.360 VNĐ |
| Coverage lõi: 8 family × 3 mức khó | 24 diagram-only | 2.295 VNĐ | 55.080 VNĐ |
| Edge/regression: nhãn dày, trục, đường tròn, không gian | 12 diagram-only | 2.295 VNĐ | 27.540 VNĐ |
| Luồng thật: lớp 3-9 × 3 mức khó | 21 full lesson | 7.140 VNĐ | 149.940 VNĐ |
| **Tổng lượt chính** | **65 request** |  | **250.920 VNĐ** |
| Retry có điều kiện: tối đa 10 diagram-only + 5 full lesson | tối đa 15 request |  | 58.650 VNĐ |
| **Upper bound toàn live matrix** | **tối đa 80 request** |  | **309.570 VNĐ** |

Hard cap đề xuất là **320.000 VNĐ** cho toàn delivery wave. Chênh `10.430 VNĐ`
chỉ là phần làm tròn/dao động token; không được biến thành request ngoài matrix.
Không khấu trừ các ngân sách owner đã cấp cho lượt test cũ nếu chưa đối soát được
usage event; trước khi chạy phải dùng preview/reservation để xác nhận số dư thật.

Hai mươi mốt bài thật được chọn theo ma trận:

- mỗi lớp từ 3 đến 9 có đúng 3 bài thuộc `SIMPLE`, `MEDIUM`, `HARD`;
- ba bài trong cùng lớp phải thuộc các lesson khác nhau, không đổi số để giả lập
  thành bài mới;
- toàn bộ tập phải phủ mỗi trong 8 family ít nhất 2 lần; một lesson có thể đóng góp
  nhiều family nếu thực sự có nhiều loại block hình;
- ưu tiên lesson có nhiều block lý thuyết/ví dụ để kiểm cả tính nhất quán trong một
  lần sinh đầy đủ, không chỉ khả năng vẽ một hình độc lập;
- không chọn `VERY_COMPLEX`; nếu thiếu nguồn thật của một lớp phải báo thiếu thay
  vì thay bằng prompt tự đặt rồi vẫn tính là full lesson.

### 8.3.1. Thứ tự live test bắt buộc

Live matrix chạy theo hai cổng chi phí, dù vẫn thuộc cùng một delivery wave:

**Gate A — ví dụ lẻ trước:**

1. Chạy 8 case calibration, chụp/review/sửa xong toàn bộ.
2. Chạy 24 case coverage lõi, chụp/review/sửa xong toàn bộ.
3. Chạy 12 case edge/regression, chụp/review/sửa xong toàn bộ.
4. Tối đa 10 paid retry chỉ cho `PROVIDER_INTENT`; mọi lỗi local re-render từ cache.

Gate A gồm 44 request chính, upper bound `100.980 VNĐ`; cộng retry pool tối đa
`22.950 VNĐ`, cổng ngân sách làm tròn là **125.000 VNĐ**. Không được bắt đầu bất
kỳ full lesson nào cho đến khi:

- cả 44 case có review record;
- mọi case supported đạt semantic validator và visual checklist;
- không còn lỗi hệ thống chưa sửa có khả năng lặp lại trong full lesson;
- regression suite của các lỗi đã phát hiện đều pass.

**Gate B — bài thật sau:**

1. Chạy 21 full lesson theo từng lớp, mỗi lớp ba mức khó.
2. Sau từng lesson, chụp và review riêng mọi block hình trước khi đóng case.
3. Tối đa 5 paid retry full lesson, chỉ cho `PROVIDER_INTENT`.

Gate B có upper bound `149.940 VNĐ`; cộng retry pool `35.700 VNĐ`, phần hard cap
còn lại là **195.000 VNĐ**. Tổng Gate A + Gate B vẫn không vượt **320.000 VNĐ**.
Nếu Gate A không đạt thì Gate B chưa được phép tiêu ngân sách, dù code các
workstream khác đã hoàn thành.

### 8.4. Quy trình bắt buộc sau từng live test

Mỗi request chỉ được đóng case sau chu trình:

```text
paid live output
→ lưu raw response + usage/cost
→ render component thật
→ chụp screenshot 4 viewport × 2 theme
→ tự đánh giá thủ công bằng checklist
→ PASS hoặc tạo defect có root cause
→ sửa rule/compiler/validator/layout
→ render lại output cache + chụp lại
→ chỉ paid retry nếu intent của model thật sự sai
```

Viewport tối thiểu cho **mỗi** live output:

- Chromium Mobile `390×844`;
- WebKit Mobile `390×844`;
- iPad `820×1180`;
- laptop `1440×900`;
- mỗi viewport có light và dark, tức tối thiểu 8 screenshot/case; với full lesson
  phải chụp từng block hình, không chỉ chụp một ảnh toàn trang quá nhỏ.

Checklist đánh giá thủ công:

1. Nội dung hình đúng đề, dữ kiện và quan hệ toán học.
2. Primitive/marker đúng quy ước SGK, không có nét hoặc ký hiệu vô nghĩa.
3. Nhãn đúng đối tượng, ở vùng trống gần nhất, không đè nét/marker/text.
4. Trục, tick, tỷ lệ, điểm dựng, đường dóng và đơn vị đầy đủ/chính xác.
5. Không cắt hình/chữ; kích thước đọc được, ưu tiên mobile.
6. Light/dark đủ tương phản và không đổi ý nghĩa hình.

### 8.4.1. Đối chiếu nguồn chính thống khi review ảnh

Mỗi screenshot chỉ được đánh dấu đạt khi có reference record. Thứ tự ưu tiên:

1. Trang/figure chính xác trong SGK hoặc SBT Kết nối tri thức đã gắn với lesson.
2. Bản điện tử SGK/SBT/SGV cùng lớp, tập và bài từ cổng chính thức của NXB Giáo
   dục Việt Nam.
3. Golden nội bộ cùng archetype đã được tái kiểm chứng và có source record ở mức
   1 hoặc 2; tên thư mục `đạt chuẩn` tự nó không phải bằng chứng.
4. Tài liệu bồi dưỡng giáo viên, kế hoạch bài dạy và slide chính thức của NXB.
5. Tài liệu của Bộ GDĐT, NXB hoặc cơ sở giáo dục chính thống khác để kiểm tra quy
   ước chung. Blog/video/ảnh tìm kiếm không rõ nguồn chỉ dùng để tìm manh mối,
   không đủ làm căn cứ PASS.

Nguồn trực tuyến khởi tạo reference catalog gồm:

- [Chương trình GDPT của Bộ GDĐT](https://moet.gov.vn/content/vanban/Lists/VBPQ/Attachments/1483/vbhn-chuong-trinh-tong-the.pdf);
- [Toán 3, tập một — cổng tập huấn NXBGDVN](https://taphuan.nxbgd.vn/tap-huan/chi-tiet-sach/toan-3-tap-mot-940103475.940103475);
- [Toán 7, tập một — cổng tập huấn NXBGDVN](https://taphuan.nxbgd.vn/tap-huan/chi-tiet-sach/toan-7-tap-mot-939878831.939878831);
- [Toán 8, tập một — cổng tập huấn NXBGDVN](https://taphuan.nxbgd.vn/tap-huan/chi-tiet-sach/toan-8-tap-mot-940047193.940047193);
- [Toán 9, tập một — cổng tập huấn NXBGDVN](https://taphuan.nxbgd.vn/tap-huan/chi-tiet-sach/toan-9-tap-mot-939944841.939944841).

Cổng NXBGDVN được dùng để điều hướng tới SGK điện tử, SGV, SBT/VBT mẫu, tài liệu
giới thiệu và tài liệu tập huấn. W1 phải bổ sung đủ lớp 3-9, cả hai tập và ngày
truy cập vào catalog; danh sách trên chỉ là seed, không phải danh mục hoàn tất.

Reference manifest tối thiểu gồm:

```text
referenceId, sourceKind, publisher, series, grade, volume,
lesson, page, figure, url, accessedAt, localArtifactHash,
comparisonClaims, copyrightUse=REVIEW_ONLY, status
```

Review record của mỗi hình gồm:

```text
fixtureId, screenshotPaths, referenceIds,
comparisonMode=EXACT_FIGURE|SAME_ARCHETYPE|CONVENTION_ONLY,
semanticDifferences, notationDifferences, layoutDifferences,
responsiveAdaptations, decision, reviewerNotes
```

Quy tắc quyết định:

- `FULL_LESSON`: mỗi block hình phải đối chiếu trang/bài chính xác của tài liệu
  lesson; nếu model tạo ví dụ mới thì dùng source cùng archetype trong đúng lớp.
- `DIAGRAM_ONLY`: tối thiểu có một reference SGK/SBT/SGV chính thống cùng
  archetype. Case `HARD` cần thêm một SGV/tài liệu tập huấn hoặc golden nội bộ đã
  source-backed để kiểm chéo quy ước.
- Tính đúng toán học/dữ kiện của đề đứng trên việc giống pixel. Không sao chép một
  hình SGK sai tỉ lệ vào output nếu quan hệ toán yêu cầu tỉ lệ khác.
- Mobile được phép đổi khoảng trắng, hướng đặt nhãn hoặc xếp cụm để đọc rõ, nhưng
  phải ghi `responsiveAdaptations` và giữ nguyên incidence, thứ tự điểm, marker,
  số đo và ý nghĩa sư phạm.
- Chỉ các decision `PASS_EXACT` hoặc `PASS_RESPONSIVE_ADAPTATION` mới được vào bộ
  đạt chuẩn. Thiếu nguồn dùng `NEEDS_SOURCE`, không được tự nâng thành PASS.
- Không trace/copy ảnh SGK vào sản phẩm. Nguồn/crop chỉ phục vụ review nội bộ;
  không commit hoặc phát hành nguyên trang tài liệu có bản quyền nếu chưa có quyền.

### 8.4.2. Biến ảnh đạt chuẩn hiện có thành golden nội bộ

Trước Gate A, W1/W8 phải rà soát lại toàn bộ
`anh-chup-hinh-toan-dat-chuan/`:

1. Gom các ảnh nhiều device/theme của cùng một case thành một golden group.
2. Map group vào inventory archetype và ít nhất một reference chính thống.
3. Chạy lại semantic validator/overlap/crop checks và review bằng mắt theo mục
   8.4.1; mọi feedback cũ chưa giải quyết làm group fail ngay.
4. Ảnh fail chuyển khỏi thư mục đạt chuẩn sang `anh-chup-hinh-toan-can-sua/`.
5. Ảnh pass được ghi vào `reference-golden-manifest.json` với immutable golden ID,
   reference IDs, convention claims và ngày review.

Golden nội bộ sau đó được dùng để so layout, khoảng nhãn, marker, typography và
responsive cho ảnh mới cùng archetype. Golden không thay thế semantic validator,
không được dùng để hợp thức hóa dữ kiện khác và phải bị demote nếu sau này phát
hiện sai hoặc nguồn chính thức được cập nhật.

### 8.5. Vòng sửa lỗi và quản lý ảnh

- Commit nền `7f561b15` là mốc non-regression của đợt triển khai này. Trước khi
  chấp nhận bất kỳ thay đổi compiler/layout/renderer nào, phải render lại các
  golden group đã được tái kiểm chứng từ mốc đó trên Chromium mobile, WebKit
  mobile, iPad và laptop. Case mới pass nhưng làm một golden cũ xấu đi vẫn bị coi
  là fail và không được merge/promote.
- Lỗi được phân loại `PROVIDER_INTENT`, `COMPILER`, `SEMANTIC_VALIDATOR`,
  `LABEL_LAYOUT`, `RENDERER` hoặc `RESPONSIVE_THEME`.
- Mỗi lỗi phải tạo regression fixture trước hoặc cùng lúc với bản sửa; không vá
  riêng ID/coordinate của đúng ảnh vừa lỗi.
- Lỗi local được sửa rồi render/chụp lại không giới hạn số lần vì chi phí provider
  bằng `0`. Không được gọi lại AI chỉ để có một hình ngẫu nhiên khác đẹp hơn.
- Lỗi `PROVIDER_INTENT` được retry tối đa một lần/case và toàn wave không vượt
  retry pool 15 request. Nếu vẫn lỗi, sửa schema/prompt hoặc đánh `UNSUPPORTED`;
  muốn gọi thêm phải có ngân sách mới được owner xác nhận.
- Không ghi đè ảnh cũ. Tên file gồm fixture, model snapshot, iteration, viewport,
  theme và trạng thái để đối chiếu before/after.
- Ảnh đang chờ review nằm trong `tmp/.../pending`; ảnh fail chuyển vào
  `anh-chup-hinh-toan-can-sua/`. Chỉ ảnh đã PASS checklist mới được chuyển vào
  `anh-chup-hinh-toan-dat-chuan/{dien-thoai-chromium,dien-thoai-webkit,ipad,laptop}`.
- Sau từng request ghi review record gồm screenshot paths, lỗi tìm thấy, bản sửa,
  kết quả re-render, reference IDs, input/cached/output token và chi phí USD/VNĐ.

### 8.6. Cổng chi phí trước khi chạy

Trước live matrix, Codex phải báo owner:

- model snapshot/reasoning, số request còn lại;
- token reserve và upper-bound VNĐ của batch kế tiếp;
- số tiền đã dùng, đang reservation và còn lại trong hard cap 320.000 VNĐ;
- số cache hit, paid call, retry đã dùng và screenshot còn phải review.

Calibration chạy tối đa 8 request trước. Từng kết quả vẫn được chụp/review ngay;
nếu xuất hiện lỗi hệ thống lặp lại thì dừng paid queue, sửa bằng cache rồi mới tiếp
tục. Toàn bộ 44 ví dụ lẻ phải đạt trước khi chạy bài thật. Đây là cost/quality gate
bên trong một delivery wave, không phải chia feature thành nhiều lần triển khai
hay release.

## 9. Tác động contract và source structure

- Giữ nguyên task code `M9.2`, Mode `Worker/Integration`; không tạo subtask mới.
- W1/W8 sở hữu fixture/report; W2-W6 ưu tiên module compiler/validator trong
  domain AI API; W7 sở hữu helper layout/renderer dùng chung ở web theo
  `docs/14-source-code-structure.md`.
- Delivery wave không đổi database hay endpoint. Nếu trong lúc triển khai phát
  hiện bắt buộc phải persist intent hoặc compiler version, phải cập nhật
  database/API contract và được owner xác nhận trước khi mở rộng phạm vi.
- Không thêm thư viện hình học nặng mặc định. Chỉ đề xuất dependency sau benchmark
  bundle/runtime và audit khả năng tree-shake; property-based test chỉ là dev dependency.

## 10. Rủi ro và biện pháp

- **Mẫu số không chuẩn:** khóa manifest versioned, lưu mapping nguồn và danh sách
  excluded công khai.
- **Model hiểu sai ngữ nghĩa:** intent union hẹp, enum/role rõ và family validator.
- **Tọa độ đúng nhưng hình khó đọc:** compiler chọn domain/scale, solver nhãn toàn cục
  và mobile gate bắt buộc.
- **Golden snapshot dễ pass nhưng toán sai:** invariant/property test độc lập với
  pixel/screenshot review.
- **Bùng nổ tổ hợp:** coverage theo archetype-variant, sau đó property-based test
  nhiều dữ kiện thay vì tạo screenshot cho mọi con số.
- **Tăng bundle/latency:** compiler chạy server-side khi có thể, renderer lazy-load,
  benchmark trước mọi dependency.
- **Overclaim 100%:** dashboard luôn hiển thị numerator/denominator, excluded và
  unsupported; chỉ công bố `100%` khi mọi ô eligible đã pass đầy đủ các gate.

## 11. Gói triển khai đề xuất ngay sau kế hoạch

Chạy một lệnh implementation duy nhất cho toàn bộ `M9.2`, với Definition of Done
là release gate ở mục 6. Trong task đó:

1. Khởi tạo W1, W2, W7 và W8 ngay từ đầu để khóa inventory, contract, layout và
   test harness dùng chung.
2. Khi shared compiler context ổn định tối thiểu, mở đồng thời W3, W4, W5 và W6;
   không chờ một family hoàn tất mới bắt đầu family kế tiếp.
3. Mỗi archetype phải giao cùng compiler, validator, property test và golden case;
   không được merge compiler không có fixture/coverage mapping.
4. Tích hợp/rebase hàng ngày vào một branch M9.2; dashboard báo coverage và
   regression theo từng merge.
5. Chạy full local/CI matrix, sau đó mới chạy paid live sample có kiểm soát chi phí.
6. Review toàn bộ ảnh đại diện trên mobile trước, rồi iPad/laptop; ảnh lỗi tuyệt
   đối không nằm trong thư mục đạt chuẩn.
7. Chỉ tạo một lần nghiệm thu cuối và một quyết định rollout cho toàn bộ wave.

Việc “làm tất cả cùng một lúc” ở đây nghĩa là không chia thành các lần nâng cấp
hoặc release riêng. Nó không có nghĩa bỏ dependency kỹ thuật, viết một file khổng
lồ hay đợi đến cuối mới test. Kế hoạch giữ module độc lập và test liên tục để một
workstream không làm hỏng những họ hình khác.

Inventory đầy đủ có thể làm coverage baseline giảm so với cảm giác ban đầu vì mẫu
số trung thực lớn hơn; task chỉ hoàn tất sau khi đưa tỷ lệ đó lên ngưỡng cam kết.

## 12. Điểm resume sau khi tạm dừng ngày 2026-08-10

Delivery wave này **chưa hoàn tất** và chưa đạt điều kiện công bố 90-100%. Khi
owner yêu cầu làm tiếp, tiếp tục từ artifact/báo cáo hiện tại, không chạy lại paid
matrix đã có và không khởi tạo một kế hoạch mới thay thế file này.

### 12.1. Baseline và bằng chứng đã có

- Baseline trước wave: commit `7f561b15`.
- Báo cáo hiện hành:
  `anh-chup-hinh-toan-dat-chuan/coverage-report-v51.json`.
- Prompt/schema: `lesson-summary-prompt-v54` / `lesson-summary-schema-v40`.
- Compiler/local golden: `50/50` ô; semantic visual `86` fixture, `688` ảnh.
- Gate A: 44 ví dụ lẻ, 352 ảnh, 8/8 cấu hình.
- Gate B: 21 bài thật, 152 block, 1.216 ảnh, 8/8 cấu hình.
- Tổng đã duyệt: 2.256 ảnh và 77 contact sheet. Đây là ảnh lặp theo thiết
  bị/theme, không phải 2.256 ô coverage.
- Paid usage đã ghi nhận: 75 event, `131.848 VNĐ`.

### 12.2. Khoảng trống release gate

| Gate | Đã đạt | Còn thiếu |
| --- | ---: | ---: |
| Compiler-represented/local golden | 50/50 (100%) | 0 |
| Live evidence | 39/50 (78%) | 11 |
| Exact-page SGK/SBT | 19/50 (38%) | 31 |
| Đủ cả local + live + exact-page | 11/50 (22%) | 34 để đạt 45/50 |

Nếu denominator cuối vẫn là 50 ô, công bố 90% cần ít nhất 45 ô qua đồng thời
mọi gate. Tối thiểu phải bổ sung 6 live-pass để live đạt 45/50 và 26 exact-page
để source đạt 45/50, nhưng các bằng chứng phải giao nhau trên cùng 45 ô. Để nhắm
100%, hoàn tất cả 11 live evidence và 31 source audit còn thiếu.

11 ô thiếu live evidence:

1. `data-pictogram-simple`;
2. `plane-angle-simple`;
3. `plane-axial-symmetry-medium`;
4. `plane-central-symmetry-hard`;
5. `advanced-centroid-medium`;
6. `advanced-angle-bisectors-medium`;
7. `advanced-perpendicular-bisectors-hard`;
8. `advanced-altitudes-hard`;
9. `advanced-altitude-hard`;
10. `spatial-cone-sphere-medium`;
11. `schematic-flow-medium`.

31 ô thiếu exact-page theo family: `ADVANCED_GEOMETRY` 2,
`ALGEBRA_GRAPH` 5, `DATA_STATISTICS` 4, `ELEMENTARY_MODEL` 5,
`NUMBER_COORDINATE` 4, `PLANE_GEOMETRY` 3, `SET_SCHEMATIC` 4 và
`SPATIAL_APPLIED` 4.

### 12.3. Checklist bắt đầu lại

1. Đọc báo cáo v51, inventory/reference/review manifest và kiểm tra worktree;
   bảo toàn mọi thay đổi/ảnh hiện có, không xóa hoặc ghi đè artifact cũ.
2. Hoàn thiện W1 trước: audit 31 exact-page, khóa include/exclude và denominator;
   exclusion phải có căn cứ nguồn chính thống.
3. Chạy 11 live case theo batch nhỏ bằng `gpt-5.4`; ưu tiên đủ 6 case để kiểm
   mốc 90%, nhưng tiếp tục đủ 11 nếu không gặp blocker và còn ngân sách.
4. Sau từng output: lưu usage, render component thật, chụp đủ 4 viewport × 2
   theme, review thủ công theo SGK/SBT, tạo defect/regression fixture nếu lỗi.
5. Sửa lỗi local bằng cache; chỉ retry trả phí khi root cause là
   `PROVIDER_INTENT`. Sau sửa phải chạy lại toàn bộ golden để bảo vệ ảnh đạt chuẩn.
6. Khi ví dụ lẻ mới đã ổn, chạy lại bài thật đại diện có nhiều block; cập nhật
   report, docs M9 và chỉ đổi `releaseStatus` khi release gate thực sự đạt.

### 12.4. Thời gian và ngân sách phần còn lại

- Mốc tối thiểu 90%: khoảng 8-14 giờ làm việc, live test ước tính
  20.000-35.000 VNĐ.
- Cố gắng 100%: khoảng 14-24 giờ làm việc, live test ước tính
  45.000-80.000 VNĐ.
- Renderer/compiler/source audit và screenshot từ cache không tốn provider.
- Trần đề xuất cho phần paid còn lại: `80.000 VNĐ`; đây không phải quyền tự chi.
  Trước mỗi batch phải báo owner số request, model, token reserve, upper bound,
  số đã dùng và cache hit; dừng sớm khi đủ evidence, không tiêu hết trần nếu
  không cần.

### 12.5. Failure recovery bắt buộc cho admin

Wave chưa được coi là sẵn sàng công bố nếu UI chỉ in raw Zod/semantic-validator
error và để admin tự đoán cách xử lý. Cơ chế partial recovery áp dụng cho mọi
block, không riêng hình vẽ: mọi lỗi có thể quy về một block/field phải được cô
lập ở phần nhỏ nhất; mọi field/sub-block còn render an toàn và có ý nghĩa vẫn
hiển thị, placeholder chỉ thay phần không còn render được. Phần hợp lệ persist ở
`NEEDS_REVIEW`. Chỉ response không đọc được, source stale hoặc lỗi provider,
database/hạ tầng mới làm toàn job fail. UI phải hiển thị copy tiếng Việt và hành
động phù hợp cho các lỗi toàn cục đó thay vì raw error.

Các block hợp lệ phải được giữ lại khi có thể; raw error chỉ nằm trong mục
`Chi tiết kỹ thuật`, không hiển thị làm hướng dẫn chính. Local normalizer chỉ tự
sửa lỗi cú pháp hoặc dữ liệu dư thừa không đổi ý nghĩa toán học; không tự bịa
segment/điểm/quan hệ còn thiếu. Lượt tạo summary ban đầu chỉ gọi AI một lần và
không tự repair. Hotfix giữ mọi hình còn render-safe, gắn `Cần review` và cho
admin chấp nhận nguyên hình đó mà không gọi AI. Nếu chỉ vài primitive/marker/label
hỏng thì cô lập đúng phần tử lỗi và vẫn vẽ phần còn có ý nghĩa; chỉ khi không còn
hình có ý nghĩa nào mới dùng placeholder `Hình lỗi`. Admin cũng có thể sửa/xóa
bằng editor hiện có. Nút `Tạo lại` riêng
block là phase tùy chọn: nếu triển khai, mỗi lần bấm chủ động mới tạo đúng một
request AI riêng và không tự retry. Hotfix cần focused integration test, mobile
smoke và golden non-regression trước khi hoàn tất.

Kế hoạch triển khai gọn cho partial persistence, placeholder và publish gate
nằm tại
`.codex/plans/m9-2-summary-partial-block-recovery-plan.md`. Phải hoàn thành
bug-fix slice này trước khi chạy tiếp live coverage còn thiếu, để một lỗi cục bộ
không tiếp tục làm mất toàn bộ artifact của paid full-lesson request. Không có
AI tự tạo lại ngầm; phase nút tạo lại riêng block không nằm trong hotfix bỏ chặn.
