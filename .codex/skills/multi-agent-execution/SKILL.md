---
name: multi-agent-execution
description: Đánh giá và thực thi implementation plan đã được owner duyệt bằng execution profile phù hợp, từ single-agent fallback đến multi-agent, để tối ưu critical path và token mà vẫn giữ verification tương xứng rủi ro. Dùng khi owner nói "Thực thi plan hiện tại bằng multi-agent workflow", yêu cầu chạy plan lớn bằng subagent, hoặc yêu cầu coordinator điều phối implement-test-fix-review. Không dùng để tự triển khai plan chưa được owner duyệt.
---

# Multi-agent execution

Main agent là coordinator. Không spawn thêm `coordinator` một cách dư thừa khi main đã điều phối; custom agent đó dành cho trường hợp một parent workflow khác cần giao nguyên một nhánh coordination.

Mục tiêu của workflow là giảm **wall-clock time trên critical path**, không giảm
acceptance criteria, verification độc lập hoặc final review. Nhiều agent chỉ có
giá trị khi giảm dependency wait; không chia nhỏ cơ học để tạo thêm handoff.

## Điều kiện bắt đầu

- Áp dụng `AGENTS.md` đã được runtime cung cấp; đọc đúng batch/section trong
  implementation plan, milestone và docs routing thay vì bắt mọi agent tải lại
  toàn bộ context.
- Xác nhận owner đã duyệt thực thi bằng lời. Auto-approve của IDE/artifact không phải phê duyệt.
- Dùng plan hiện có làm source of truth; không tạo plan mới trùng lặp.
- Câu lệnh này cho phép delegation, không mở rộng scope, quyền ghi, external action hoặc quyền gọi paid provider.

Nếu plan có nhiều logical step và chưa có trạng thái, coordinator có thể thêm `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE` bằng thay đổi tối thiểu. Chỉ coordinator cập nhật trạng thái; subagent không sửa plan. Không rewrite plan đang có thay đổi không liên quan.

## Lập lịch trước khi spawn

Coordinator phải làm một scheduling pass ngắn trước khi giao việc:

- Chia plan thành batch theo dependency và ownership, không theo số file tùy ý.
- Xác định critical path, shared contract/migration/generated artifact và batch có
  thể chạy độc lập.
- Làm ổn định shared contract tối thiểu trước; sau đó mới mở các lane API/worker,
  web hoặc test độc lập dựa trên contract đó.
- Gắn cho mỗi batch: input đã ổn định, file/module ownership, acceptance criteria,
  targeted check và điều kiện làm invalid kết quả test cũ.
- Ưu tiên batch nằm trên critical path. Không để slot agent bị chiếm bởi task ít
  quan trọng trong khi batch chặn toàn workflow đang chờ.

Lệnh multi-agent của owner cho phép coordinator đánh giá và delegation, không bắt
buộc phải spawn khi subagent không tạo thêm giá trị. Coordinator phải nêu execution
profile đã chọn trước khi implementation nặng bắt đầu.

## Chọn execution profile

Chọn profile nhỏ nhất vẫn đủ tin cậy:

- `SINGLE_AGENT_FALLBACK`: task nhỏ, low-risk, một write lane ngắn, ownership tập
  trung và không cần independent review để đạt acceptance criteria. Main/root tự
  implement, chạy proportional checks và self-review; không spawn subagent.
- `LEAN_MULTI_AGENT`: chỉ có một write lane nhưng task đủ lớn hoặc rủi ro cần kiểm
  chứng độc lập. Chạy tuần tự `IMPLEMENTER -> TESTER -> REVIEWER final`; không mở
  lane song song và không spawn fixer nếu follow-up implementer đủ xử lý.
- `MULTI_LANE`: có ít nhất hai workstream độc lập sau khi shared contract ổn định,
  hoặc read-only test/review có thể cuốn chiếu để giảm critical path. Áp dụng toàn
  bộ scheduling, song song và completion gate của skill.

