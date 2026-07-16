# ADR-0002 - Source Code Structure Contract

Date: 2026-07-10
Status: Accepted

## Context

Dự án đã có nhiều milestone front-end/back-end, nhưng tài liệu trước đây chưa đủ chi tiết về cách đặt file, tách component, tách helper, tổ chức feature folder, module back-end và shared layer. Điều này khiến code dễ bị gom nhiều component/helper/schema/mock data vào một file, UI pattern bị tạo lại không đồng nhất và back-end module root bị phẳng, khó bảo trì khi feature tăng lên.

## Decision

Tạo `docs/14-source-code-structure.md` làm contract bắt buộc cho tổ chức source code.

Các workflow code-producing phải đọc file này trước khi sửa code hoặc di chuyển file. `AGENTS.md`, docs map, architecture docs, UI docs, implementation plan, Codex context, prompts và các skill chính phải trỏ về contract này.

Quy tắc cốt lõi:

- Front-end tách theo route/page, feature screen, component, hook, API client, schema, data, type và utility.
- Component dùng chung đặt ở shared layer; component chỉ dùng một màn đặt trong `screens/<screen>/components`.
- Mỗi file `.tsx` chỉ chứa một component implementation chính; tránh barrel/re-export file nếu chỉ dùng để gom import cho tiện. Screen entry `index.tsx` là ngoại lệ hợp lệ vì nó là file màn hình chính, không phải file chỉ export lại.
- Back-end module root chỉ giữ `*.module.ts`; controller/service/DTO/select/serializer/utils/types tách theo folder trách nhiệm.
- HTTP exception và Prisma error mapping dùng `apps/api/src/common/errors`.
- Import nội bộ dùng `@/...` trong web và `#api/...` trong API.

## Consequences

Code mới sẽ cần nhiều file nhỏ hơn, nhưng dễ đọc, dễ tái sử dụng, dễ nối API, dễ review và ít tạo UI/backend pattern trùng lặp.

Codex phải dành thêm một bước nhỏ trước khi code để chọn đúng layer và kiểm tra pattern đã có. Nếu task rất nhỏ, vẫn được dùng lean mode, nhưng không được vi phạm boundary cấu trúc đã chốt.
