# Special-Case Prompts Cho Codex

Dùng khi không gọi trực tiếp được slash skill. Nếu có skill tương ứng, ưu tiên skill.

## 1. Task Chưa Rõ Subtask

```txt
Tôi muốn làm: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md và docs/09-implementation-plan.md.
- Tự map vào subtask gần nhất.
- Đọc file milestone tương ứng trong docs/implementation/.
- Đọc docs/14-source-code-structure.md nếu task có sửa code.
- Đọc docs liên quan theo Task Routing Map.
- Nếu có thể thuộc nhiều subtask, hỏi lại hoặc ghi ASSUMPTION.
- Chỉ code khi phạm vi rõ.
```

## 2. Feature Management

Ưu tiên dùng:

```txt
/add-feature <MÔ TẢ>
/update-feature <MÔ TẢ>
/delete-feature <MÔ TẢ>
/move-feature-to-next-version <MÔ TẢ>
```

Quy tắc:

- Mặc định chỉ cập nhật docs/source of truth/roadmap/task code.
- Không code production nếu owner không nói rõ.
- Nếu thêm feature lớn, tạo/gợi ý mã task mới trong `docs/implementation/Mx.md`.
- Nếu đổi feature, sửa scope/Done/dependency của task hiện có nếu phù hợp.
- Nếu xóa feature, đánh dấu task removed/out of scope hoặc bỏ khỏi thứ tự hiện tại.
- Nếu hoãn feature, đánh dấu deferred/next version, không xóa.
- Sau khi xong, gợi ý bước tiếp theo kèm mã task nếu xác định được.

## 3. UI Work

```txt
/task-ui <MÃ SUBTASK>
/change-ui <MÀN/CHỖ CẦN SỬA>
/task-connect <MÃ SUBTASK>
```

Ghi nhớ:

- `/task-ui`: chỉ UI với mock data, không connect API thật.
- `/change-ui`: chỉ sửa UI theo feedback, không chốt docs UI cho đến khi owner nói "ưng/chốt".
- `/task-connect`: nếu API chưa có thì code API đầy đủ theo task rồi nối UI.
- UI phải mobile-first và ổn trên tablet/iPad, desktop.
- UI public/indexable phải giữ cấu trúc SEO; flow nhạy độ trễ phải đọc performance docs.
- UI code phải tuân thủ `docs/14-source-code-structure.md`: route/page compose screen, feature tách `screens/components/hooks/api/data/schemas/utils`, shared component tái sử dụng trước khi tạo mới, mỗi `.tsx` một component implementation chính.

## 4. Bug, Refactor, Commit

```txt
/fix bug <MÔ TẢ LỖI>
/refactor <MÃ TASK/TÍNH NĂNG/MODULE>
/commit
```

Ghi nhớ:

- `/fix bug`: tìm root cause, sửa nhỏ nhất, giải thích nguyên nhân và cách xử lý.
- `/refactor`: không đổi behavior/API/schema/UI design; nếu cần đổi behavior thì dùng `/update-feature`; refactor phải bám `docs/14-source-code-structure.md`.
- `/commit`: không sửa code production, chỉ kiểm tra diff, ghi changelog cho commit rồi commit.

## 5. Docs-Only Fallback

```txt
Hãy cập nhật tài liệu, không sửa code: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md.
- Xác định docs bị ảnh hưởng.
- Nếu đổi API/database/AI/UI/env, cập nhật cả index và file con tương ứng.
- Nếu đổi rule tổ chức source code, cập nhật `docs/14-source-code-structure.md`, `AGENTS.md` và skill liên quan.
- Nếu ảnh hưởng roadmap, cập nhật docs/09-implementation-plan.md hoặc docs/implementation/Mx.md.
- Không cập nhật changelog trong fallback docs-only; changelog sẽ được ghi nếu owner yêu cầu `/commit`.
```

## 6. Security/Review Fallback

```txt
Hãy review: <MODULE/FLOW/DIFF>.

Yêu cầu:
- Đọc AGENTS.md và docs liên quan.
- Không sửa code ngay nếu chưa được yêu cầu.
- Trả findings trước, ưu tiên bug/rủi ro/hồi quy/missing tests.
```