Không dùng `SINGLE_AGENT_FALLBACK` cho auth/RBAC, payment, security, data
integrity, migration/schema, API contract phức tạp, worker/concurrency, paid
provider hoặc behavior production nhiều module. Nếu chưa chắc giữa hai profile,
chọn profile có verification độc lập cao hơn.

## Routing state machine

Cho từng logical batch:

```text
PLAN -> IMPLEMENTER -> TESTER
                       | PASS -> step kế tiếp
                       | FAIL + root cause rõ -> IMPLEMENTER follow-up/FIXER -> TESTER
                       | FAIL + root cause chưa rõ -> REVIEWER -> FIXER/IMPLEMENTER -> TESTER
```

Escalate sang `reviewer` khi có ít nhất một điều kiện:

- root cause chưa rõ;
- architecture, security, data integrity, migration hoặc concurrency/race condition;
- API contract phức tạp hoặc regression khó xác định;
- cần quyết định thiết kế mới;
- implementer/fixer đã thử cùng một hướng tối đa 2 lần nhưng vẫn fail.

Khi root cause rõ và lỗi vẫn thuộc ownership của implementer vừa làm batch, ưu
tiên follow-up đúng implementer đó để giữ context. Dùng `fixer` khi cần một patch
độc lập, implementer cũ không còn phù hợp, hoặc remediation sau review chạm phạm
vi rõ khác. Sau fix, follow-up tester đã chạy batch để retest bằng delta context.

Khi reviewer đã đưa remediation rõ, giao implementation lại cho `fixer` hoặc `implementer`. Reviewer không làm patch cơ học.

Sau khi mọi step pass:

```text
REVIEWER final review
  -> không còn CRITICAL/MAJOR: FINAL COMPLETE
  -> có CRITICAL/MAJOR: FIXER/IMPLEMENTER -> TESTER -> REVIEWER
  -> lặp đến khi reviewer xác nhận không còn CRITICAL/MAJOR
```

Không tự sửa MINOR ở vòng cuối trừ khi owner yêu cầu hoặc nó chặn acceptance criteria.

## Song song an toàn

Coordinator phải chủ động tìm song song an toàn, nhưng chỉ mở tối đa hai
write-capable lane cùng lúc và chỉ khi tất cả điều kiện sau đều đúng:

- ownership file/module không giao nhau;
- shared type, API contract, schema và migration đầu vào đã ổn định;
- không có dependency trực tiếp giữa hai batch;
- không cùng sinh/chạm generated file, snapshot hoặc artifact dùng chung;
- merge hai kết quả không cần một agent âm thầm sửa ownership của agent kia.

Trong khi một writer làm batch kế tiếp, `tester` hoặc `reviewer` có thể xử lý batch
đã ổn định ở lane khác nếu command không tranh port, database, generated output
hoặc tài nguyên nặng. Read-only discovery, code review và các focused check độc
lập nên chạy song song khi còn slot.

Luôn chạy tuần tự đối với shared contract chưa ổn định, migration phụ thuộc nhau,
code generation, cùng test database/port, full build nặng và paid-provider smoke.
Nếu phát hiện overlap ngoài dự kiến, coordinator dừng lane đến sau, cập nhật
ownership rồi mới tiếp tục; không để hai agent tự hòa giải cùng một file.

## Giao việc và giữ context

Mỗi task giao cho agent phải ghi rõ objective, ownership file/module, input/contract, acceptance criteria, checks và format kết quả. Ưu tiên context tối thiểu đủ dùng; yêu cầu agent trả summary thay cho log dài.

Tái sử dụng cùng agent bằng follow-up cho các batch liên tiếp trong cùng module để
giữ context và giảm thời gian đọc lại. Chỉ spawn agent mới khi cần lane độc lập,
vai trò khác hoặc context cũ không còn phù hợp. Coordinator cung cấp section docs
và invariant chính xác cần đọc; không bắt mọi agent dò lại toàn repo nếu routing
đã rõ.

