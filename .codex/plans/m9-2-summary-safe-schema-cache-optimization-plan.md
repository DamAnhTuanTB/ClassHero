# M9.2 — Tối ưu an toàn schema `$defs/$ref` và Prompt Caching cho Sinh kiến thức

Trạng thái: `IMPLEMENTED_AND_VERIFIED` ngày 2026-08-11

Mode: `Worker/Integration`

Baseline code: commit `9eb8e105` (`feat(ai): compact summary schemas with refs`)

Kết quả xác minh: 60 focused local tests + historical-artifact regression pass;
15 live GPT-5.4 calls pass. `ref_v2` có 30.394 schema characters, Bài 15 đạt
18/18 diagram đủ hai tam giác, cache-warm xuyên bài khoảng 95%, manual review
99/100. Artifact và báo cáo mắt thường nằm tại
`tmp/m9-2-schema-ref-v2-visual-comparison/`.

Phạm vi duy nhất: tính năng **Sinh kiến thức / Lesson Summary / M9.2**. Không mở
rộng sang Quiz, Test, Flashcard, explanation hoặc chat.

## 1. Kết quả cần đạt

- Giữ nguyên đầy đủ mọi chunk nguồn và metadata đang gửi cho OpenAI.
- Không sửa System prompt, User prompt, thứ tự dữ liệu hoặc contract output.
- Tối ưu tiếp JSON Schema chỉ bằng biểu diễn tương đương `$defs/$ref`.
- Làm schema compact ổn định từng byte để tăng khả năng trùng prefix cache.
- Tận dụng Prompt Caching của OpenAI mà không đưa cache vào nội dung prompt.
- Cho phép bật/tắt và rollback riêng từng lớp tối ưu.
- Chỉ cho phép rollout khi chứng minh được tính tương đương bằng test tự động;
  nếu có mismatch thì dừng, không sửa prompt/mapper để “bù” cho tối ưu.

## 2. Safety contract bắt buộc

### 2.1. Dữ liệu nguồn bất biến

Giữa `inline`, `$ref` v1 và `$ref` v2, các dữ liệu sau phải giống hệt:

- Số lượng `contextChunks`.
- Thứ tự chunk.
- Từng `chunk.id`, `chunk.content`, `chunk.score` nếu có.
- Toàn bộ key/value trong `chunk.metadata`, gồm cả giá trị `null` hoặc optional.
- `documentIds`, `sourceHash`, lesson metadata và target grade trong job snapshot.
- Chuỗi context cuối cùng sau `buildAiUserPrompt`, tính cả delimiter/JSON escaping.

Nghiêm cấm trong plan này:

- bỏ metadata;
- cắt, gộp, chia, deduplicate hoặc đổi thứ tự chunk;
- trim/rút gọn nội dung nguồn;
- thay raw content bằng summary;
- đổi giới hạn context `12.000` token hoặc âm thầm cắt dữ liệu khi quá giới hạn.

### 2.2. Prompt và cấu hình bất biến

Các field sau phải byte-equivalent trước và sau tối ưu:

- `instructions`;
- `input`;
- `model`;
- `reasoning.effort`;
- `temperature` nếu model hỗ trợ;
- `max_output_tokens`;
- `text.format.name` và `text.format.strict`.

Request diff chỉ được phép xuất hiện tại:

1. `text.format.schema`: đổi cách biểu diễn từ `$ref` v1 sang `$ref` v2;
2. `prompt_cache_key`: chỉ khi cờ Prompt Caching được bật;
3. `prompt_cache_retention`: chỉ khi retention opt-in được bật và model hỗ trợ.

Không được sắp xếp lại System/User/context chỉ để tăng cache hit vì việc đó có thể
đổi hành vi model.

### 2.3. Output contract bất biến

- Dùng nguyên Zod transport schema hiện tại.
- Schema `$ref` v2 sau dereference phải deep-equal schema inline baseline, ngoại
  trừ `$schema` draft metadata không tham gia contract.
- Không đổi key, enum, type, required, nullability, min/max, union, description,
  additional properties hoặc ownership của bất kỳ node nào.
- Dùng nguyên Zod parser cho `output_parsed`.
- Không đổi acceptance schema, recovery, mapper, diagram compiler, review issue,
  persisted wrapper hoặc renderer.
- Cùng một cached raw output phải tạo kết quả parse/map/persist giống hệt ở cả ba
  strategy.

Đây là nghĩa “an toàn 100%” của task: tập JSON hợp lệ và toàn bộ pipeline sau
provider không thay đổi. Không dùng việc hai lần gọi model sinh text giống từng
chữ làm tiêu chí, vì generation vốn không deterministic.

## 3. Baseline phải khóa trước khi sửa

Đo và lưu fixture từ commit `9eb8e105`:

