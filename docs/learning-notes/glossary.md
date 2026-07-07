# Glossary

Giải thích ngắn các thuật ngữ kỹ thuật hay gặp trong dự án.

## API

API là lớp giao tiếp giữa front-end và back-end. Front-end gọi endpoint, back-end xử lý nghiệp vụ rồi trả dữ liệu hoặc lỗi.

## Controller

Controller trong NestJS là nơi nhận request HTTP, đọc params/body/query và chuyển việc xử lý sang service.

## DTO

DTO là kiểu dữ liệu mô tả request/response của API. DTO giúp validate input và làm contract giữa client với server rõ hơn.

## Migration

Migration là file thay đổi cấu trúc database theo phiên bản, ví dụ tạo bảng, thêm cột hoặc tạo index. Migration giúp mọi môi trường có schema giống nhau.

## Prisma

Prisma là ORM dùng để định nghĩa schema và truy cập database bằng TypeScript thay vì viết SQL thủ công cho mọi thao tác.

## PrismaService

PrismaService là service trong NestJS bọc PrismaClient để các module backend dùng chung một cách nhất quán.

## RBAC

RBAC là phân quyền theo role. Dự án dùng các role chính như `ADMIN`, `STUDENT`, `PARENT`.

## Worker

Worker là tiến trình chạy nền để xử lý việc lâu hoặc có side effect, ví dụ xử lý PDF, tạo embedding, gọi AI, gửi email/Zalo.

## Queue

Queue là hàng đợi job. API tạo job, worker lấy job ra xử lý để request của user không phải chờ tác vụ lâu.

## RAG

RAG là cách AI trả lời dựa trên tài liệu đã được hệ thống truy xuất trước. Với dự án này, AI chỉ nên lấy context theo đúng lesson hiện tại.

## Embedding

Embedding là vector số đại diện cho nội dung text. Hệ thống dùng embedding để tìm đoạn tài liệu liên quan khi học sinh hỏi AI.

## pgvector

pgvector là extension của Postgres để lưu và tìm kiếm vector embedding.