Không vượt `agents.max_concurrent_threads_per_session`; không tạo delegation lồng
nhau nếu main có thể giao trực tiếp. Không để agent idle giữ slot khi chưa có input
ổn định hoặc chưa thể làm việc hữu ích.

## Kỷ luật token

Giảm token bằng cách loại bỏ context và output trùng lặp, không bằng cách hạ quality
gate hoặc bỏ reasoning cần thiết:

- Khi spawn, mặc định dùng `fork_turns="none"` hoặc số turn nhỏ nhất đủ dùng và gửi
  một task brief tự chứa. Chỉ fork toàn bộ lịch sử khi agent thực sự cần chuỗi quyết
  định hội thoại mà task brief không thể truyền đạt an toàn.
- Với `SINGLE_AGENT_FALLBACK`, không spawn agent chỉ để giữ hình thức multi-agent;
  main/root dùng đúng lean/proportional verification của skill gốc đang thực thi.
- Task brief chỉ gồm objective, ownership, contract/invariant đã chốt, exact docs
  section/code entrypoint cần đọc, dependency đã ổn định, acceptance criteria và
  checks. Không paste toàn bộ plan, docs, chat hoặc log nếu agent có thể đọc đúng
  file/section tại workspace.
- Mỗi agent phải tạo một deliverable duy nhất có ích. Không spawn nhiều agent để
  cùng discovery/review một phạm vi khi chưa có rủi ro cần ý kiến độc lập.
- Tái sử dụng agent cho batch kế tiếp trong cùng module; follow-up chỉ gửi delta
  từ lần giao trước, không lặp lại toàn bộ context packet.
- Với fix/retest cục bộ, ưu tiên follow-up implementer và tester đang giữ context;
  không spawn agent mới chỉ để lặp lại cùng ownership và command.
- Kết quả agent phải ngắn: summary, files/symbols, command + exit code, finding và
  next action. Không trả raw log dài, toàn bộ diff, nội dung docs đã đọc hoặc kể lại
  từng bước suy luận. Khi command lỗi, chỉ lấy đoạn lỗi đủ tái hiện.
- Coordinator giữ một evidence ledger ngắn theo batch, files, checks, invalidation
  và review findings; agent sau nhận đúng phần ledger liên quan thay vì đọc lại
  mọi handoff trước đó.
- Dùng đúng role/model đã cấu hình: tester cho deterministic checks, fixer khi
  remediation rõ, reviewer chỉ ở escalation/risk gate và final review. Không dùng
  reviewer mạnh cho discovery, lint, format hoặc xác nhận cơ học.
- Giới hạn output tool bằng file/path/test liên quan và mức log cần thiết. Không
  in toàn bộ test suite, git diff hoặc file lớn khi một filter/section đủ làm bằng
  chứng.

Nếu runtime cung cấp usage theo agent/batch, coordinator ghi nhận usage bất thường
và bottleneck trong final response; không tự đặt hard token cap khiến agent dừng
trước acceptance criteria.

Ngay từ khi chọn profile và mỗi lần spawn/follow-up, coordinator ghi vào evidence
ledger: role/thread, batch, model, reasoning effort, trạng thái spawn hay reuse và
kết quả. Ưu tiên giá trị effective do runtime trả về; nếu runtime không cung cấp,
dùng giá trị configured và ghi rõ nhãn `configured`, không suy đoán thành
`effective`.

## Verification theo tầng

Giữ chất lượng bằng gate theo tầng thay vì lặp full suite sau mỗi patch:

1. `IMPLEMENTER` chạy check rẻ nhất đủ bắt syntax/type hoặc lỗi cục bộ của batch.
2. `TESTER` chạy targeted test trực tiếp phủ acceptance criteria của batch.
3. Khi fail, cô lập bằng command nhỏ nhất tái hiện được; chỉ mở rộng suite sau khi
   lỗi gốc đã pass.