| Baseline                        |              Giá trị đã đo |
| ------------------------------- | -------------------------: |
| Schema inline                   |     khoảng `329.547` ký tự |
| `$ref` v1 hiện tại              |      khoảng `33.295` ký tự |
| Số `$defs` v1                   |                       `23` |
| Số `$ref` v1                    |                      `213` |
| Input OpenAI live với `$ref` v1 | khoảng `14,4k–14,8k` token |
| Input OpenAI live với inline    | khoảng `93,2k–93,6k` token |

Fixture baseline cần gồm:

- canonical inline `text.format`;
- canonical `$ref` v1 `text.format`;
- hash của schema sau canonicalization;
- một request không có custom prompt;
- một request có custom System/User prompt;
- một request hình học chứa hai tam giác;
- cached provider outputs đang có của các live A/B trước.

Không đưa prompt/context thô vào log production. Fixture test chỉ dùng dữ liệu
test hoặc artifact đã được phép lưu trong repo/test fixtures.

## 4. Thiết kế kỹ thuật

### 4.1. Tạo `$ref` v2 như một strategy mới

Mở rộng strategy nội bộ thành:

```ts
type AiStructuredSchemaReferenceStrategy = "inline" | "ref" | "ref_v2";
```

- `inline`: giữ nguyên helper SDK hiện tại, byte-equivalent baseline.
- `ref`: giữ nguyên serializer đã commit tại `9eb8e105`.
- `ref_v2`: chỉ thêm các tối ưu biểu diễn tương đương trong plan này.

Job cũ thiếu field tiếp tục default `inline`; job đã snapshot `ref` tiếp tục chạy
v1. Không tự nâng job đang chờ từ v1 sang v2.

### 4.2. Hoist ba nhóm subtree trùng hệt còn sót

Chỉ tái sử dụng cùng một Zod node cho các subtree đã xác minh giống hệt:

1. `geometryStatement` của illustration, standard exercise và real-world
   exercise trong `lesson-summary.types.ts`.
2. Marker item dùng chung cho `equalLengths` và `parallels` trong
   `lesson-summary-provider-diagram.types.ts`.
3. Measure item dùng ở hai nhánh diagram intent trong
   `lesson-summary-diagram-intent.types.ts`.

Quy tắc:

- Chỉ hoist khi schema trước hoist deep-equal từng node sau khi serialize inline.
- Không tạo abstraction nghiệp vụ mới và không đổi tên field output.
- Không dùng fuzzy matching hoặc tự động gộp các node “gần giống”.
- Scanner subtree chỉ được dùng để báo cáo candidate; candidate mới phải được
  review và thêm explicit test trước khi đưa vào ref v2.

Mức giảm đã prototype: khoảng `957` ký tự trên `$ref` v1.

### 4.3. Rút gọn tên `$defs` theo ánh xạ deterministic

Sau khi Zod tạo schema ref và OpenAI strict transform hoàn tất:

- Đổi tên definition theo thứ tự canonical thành `a`, `b`, ..., `z`, `aa`, ...;
- cập nhật đồng thời mọi JSON Pointer dạng `#/$defs/<name>`;
- không chạm external ref, `$id`, description hoặc field dữ liệu;
- fail ngay nếu có ref không resolve, collision hoặc pointer ngoài whitelist;
- canonical serializer phải cho cùng một chuỗi JSON ở mọi lần chạy/process.

Mức giảm đã prototype: khoảng `1.882` ký tự trên `$ref` v1.

Kết hợp hoist subtree và short deterministic names dự kiến:

- `33.295` → khoảng `30.473` ký tự;
- giảm thêm khoảng `2.822` ký tự (`8,48%`) so với `$ref` v1;
- vẫn tương đương hoàn toàn với inline sau dereference.

Budget gate hiện tại: `ref_v2 <= 31.000` ký tự; schema v44 đạt 30.981 ký tự sau
thay đổi note contract và ownership GT–KL. Khi contract
version đổi hợp lệ trong tương lai, test dùng tỷ lệ so với v1 cùng version thay vì
giữ số tuyệt đối cũ.

### 4.4. Memoize formatter trong process

Có thể memoize kết quả formatter theo:

```txt
outputName + schemaVersion + strategy + transportSchemaIdentity
```

Điều kiện:

- cache chỉ chứa object schema đã compile, không chứa lesson/chunk/prompt;
- object trả ra phải immutable hoặc clone an toàn;
- cache hit và miss phải serialize byte-identical;
- có giới hạn số entry nhỏ, không tạo cache tăng vô hạn;
- đây là tối ưu CPU/determinism, không được tính nhầm thành giảm input token.

### 4.5. Prompt Caching không thay prompt

OpenAI tự động cache các prompt đủ điều kiện theo exact prefix. Structured Output
schema nằm trong prefix và có thể được cache; vì vậy schema v2 phải deterministic.

