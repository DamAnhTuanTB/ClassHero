# Approved UI Patterns

File này lưu các pattern UI đã được owner xác nhận là đúng ý.

Chỉ ghi vào đây sau khi owner nói rõ kiểu như:

- "ưng rồi"
- "ok rồi"
- "đúng ý rồi"
- "chốt UI này"
- "giữ style này"

## Cách dùng

- Ghi pattern cụ thể theo màn hình, role hoặc flow.
- Không biến mọi feedback nhỏ thành design system toàn cục.
- Chỉ cập nhật `docs/11-ui-design-system.md` nếu owner chốt một nguyên tắc áp dụng rộng cho nhiều màn.
- Ghi ngắn, dễ tái sử dụng cho lần làm UI sau.

## Template

```md
## <Screen/Flow> - <YYYY-MM-DD>

- Context: <public/student/parent/admin + màn hình/flow>
- Approved:
  - <điểm UI đã được owner chốt>
  - <layout/spacing/color/component/interaction đáng tái sử dụng>
- Avoid:
  - <điểm owner không thích hoặc đã sửa bỏ>
- Reuse for:
  - <màn hình/flow tương tự có thể áp dụng>
- Evidence:
  - Screenshot: `.codex/screenshots/<file>.png` nếu có
  - Files: `<path>` nếu hữu ích
```