4. Coordinator ghi command đã pass và phạm vi file/dependency mà nó bảo chứng.
   Không chạy lại cùng command nếu phần đó không bị thay đổi; retest khi source,
   shared contract, fixture, config hoặc dependency liên quan bị invalidated.
5. Typecheck/lint/build toàn package, integration/E2E liên quan và final reviewer
   chạy ở completion gate sau khi các batch đã hội tụ. Không chạy full build lặp
   lại ở từng handoff trừ khi batch có rủi ro build-only cụ thể.

Ưu tiên cache và deterministic local test để ổn định harness trước.
Paid-provider/live smoke chỉ chạy sau khi deterministic gate pass; khi owner
yêu cầu live test, coordinator phải chọn bộ case cần thiết đủ bao phủ các
trường hợp chính và rủi ro quan trọng trong live acceptance matrix, không
chọn sample nhỏ nhất theo chi phí. Có thể gộp case tương đương khi ghi rõ lý
do coverage. Artifact/cache chỉ thay thế được case cache/reuse hoặc phần
provider không đổi. Nếu budget guard chặn case cần thiết, ghi `Not run` và
không báo completion gate pass.

Batch có migration, security, data integrity hoặc API contract khó có thể được
`REVIEWER` review sớm ngay khi ổn định, song song với implementation độc lập khác.
Final review vẫn bắt buộc, nhưng reviewer dùng bằng chứng review trước và tập trung
vào diff mới, integration boundary và regression toàn cục thay vì đọc lại cơ học
phần không đổi.

## Completion gate

Mọi profile chỉ báo hoàn tất khi scope/acceptance criteria đã đạt, check tương xứng
rủi ro pass bằng output thật và mọi thay đổi sau check đã được đánh giá invalidation.

Với `SINGLE_AGENT_FALLBACK`, theo completion/verification của task skill gốc và
self-review của main/root; không yêu cầu tạo tester/reviewer chỉ để đóng gate.

Với `LEAN_MULTI_AGENT` và `MULTI_LANE`, chỉ báo hoàn tất khi:

- mọi logical step cần thiết đã `DONE`;
- targeted verification pass bằng exit code/output thật;
- các kết quả verification bị invalidated đã được chạy lại;
- package-level/full integration gate cần thiết đã pass sau khi các lane hội tụ;
- final reviewer đã xác nhận không còn CRITICAL/MAJOR sau vòng fix/retest gần nhất;
- mọi fix sau review đã được tester retest;
- không còn agent đang chạy hoặc kết quả chưa được thu thập.

## Báo cáo thực thi bắt buộc

Final response phải có một mục ngắn `Multi-agent execution report` gồm:

- profile đã chọn (`SINGLE_AGENT_FALLBACK`, `LEAN_MULTI_AGENT` hoặc `MULTI_LANE`)
  và lý do lựa chọn;
- main/root model và reasoning effort nếu runtime cho biết; nếu không, ghi
  `runtime không cung cấp`;
- từng subagent đã dùng: role/thread, batch phụ trách, model, reasoning effort,
  spawn mới hay reuse/follow-up và kết quả cuối;
- peak concurrent subagents và peak concurrent writer lanes;
- verification/final-review status, finding MINOR còn lại và bottleneck/TODO;
- token/usage theo agent hoặc tổng nếu runtime cung cấp; nếu không, ghi rõ không có
  số liệu thay vì ước đoán;
- paid-provider usage nếu có.

Với `SINGLE_AGENT_FALLBACK`, vẫn phải ghi profile và `Subagents: không dùng`; không
tạo bảng agent rỗng hoặc spawn agent chỉ để có dữ liệu báo cáo. Với hai profile còn
lại, có thể dùng bảng ngắn, mỗi thread một dòng; không paste log hay lặp lại toàn
bộ handoff.