Triển khai theo ba nấc độc lập:

#### Nấc A — Automatic caching và observability

- Không thêm nội dung nào vào prompt.
- Giữ prefix hiện tại; không reorder field để “tối ưu cache”.
- Ghi nhận `usage.input_tokens_details.cached_tokens` qua field
  `cachedInputTokens` hiện có.
- Tính và log các chỉ số không chứa prompt thô:
  `inputTokens`, `cachedInputTokens`, `uncachedInputTokens`, `cacheHitRatio`,
  model, promptVersion, schemaVersion và strategy.

#### Nấc B — Stable `prompt_cache_key`

Thêm option provider riêng, chỉ bật cho Summary:

```txt
ls:<model>:<promptVersion>:<schemaVersion>:<strategy>:<prefixHash8>
```

- `prefixHash8` lấy từ phần static exact-prefix gồm effective system instructions
  và structured schema; không lấy lesson ID, document ID hoặc chunk content.
- Custom system instructions khác nhau tạo hash khác nhau.
- Key chỉ hỗ trợ routing cache; exact prefix matching của OpenAI vẫn là lớp quyết
  định cache hit, nên không thể lấy nhầm cache của prompt khác.
- Key không được chèn vào `instructions` hoặc `input`.
- Theo dõi throughput theo key; nếu vượt ngưỡng routing khuyến nghị thì shard
  deterministic mà không đổi prompt.

#### Nấc C — Extended retention opt-in

- Mặc định ban đầu giữ retention tự động/in-memory.
- Chỉ gửi `prompt_cache_retention: "24h"` khi model capability hiện hành hỗ trợ,
  cờ riêng được bật và chính sách lưu giữ dữ liệu của dự án cho phép.
- Không gửi `prompt_cache_options`/cache breakpoint dành cho model khác vào
  `gpt-5.4`.
- Model không hỗ trợ phải omit field, không fallback bằng cách sửa prompt.

Lưu ý UI/đo lường: “Tổng input ước tính” vẫn là tổng token gửi tới OpenAI và sẽ
không giảm nhờ Prompt Caching. Cache chỉ làm một phần input trở thành cached input;
cần nhìn `cachedInputTokens`/`uncachedInputTokens` và chi phí thực tế để đánh giá.

## 5. Cấu hình strategy và rollback

Schema strategy và các lớp cache được điều khiển độc lập:

```env
AI_SUMMARY_SCHEMA_REFERENCE_STRATEGY=ref_v2
AI_SUMMARY_PROMPT_CACHE_KEY_ENABLED=false
AI_SUMMARY_PROMPT_CACHE_RETENTION=in_memory
```

Resolution:

- strategy `inline` → schema mở rộng hoàn toàn;
- strategy `ref` → `$defs/$ref` v1;
- strategy `ref_v2` → serializer compact hiện hành và là mặc định;
- cache key off → không gửi `prompt_cache_key`;
- retention mặc định → omit hoặc dùng behavior mặc định của provider;
- `24h` chỉ được gửi khi capability gate pass.

Rollback không yêu cầu migration, regenerate summary hoặc sửa persisted content.
Mỗi thay đổi flag phải restart API/worker để process nạp cấu hình mới.

## 6. Thứ tự triển khai và gate

### Pha 0 — Freeze baseline

1. Lưu canonical fixture/hash của inline và ref v1.
2. Lưu request fingerprint cho các case baseline.
3. Khóa test số lượng/thứ tự/nội dung/metadata chunk.
4. Khóa cached raw output và output sau mapper.

Gate: test characterization phải pass trên commit baseline trước khi viết ref v2.

### Pha 1 — Ref v2 thuần biểu diễn

1. Thêm strategy `ref_v2` nhưng chưa cho Summary resolve tới strategy này.
2. Hoist đúng ba subtree đã duyệt.
3. Thêm deterministic `$defs` renaming.
4. Thêm resolver/dereferencer chỉ dùng trong test.
5. Thêm unresolved-ref/collision/cycle guard.
6. Memoize formatter sau khi byte-equivalence test pass.

Gate:

- dereferenced ref v2 deep-equal inline;
- inline byte-equivalent baseline;
- ref v1 byte-equivalent baseline;
- ref v2 đạt size budget;
- mọi cached output parse/map/persist giống nhau.

### Pha 2 — Preview/worker parity và cờ rollout schema

1. Nối `AI_SUMMARY_SCHEMA_REFERENCE_STRATEGY` vào resolver Summary.
2. Snapshot strategy vào job input.
3. Preview và worker dùng cùng formatter/schema hash.
4. So request field-by-field với whitelist diff tại mục 2.2.

Gate: thay đổi duy nhất giữa ref v1 và ref v2 là
`text.format.schema`; không enqueue/call provider trong test này.

### Pha 3 — Prompt Caching observability

