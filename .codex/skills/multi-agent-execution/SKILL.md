---
name: multi-agent-execution
description: Thực thi implementation plan đã được owner duyệt bằng multi-agent workflow tiết kiệm quota. Dùng khi owner nói "Thực thi plan hiện tại bằng multi-agent workflow", yêu cầu chạy plan lớn bằng subagent, hoặc yêu cầu coordinator điều phối implement-test-fix-review. Không dùng để tự triển khai plan chưa được owner duyệt hoặc cho task nhỏ không cần delegation.
---

# Multi-agent execution

Main agent là coordinator. Không spawn thêm `coordinator` một cách dư thừa khi main đã điều phối; custom agent đó dành cho trường hợp một parent workflow khác cần giao nguyên một nhánh coordination.

## Điều kiện bắt đầu

- Đọc `AGENTS.md`, implementation plan/execution plan hiện có, milestone và docs theo routing map.
- Xác nhận owner đã duyệt thực thi bằng lời. Auto-approve của IDE/artifact không phải phê duyệt.
- Dùng plan hiện có làm source of truth; không tạo plan mới trùng lặp.
- Câu lệnh này cho phép delegation, không mở rộng scope, quyền ghi, external action hoặc quyền gọi paid provider.

Nếu plan có nhiều logical step và chưa có trạng thái, coordinator có thể thêm `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE` bằng thay đổi tối thiểu. Chỉ coordinator cập nhật trạng thái; subagent không sửa plan. Không rewrite plan đang có thay đổi không liên quan.

## Routing state machine

Cho từng logical step:

```text
PLAN -> IMPLEMENTER -> TESTER
                       | PASS -> step kế tiếp
                       | FAIL + root cause rõ -> FIXER -> TESTER
                       | FAIL + root cause chưa rõ -> REVIEWER -> FIXER/IMPLEMENTER -> TESTER
```

Escalate sang `reviewer` khi có ít nhất một điều kiện:

- root cause chưa rõ;
- architecture, security, data integrity, migration hoặc concurrency/race condition;
- API contract phức tạp hoặc regression khó xác định;
- cần quyết định thiết kế mới;
- implementer/fixer đã thử cùng một hướng tối đa 2 lần nhưng vẫn fail.

Khi reviewer đã đưa remediation rõ, giao implementation lại cho `fixer` hoặc `implementer`. Reviewer không làm patch cơ học.

Sau khi mọi step pass:

```text
REVIEWER final review
  -> không còn CRITICAL/MAJOR: FINAL COMPLETE
  -> có CRITICAL/MAJOR: FIXER/IMPLEMENTER -> TESTER -> REVIEWER
  -> lặp đến khi reviewer xác nhận không còn CRITICAL/MAJOR
```

Không tự sửa MINOR ở vòng cuối trừ khi owner yêu cầu hoặc nó chặn acceptance criteria.

## Giao việc và song song

Mỗi task giao cho agent phải ghi rõ objective, ownership file/module, input/contract, acceptance criteria, checks và format kết quả. Ưu tiên context tối thiểu đủ dùng; yêu cầu agent trả summary thay cho log dài.

Mặc định một write-capable agent tại một thời điểm. Chỉ chạy song song khi các task độc lập, không sửa cùng file/shared contract và không có dependency trực tiếp. Read-only exploration hoặc test độc lập có thể song song nếu không tranh tài nguyên. Không vượt `agents.max_concurrent_threads_per_session`; không tạo delegation lồng nhau nếu main có thể giao trực tiếp.

## Completion gate

Chỉ báo hoàn tất khi:

- mọi logical step cần thiết đã `DONE`;
- targeted verification pass bằng exit code/output thật;
- final reviewer đã xác nhận không còn CRITICAL/MAJOR sau vòng fix/retest gần nhất;
- mọi fix sau review đã được tester retest;
- không còn agent đang chạy hoặc kết quả chưa được thu thập.

Final response phải tóm tắt batch đã làm, verification, final review, finding MINOR còn lại, blocker/TODO và paid-provider usage nếu có.
