# ADR-0003 - Local Dev File Storage

Date: 2026-07-10
Status: Accepted

## Context

Dự án cần upload PDF, ảnh editor, ảnh câu hỏi, avatar và các file học tập. Contract ban đầu chọn Cloudflare R2 cho file storage chính, nhưng local/dev không nên bắt buộc mỗi dev phải có tài khoản Cloudflare để chạy flow upload.

## Decision

Local/dev mặc định dùng MinIO trong Docker làm object storage S3-compatible.

Staging/production vẫn dùng Cloudflare R2. Code upload/download phải đi qua một storage service/adapter chung và chọn provider bằng `FILE_STORAGE_PROVIDER`.

## Consequences

- Dev có thể upload/download file thật trên máy local, không cần Cloudflare R2 khi lập trình thường ngày.
- Flow kỹ thuật vẫn gần production vì MinIO và R2 đều dùng S3-compatible API.
- Database cần ghi `FileProvider` phù hợp: `MINIO_LOCAL` cho local/dev và `CLOUDFLARE_R2` cho staging/production.
- Production không chạy MinIO trên VPS; file storage chính vẫn là Cloudflare R2.