1. Chuẩn hóa token usage đã có thành cached/uncached/hit ratio.
2. Ghi metric theo Summary contract version và strategy.
3. Không log prompt, context hoặc cache key chứa dữ liệu nguồn.
4. Xác nhận “Tổng input” không bị đổi nghĩa.

Gate: usage thiếu `cached_tokens` vẫn hoạt động bình thường và không làm fail job.

### Pha 4 — Cache key và retention opt-in

1. Thêm optional cache-routing fields ở provider input.
2. Chỉ Summary tạo stable key; feature AI khác không nhận field mới mặc định.
3. Snapshot/preview request thể hiện chính xác top-level provider fields.
4. Thêm capability gate cho retention.
5. Cờ cache key và retention mặc định không làm thay đổi request baseline.

Gate: cache off tạo request byte-equivalent ngoài schema strategy; cache on chỉ
thêm đúng top-level cache fields trong whitelist.

### Pha 5 — Local/cached regression

1. Chạy schema, context, integration, partial recovery và diagram tests M9.2.
2. Replay toàn bộ cached live output đã có qua inline/ref v1/ref v2.
3. Với fixture hai tam giác, xác nhận số object/topology/marker không đổi.
4. Chạy typecheck, scoped lint và `git diff --check`.
5. Restart worker rồi smoke preview → enqueue bằng provider mock/cache.

Gate: chỉ khi toàn bộ local/cached test pass mới được đề xuất live provider.

### Pha 6 — Live canary có phê duyệt chi phí riêng

Không tự gọi OpenAI trong implementation mặc định. Trước khi chạy phải báo số
call, input/output budget và chi phí ước tính để owner xác nhận.

#### 6.1. Ba nhóm so sánh

Live report phải phân biệt rõ các mốc, không gộp tất cả thành một chữ “baseline”:

- `H0 — historical inline`: output của đường inline byte-equivalent với helper
  SDK trước khi bật `$ref`; đây là đại diện gần nhất cho hành vi “chưa chỉnh sửa
  cách biểu diễn schema”.
- `H1 — historical ref v1`: output đã chạy ở commit `9eb8e105`, trước khi làm
  ref v2/cache key.
- `C1 — concurrent ref v1`: control v1 gọi cùng ngày, cùng model snapshot và cùng
  source/config với ref v2 để loại trừ ảnh hưởng thời điểm/provider.
- `T1 — ref v2`: treatment chỉ đổi cách biểu diễn schema.
- `T2 — ref v2 cache-warm`: cùng request T1 nhưng có cache hit để xác nhận cache
  không làm giảm quality gate.

So sánh chính là `T1 ↔ C1`; `T1 ↔ H0/H1` là so sánh với các lần chưa chỉnh sửa.
Không chỉ so `inline` và `ref v2` chạy ở hai thời điểm khác nhau rồi quy mọi khác
biệt cho schema.

#### 6.2. Khóa và chấm lại artifact cũ trước khi trả phí

Các artifact hiện có phải được giữ read-only, không ghi đè:

- ba cặp Bài 15 tại `tmp/m9-2-schema-ref-live-comparison/`, `run-2/`, `run-3/`;
- ba cặp nguồn nhỏ tại `tmp/m9-2-schema-ref-small-live-comparison/`.

Trước live run mới:

1. Tạo manifest gồm path, SHA-256, commit, model snapshot, prompt/schema version,
   request/source fingerprint và timestamp của từng artifact cũ.
2. Parse lại toàn bộ `providerOutput`/`summary` cũ bằng pipeline hiện tại.
3. Chạy bộ metric mới trên artifact cũ để bổ sung các chỉ số trước đây chưa ghi,
   nhất là topology hai tam giác, marker và độ đầy đủ lời giải.
4. Ghi kết quả chấm lại vào report mới; không sửa JSON artifact gốc.

Pha này không gọi OpenAI nhưng tạo baseline định lượng thực sự để đối chiếu T1.

#### 6.3. Bộ case cố định

| ID   | Khối/lĩnh vực               | Mục đích kiểm tra                                                       | Hard visual gate                                                    |
| ---- | --------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `S1` | Lớp 3, tính chất giao hoán  | Bám đúng một khái niệm, không bịa kiến thức lân cận, văn phong tiểu học | Không tự tạo hình                                                   |
| `S2` | Lớp 8, bình phương một tổng | Công thức, biến đổi và lời giải Đại số                                  | Không tự tạo hình                                                   |
| `S3` | Lớp 7, tổng ba góc tam giác | Kiến thức Hình học và một tam giác đúng cạnh/đỉnh                       | Mọi hình có đúng tam giác cần thiết                                 |
| `F1` | Bài 15, hai tam giác vuông  | Đủ hai trường hợp bằng nhau, hai tam giác, góc vuông và cạnh bằng nhau  | Không hình nào thiếu tam giác thứ hai; source example đúng topology |

