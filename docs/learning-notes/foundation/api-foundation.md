# API Foundation

## Chủ đề này dùng để làm gì?

API foundation là lớp nền để mọi module NestJS sau này chạy cùng một chuẩn: đọc env an toàn, validate request, trả lỗi đúng envelope, có Swagger để xem contract ở dev và có logger cơ bản khi boot app.

## Cách nó hoạt động trong repo

Luồng nền tảng:

```txt
main.ts
-> AppModule
-> ConfigModule validate env
-> Global prefix /api/v1
-> ValidationPipe kiểm tra DTO
-> HttpExceptionFilter chuẩn hóa lỗi
-> Swagger dev/staging tại /api/docs
-> Controller/service/domain modules
```

## Luồng kỹ thuật

1. `AppModule` import `ConfigModule.forRoot` và gọi `validateEnv`.
2. `validateEnv` dùng Zod để parse env bắt buộc như `DATABASE_URL`, JWT secrets, `REDIS_URL`, `API_PORT`.
3. `main.ts` lấy config đã parse để bật CORS, global prefix, validation pipe, error filter, response interceptor và Swagger.
4. `PrismaService` lấy `DATABASE_URL` qua `ConfigService`, không đọc trực tiếp `process.env`.
5. Các controller sau này chỉ cần trả data hoặc ném exception; foundation sẽ lo envelope/error format chung.

## Kỹ thuật chính

- Env validation: fail fast khi thiếu biến quan trọng, tránh API chạy nửa vời rồi lỗi muộn.
- Global validation pipe: loại field lạ, transform kiểu cơ bản và trả `VALIDATION_ERROR` có `details`.
- Error envelope filter: mọi lỗi HTTP đi ra theo `{ error: { code, message, details } }`.
- Response envelope interceptor: response thành công dạng raw object được bọc thành `{ data, meta }`; response đã có envelope thì giữ nguyên.
- Swagger setup: chỉ bật ngoài production tại `/api/docs`.

## File quan trọng

- `apps/api/src/main.ts`: nơi bật global prefix, CORS, validation, filter, interceptor, Swagger và logger.
- `apps/api/src/app.module.ts`: import `ConfigModule` và `PrismaModule`.
- `apps/api/src/config/env.validation.ts`: schema env và parser CORS.
- `apps/api/src/config/swagger.ts`: cấu hình Swagger/OpenAPI.
- `apps/api/src/common/errors/http-exception.filter.ts`: chuẩn hóa lỗi API.
- `apps/api/src/common/validation/validation-error.ts`: format lỗi DTO validation.
- `apps/api/src/common/api/api-response.interceptor.ts`: bọc response thành công.

## Khi nào cần nhớ lại?

Đọc lại note này khi làm:

- auth/register/login và cần DTO validation,
- endpoint mới cần error code rõ,
- thêm env/provider mới,
- debug lỗi API boot do thiếu env,
- muốn mở Swagger docs ở local.

## Task liên quan

- `M2.1`: Backend foundation module.
