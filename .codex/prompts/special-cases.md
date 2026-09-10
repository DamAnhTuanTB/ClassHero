# Special-Case Prompt Fallbacks

Chỉ dùng khi slash skill tương ứng không khả dụng.

## Task chưa rõ mã

```txt
Tôi muốn làm: <MÔ TẢ>.

Dùng AGENTS.md và docs/00-docs-map.md để map vào subtask/Mode gần nhất. Đọc đúng
block milestone và contract section liên quan. Nếu có nhiều cách hiểu làm đổi
scope, hỏi một câu ngắn; chỉ code khi phạm vi đã đủ rõ.
```

## Docs-only

```txt
Hãy cập nhật tài liệu, không sửa production code: <MÔ TẢ>.

Xác định source of truth và các index/routing bị ảnh hưởng; giữ API/database/AI/UI/
env/roadmap nhất quán. Không cập nhật changelog hoặc commit nếu tôi chưa yêu cầu.
```

## Review-only

```txt
Hãy review <MODULE/FLOW/DIFF>, chưa sửa code.

Đọc đúng contract và code/test liên quan. Trả findings theo mức độ, kèm evidence,
affected path và missing verification; không suy đoán khi thiếu dữ liệu.
```

Các trường hợp khác dùng skill: `/fix bug`, `/refactor`, `/change-ui`,
`/task-connect`, `/review-docs` hoặc `/commit`.