Mỗi case dùng nguyên source, metadata, prompt, model, reasoning và output budget
đã khóa. Model phải pin `gpt-5.4-2026-03-05`, không dùng alias trôi theo thời gian.

#### 6.4. Ma trận paid calls theo tầng

| Tầng | Control/Treatment                                    | Số call mới | Điều kiện đi tiếp                                       |
| ---- | ---------------------------------------------------- | ----------: | ------------------------------------------------------- |
| `L0` | Chấm lại H0/H1 từ artifact                           |         `0` | Baseline parse được và manifest/hash đầy đủ             |
| `L1` | S1–S3: mỗi case một `C1 ref v1` + một `T1 ref v2`    |         `6` | 6/6 đạt hard gates, không có material quality loss      |
| `L2` | F1: ba cặp C1/T1, đảo thứ tự gọi theo từng cặp       |         `6` | 3/3 T1 đủ hai tam giác và đạt non-inferiority           |
| `L3` | Một request nhỏ ref v2 lặp ba lần với cùng cache key |         `3` | Có cache read đo được; cả 3 output vẫn đạt quality gate |

Tổng tối đa ban đầu: `15` paid calls. Chạy tuần tự theo tầng và dừng ngay khi một
hard gate fail. Không tự chạy lại request timeout/5xx; trường hợp hạ tầng được ghi
`INCONCLUSIVE` và chỉ retry sau khi owner duyệt phần chi phí bổ sung.

Với giá GPT-5.4 được kiểm tra tại thời điểm lập plan (`$2,50/1M` input,
`$0,25/1M` cached input, `$15/1M` output) và FX `25.000 VND/USD`:

- theo usage đã quan sát, 15 call dự kiến khoảng `$1,5–2,0`
  (`37.500–50.000 đ`);
- trần bảo thủ nếu cả 15 call dùng gần `16.000` output token khoảng `$4,2`
  (`105.000 đ`), chưa tính thay đổi bảng giá/tỷ giá;
- trước lúc chạy phải tính lại từ request preview và bảng giá hiện hành, báo owner
  con số cụ thể rồi chờ xác nhận.

Không chạy lại inline live 93k input token theo mặc định vì H0 đã có artifact đầy
đủ. Chỉ chạy thêm một inline contemporaneous control nếu kết quả nằm sát ngưỡng
hoặc model snapshot cũ không còn khả dụng, và phải xin duyệt chi phí riêng.

#### 6.5. Thứ tự và cô lập biến thử nghiệm

- L1 đảo thứ tự theo case: S1 `ref v1 → ref v2`, S2 `ref v2 → ref v1`, S3
  `ref v1 → ref v2`.
- L2 dùng ba cặp theo thứ tự `AB`, `BA`, `AB` để giảm thiên lệch do thời điểm.
- Trong L1/L2, cache-key feature flag giữ off; automatic cache có thể vẫn xảy ra
  và phải ghi `cachedInputTokens`, nhưng request không thêm cache field mới.
- L3 giữ nguyên schema/prompt/source và chỉ kiểm cache key/cached usage; không đổi
  prompt để ép cache miss/hit.
- Mỗi live run dùng run ID mới. Test không được đọc artifact T1 cũ rồi báo là đã
  gọi live, và không được overwrite H0/H1.

#### 6.6. Đo chất lượng output tự động

Mỗi output phải lưu cả raw provider output, mapped summary và metric report.

Hard gates — fail một mục là `FAIL`, không lấy điểm trung bình để che lỗi:

- strict Structured Output parse thành công;
- transport Zod, recovery, mapper và persisted Zod đều thành công;
- section cuối đúng `Bài tập vận dụng` và đúng hai bài theo thứ tự contract;
- `issueCount = 0` với các fixture baseline vốn đang bằng `0`;
- không thiếu theory/example/exercise bắt buộc;
- mọi khái niệm/công thức bắt buộc xuất hiện, không có khái niệm ngoài scope được
  liệt kê trong `unexpectedTerms`;
- lời giải có đủ các ý/câu hỏi của đề và đáp số/kết luận đúng;
- `missingRequiredVisuals = 0`;
- F1 có đủ hai theory category `TWO_LEGS`, `HYPOTENUSE_LEG`, không có category
  ngoài source;
- F1: mọi diagram cần hai tam giác đều đếm được hai tam giác; source example có
  đúng các cạnh `AB, BC, AC, AD, CD`, góc vuông tại `B, D` và marker `AB = AD`;
- không có lỗi toán học, quan hệ hình học hoặc reference marker bị hỏng.

Metrics định lượng bổ sung:

