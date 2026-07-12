# Learning Notes

Đây là sổ tay kỹ thuật sống của dự án. Mục tiêu là giúp owner không code vẫn hiểu được hệ thống đang được xây như thế nào.

## Nguyên tắc chính

- Ghi theo tính năng end-to-end trước, không chia lẻ thành frontend/backend/database riêng.
- Một note tính năng phải cho thấy bức tranh đủ rộng: UI, API, database, worker, AI hoặc integration nếu có.
- Không copy nguyên văn final response của Codex. Chỉ giữ kiến thức có giá trị lâu dài.
- Hạn chế trùng lặp: nếu kiến thức đã có, cập nhật hoặc link tới mục cũ thay vì viết lại.
- Viết dễ hiểu, có luồng code rõ ràng, nhưng không biến thành nhật ký diff.
- Với kiến thức dạng luồng xử lý, phân quyền, API, kiến trúc hoặc state flow, phải có thêm sơ đồ dễ hiểu. Ưu tiên Mermaid ngắn gọn, tách nhánh quyết định trước khi kiểm điều kiện chi tiết, đặt tên node bằng ngôn ngữ đời thường và chỉ ghi các điểm chính.

## Cấu trúc

```txt
docs/learning-notes/
├── README.md
├── index.md
├── glossary.md
├── features/
│   └── README.md
└── foundation/
    └── README.md
```

## Khi nào Codex cập nhật

Codex nên cập nhật learning notes sau `/task-full`, `/task-connect`, `/fix bug` hoặc `/refactor` khi phần giải thích kỹ thuật có giá trị học tập lâu dài.

Không bắt buộc cập nhật nếu thay đổi quá nhỏ, chỉ là wording/docs nhẹ, hoặc kiến thức đã được ghi đầy đủ ở note cũ.

## Cách chọn nơi ghi

- Tính năng end-to-end: ghi vào `docs/learning-notes/features/<ten-tinh-nang>.md`.
- Kiến thức nền dùng cho nhiều tính năng: ghi vào `docs/learning-notes/foundation/<chu-de>.md`.
- Thuật ngữ dùng lặp lại nhiều lần: ghi vào `docs/learning-notes/glossary.md`.
- Mọi note mới hoặc note được cập nhật đáng kể phải được thêm vào `docs/learning-notes/index.md`.

## Cấu trúc một note tính năng

```md
# <Tên tính năng>

## Tính năng này giải quyết gì?

## Bức tranh tổng thể

## Sơ đồ luồng dễ hiểu

## Luồng code end-to-end

## Front-end

## Back-end/API

## Database

## Worker/AI/Integration

## Luồng lỗi thường gặp

## File quan trọng

## Kiến thức cần nhớ

## Task liên quan
```

## Cấu trúc một note nền tảng

```md
# <Tên chủ đề nền tảng>

## Chủ đề này dùng để làm gì?

## Cách nó hoạt động trong repo

## Sơ đồ luồng dễ hiểu

## Luồng kỹ thuật

## Kỹ thuật chính

## File quan trọng

## Khi nào cần nhớ lại?

## Task liên quan
```
