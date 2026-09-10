# Core Prompt Fallbacks

Chỉ dùng khi không gọi được slash skill. Skill tương ứng và `AGENTS.md` là nguồn
workflow; không chép lại toàn bộ guardrail vào prompt.

## Commands ưu tiên

```txt
/task-full plan Mx.y    lập plan có approval gate
/task-full Mx.y         làm trọn subtask
/task-ui Mx.y           làm UI/mock
/change-ui ...          sửa UI theo feedback
/task-connect Mx.y      nối UI đã chốt với API thật
/fix bug ...            sửa root cause nhỏ nhất
/refactor ...           refactor không đổi behavior
/review-docs            audit docs/skill
/commit                 commit và ghi changelog
```

## Fallback cho subtask

```txt
Hãy làm <MÃ SUBTASK>: <MÔ TẢ>.

Áp dụng AGENTS.md và docs/00-docs-map.md. Đọc trọn block <MÃ SUBTASK> trong
docs/implementation/Mx.md, đúng contract section theo bề mặt thay đổi, cùng code,
call site và test hiện tại. Giữ đúng Mode/scope, nêu plan ngắn trước khi sửa, tái
sử dụng pattern hiện có và chạy check tương xứng rủi ro. Chỉ cập nhật docs khi
contract đổi; không commit hoặc ghi changelog nếu tôi chưa yêu cầu /commit.
```

Feature management dùng `/add-feature`, `/update-feature`, `/delete-feature` hoặc
`/move-feature-to-next-version`; mặc định các lệnh này chỉ sửa docs/roadmap.