- số section/unit/block và thứ tự;
- source-topic coverage ratio;
- required-term hit ratio và unexpected-term count;
- số bài có lời giải đủ/số bài tổng;
- số diagram, primitive, point, polygon/triangle, marker theo loại;
- diagram topology pass ratio;
- input/cached/uncached/output token, latency và chi phí thực tế;
- schema-invalid, refusal, incomplete, timeout và recovery count.

#### 6.7. Chấm chất lượng sư phạm blind review

Không dùng một LLM khác làm judge mặc định. Tạo bản review đã ẩn strategy, token
usage và tên file; reviewer chỉ thấy source và output đã render.

Rubric 100 điểm:

| Nhóm                    | Điểm | Nội dung                                                             |
| ----------------------- | ---: | -------------------------------------------------------------------- |
| Bám nguồn, không tự bịa |   25 | Đúng phạm vi, đủ ý nguồn, không thêm định lí/phương pháp ngoài nguồn |
| Đúng toán học           |   20 | Công thức, suy luận, lời giải, đáp số/kết luận                       |
| Đầy đủ và cân đối       |   15 | Không thiếu trường hợp, ví dụ, hai bài cuối hoặc ý nhỏ của đề        |
| Cấu trúc contract       |   10 | Theory–example, section, heading và thứ tự hợp lý                    |
| Văn phong đúng khối lớp |   10 | Dễ hiểu/chặt chẽ đúng grade và loại bài                              |
| Hình vẽ                 |   20 | Đủ số hình/thành phần, đúng topology, marker, nhãn và quan hệ        |

Case không cần hình được chuẩn hóa điểm trên 80 điểm còn lại; không cộng 20 điểm
hình một cách tự động. Ít nhất hai lượt review độc lập (owner và người thực hiện
test hoặc reviewer được chỉ định). Nếu lệch quá 5 điểm hoặc bất đồng về lỗi toán/
hình, kết quả là `INCONCLUSIVE` cho đến khi review lại, không tự chọn điểm có lợi.

#### 6.8. Quy tắc kết luận tương đương/non-inferiority

Ref v2 chỉ được ghi `PASS` khi đồng thời:

1. T1 pass `100%` hard gates ở S1–S3 và cả 3 lần F1.
2. Không có bất kỳ lỗi thiếu hình, thiếu tam giác thứ hai, sai marker hoặc sai toán
   mà C1/H0/H1 không có.
3. Điểm blind review từng T1 tối thiểu `90/100` sau normalization; hard gate vẫn
   quyết định riêng nên điểm cao không thể che lỗi toán hoặc hình.
4. Median T1 không thấp hơn C1 quá `2` điểm và không thấp hơn median historical
   H0/H1 quá `3` điểm.
5. Không dimension critical nào (`bám nguồn`, `đúng toán`, `hình vẽ`) thấp hơn
   comparator tương ứng quá `1` điểm rubric.
6. Trong sáu cặp live L1/L2, T1 phải `tie/win` ít nhất `5/6`; mọi material loss
   ở toán học hoặc hình vẽ đều fail ngay dù tổng điểm còn cao.
7. Input/schema token giảm đúng dự kiến nhưng không được dùng mức giảm token để
   bù cho bất kỳ quality regression nào.

Nếu T1 fail: giữ ref v1, không bật ref v2 và không sửa prompt/mapper/compiler
trong task này. Nếu chỉ một tiêu chí chủ quan sát ngưỡng: ghi `INCONCLUSIVE`, mở
rộng mẫu sau một kế hoạch/chi phí được owner duyệt; không tuyên bố tương đương.

#### 6.9. Live test Prompt Caching

L3 dùng ba request hoàn toàn giống nhau và cùng stable cache key:

- ghi `inputTokens`, `cachedInputTokens`, `uncachedInputTokens`, hit ratio,
  latency, output tokens và chi phí từng call;
- không bắt buộc call đầu có `cachedInputTokens = 0`, vì cache là hạ tầng managed;
- bắt buộc ít nhất một call sau có `cachedInputTokens > 0` và target hit ratio
  `>= 80%`; baseline ref v1 trước đây đã quan sát khoảng `95%`;
- cả ba output phải pass hard gates và blind score threshold như case tương ứng;
- không so text byte-for-byte: theo OpenAI, cache không đổi cách model sinh output
  nhưng request nondeterministic vẫn có thể trả câu chữ khác nhau.

Retention `24h` không bật trong matrix chất lượng đầu tiên. Sau khi cache key pass,
có thể chạy một smoke riêng để xác nhận request được model chấp nhận; việc đo cache
sau nhiều giờ là bài đo vận hành, không phải quality gate của ref v2.

#### 6.10. Artifact và report bắt buộc

Mỗi run lưu:

- run ID, git commit, dirty status;
- model alias yêu cầu và model snapshot provider trả về;
- prompt/schema version, strategy, schema hash/size;
- request fingerprint, source hash và hash từng chunk/metadata;
- cache fields đã gửi;
- raw output, mapped summary, validation/recovery issues;
- automated metrics, blind-review sheet và kết luận;
- usage/cost từng call và tổng chi phí.

Report cuối phải có bảng H0/H1/C1/T1/T2 theo từng case, delta điểm, hard-gate result,
cache ratio và link artifact. Không được chỉ báo “6/6 parse” rồi kết luận output
tương đương.

Không dùng live output để sửa prompt trong pass này. Nếu ref v2 hoặc cache canary
fail, rollback đúng cờ tương ứng và giữ nguyên contract hiện tại.

### Pha 7 — Rollout tuần tự

1. Bật ref v2, giữ cache key off.
2. Theo dõi schema-invalid, refusal, timeout, recovery/review issue, thiếu hình và
   input tokens.
3. Khi ref v2 ổn định mới bật cache key.
4. Theo dõi cached token ratio, latency và billed input.
5. Chỉ sau đó mới cân nhắc retention `24h`.

Không bật ref v2, cache key và 24h retention trong cùng một lần rollout.

## 7. Ma trận test bắt buộc

### Schema equivalence

- Mọi `$ref` resolve được và không có dangling reference.
- Expand ref v1 và ref v2 rồi deep-equal inline baseline.
- Rename `$defs` hai lần vẫn cho cùng output.
- Serialize ở process/test run khác nhau vẫn byte-identical.
- Ref v2 không làm mất description/required/nullability/union branch.
- Inline và ref v1 không đổi byte so với commit baseline.
- Ref v2 đạt `<= 31.000` ký tự với contract hiện tại.

### Context/request preservation

- Empty metadata, nested metadata, Unicode và `null` được giữ nguyên.
- Hai chunk có content giống nhau vẫn không bị deduplicate.
- Chunk order khác tạo request hash khác; serializer không tự sort chunk.
- Custom System/User prompt được gửi nguyên văn.
- Diff ref v1/ref v2 chỉ có `text.format.schema`.
- Diff cache off/on chỉ có top-level cache field.
- Preview và worker payload giống nhau với cùng snapshot.

### Parser/pipeline preservation

- Cùng raw output cho cùng kết quả Zod parse.
- Cùng partial output cho cùng recovery result.
- Cùng diagram intent/spec cho cùng compiler result và review issues.
- Cùng output cho cùng persisted blocks/version.
- Invalid output bị reject giống nhau ở cả ba strategy.

### Prompt Caching

- Key ổn định khi static prefix không đổi.
- Prompt/schema version, model, strategy hoặc custom System prompt đổi thì key đổi.
- Lesson/chunk khác nhưng static prefix giống không làm key đổi.
- Exact-prefix mismatch không bị coi là cache hit trong mock/telemetry logic.
- `cachedInputTokens <= inputTokens`; uncached không âm.
- Provider không trả usage details vẫn không làm hỏng generation log.
- Unsupported model không nhận `24h` hoặc field không hỗ trợ.

### Live output equivalence

- Historical artifact manifest/hash không đổi giữa trước và sau test.
- Metric extractor chấm lại được toàn bộ H0/H1 mà không gọi provider.
- Live run mới luôn có unique run ID và không dùng nhầm cached artifact làm call.
- C1/T1 dùng đúng cùng source, metadata, prompt, model snapshot và cấu hình.
- Automated report fail ngay khi thiếu công thức, lời giải, hình hoặc topology.
- Blind-review package không làm lộ strategy hoặc token usage.
- Non-inferiority rule tại mục 6.8 được tính từ report, không chọn tay.
- Cache-warm output vẫn phải đạt cùng quality gate với cache-cold/control.

## 8. File dự kiến sửa khi owner duyệt thực thi

Backend core:

- `apps/api/src/modules/ai/utils/ai-structured-output-format.ts`
- `apps/api/src/modules/ai/types/ai-text.types.ts`
- `apps/api/src/modules/ai/providers/openai.provider.ts`
- `apps/api/src/modules/ai/types/lesson-summary.types.ts`
- `apps/api/src/modules/ai/types/lesson-summary-provider-diagram.types.ts`
- `apps/api/src/modules/ai/types/lesson-summary-diagram-intent.types.ts`

Summary preview/job/worker:

- `apps/api/src/modules/learning-paths/services/lesson-summaries.service.ts`
- `apps/api/src/modules/ai/utils/lesson-summary-prompt.ts`
- `apps/api/src/workers/services/lesson-summary-generation.service.ts`
- schema/type job input liên quan trực tiếp nếu compiler yêu cầu.

Tests:

- `apps/api/test/m9.2-lesson-summary-schema.test.ts`
- `apps/api/test/m9.2-lesson-summary-context.test.ts`
- `apps/api/test/m9.2-lesson-summary.int.test.ts`
- `apps/api/test/m9.2-lesson-summary-partial-recovery.test.ts`
- `apps/api/test/m9.2-openai-schema-ref-small-live.int.test.ts`
- `apps/api/test/m9.2-openai-live.int.test.ts`
- live comparison/report helper mới dưới `apps/api/test/utils/` hoặc
  `apps/api/test/fixtures/` theo ownership thực tế; không nhét thêm toàn bộ logic
  chấm điểm vào một file live test đã lớn.
- test formatter/provider request focused mới nếu trách nhiệm chưa có file phù hợp.
- live test M9.2 chỉ chạy thủ công sau phê duyệt chi phí.

Config/docs:

- `.env.example`
- `docs/06-ai-rag-spec.md`
- `docs/07-integration-and-env.md`
- `docs/12-performance-and-observability.md`
- `docs/implementation/M9.md` nếu trạng thái rollout thay đổi.

Không cập nhật changelog cho tới workflow `/commit` và commit thật sự được tạo.

## 9. Lệnh kiểm tra dự kiến

```bash
pnpm --filter @learning-path/api test -- m9.2-lesson-summary-schema.test.ts
pnpm --filter @learning-path/api test -- m9.2-lesson-summary-context.test.ts
pnpm --filter @learning-path/api test -- m9.2-lesson-summary.int.test.ts
pnpm --filter @learning-path/api test -- m9.2-lesson-summary-partial-recovery.test.ts
pnpm --filter @learning-path/api test -- m9.2-diagram-compiler.test.ts
pnpm --filter @learning-path/api typecheck
pnpm exec eslint <scoped-files>
git diff --check
```

Live tests không nằm trong lệnh mặc định và phải yêu cầu env opt-in rõ ràng.
Khi owner đã duyệt chi phí, lệnh live dự kiến được tách theo tầng để có thể dừng:

```bash
RUN_OPENAI_SMALL_LIVE_TESTS=1 M9_2_LIVE_TIER=L1 pnpm --filter @learning-path/api test -- m9.2-openai-schema-ref-small-live.int.test.ts
RUN_OPENAI_LIVE_TESTS=1 M9_2_LIVE_TIER=L2 pnpm --filter @learning-path/api test -- m9.2-openai-live.int.test.ts
RUN_OPENAI_SMALL_LIVE_TESTS=1 M9_2_LIVE_TIER=L3 pnpm --filter @learning-path/api test -- m9.2-openai-prompt-cache-live.int.test.ts
```

Tên env/file chính xác được chốt khi triển khai; không đổi các env production hiện
có chỉ để phục vụ test harness.

## 10. Tiêu chí Done

- [ ] Tất cả chunk/metadata được giữ nguyên số lượng, thứ tự và từng giá trị.
- [ ] System/User/context/model/reasoning/max output không đổi.
- [ ] Ref v2 sau dereference deep-equal inline baseline.
- [ ] Inline và ref v1 không bị thay đổi ngoài ý muốn.
- [ ] Ref v2 đạt budget schema đã chốt.
- [ ] Cached raw outputs cho kết quả parse/recovery/map/persist giống hệt.
- [ ] Preview và worker/provider request parity pass.
- [ ] Automatic cache usage được đo bằng `cachedInputTokens`.
- [ ] Stable cache key chỉ thêm top-level request field và có rollback riêng.
- [ ] Retention chỉ bật theo capability/privacy gate.
- [ ] Local/cached regression, typecheck, lint và diff check pass.
- [ ] Worker đã restart trước runtime smoke.
- [ ] Live canary chỉ chạy sau khi owner duyệt chi phí và đã báo usage thực tế.
- [ ] Toàn bộ H0/H1 được hash và chấm lại bằng metric mới mà không gọi provider.
- [ ] L1/L2 đạt hard gates và non-inferiority threshold với C1/H0/H1.
- [ ] Blind review xác nhận không giảm độ đúng toán, đủ nội dung hoặc hình vẽ.
- [ ] L3 ghi nhận cache hit và cache-warm output vẫn đạt cùng quality gate.
- [ ] Có thể rollback schema strategy, cache key và retention mà không migration hoặc
      regenerate dữ liệu.

## 11. Ngoài phạm vi

- Mọi thay đổi Quiz, Test, Flashcard, explanation hoặc chat.
- Rút gọn/diễn giải lại System prompt hay User prompt.
- Bỏ/gộp/cắt/chọn lại chunk hoặc metadata.
- Đổi model, reasoning effort, output token budget hoặc retry.
- Đổi transport/acceptance/persisted schema semantics.
- Đổi diagram compiler, mapper, recovery hoặc renderer.
- Dùng semantic compression, prompt summarization hoặc retrieval mới để giảm token.
- Tuyên bố Prompt Caching làm giảm “Tổng input”; nó chỉ giảm phần input phải xử lý
  lại/billed như uncached khi cache hit.
