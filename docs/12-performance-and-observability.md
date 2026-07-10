# 12. Performance And Observability

File này là chuẩn hiệu năng và đo đạc cho toàn hệ thống. Nó bổ sung cho `docs/11-ui-design-system.md`: file 11 tập trung vào cảm giác UI/mobile, file này bao phủ frontend, API, database, worker, AI/RAG và observability.

Mục tiêu: Codex không chỉ code "chạy được", mà phải code theo hướng nhanh, đo được, dễ phát hiện chậm và không tạo bottleneck sớm.

---

## 1. Nguyên tắc chung

- Không tối ưu mù. Với thay đổi quan trọng, phải có cách đo hoặc ít nhất có lý do kỹ thuật rõ.
- Tối ưu theo đường đi thật của người dùng: landing/course list, auth, lesson, quiz/flashcard/test, payment, AI chat, parent dashboard, admin CRUD.
- Ưu tiên perceived performance: phản hồi UI ngay, skeleton ổn định, API/job có trạng thái rõ.
- Không dùng thêm cache, queue, index hoặc abstraction phức tạp nếu chưa có bottleneck hoặc nhu cầu rõ.
- Task nhỏ có thể dùng lean mode, nhưng task chạm performance của flow chính phải ghi rõ check đã chạy hoặc `Not run`.

---

## 2. Performance budget mặc định

Các con số dưới đây là mục tiêu định hướng, không phải lý do để trì hoãn MVP khi chưa có đủ hạ tầng đo.

| Hạng mục                    | Mục tiêu MVP                                                           |
| --------------------------- | ---------------------------------------------------------------------- |
| Mobile LCP                  | Hướng tới tốt theo Core Web Vitals                                     |
| Mobile INP                  | Tương tác chính phản hồi nhanh, không lag rõ                           |
| CLS                         | Thấp; skeleton/placeholder không làm layout nhảy mạnh                  |
| API read phổ biến           | p95 nên hướng tới dưới `500ms` khi không gọi provider ngoài            |
| API write phổ biến          | p95 nên hướng tới dưới `800ms` khi không có side effect nặng           |
| Endpoint gọi provider ngoài | Trả job/status hoặc pending state nếu có thể lâu                       |
| List/table                  | Phải phân trang, infinite query hoặc virtualize khi dữ liệu có thể dài |
| Database query chính        | Có index cho filter/sort/search thường dùng                            |

Nếu chưa đo được p95, Codex phải dùng check thay thế hợp lý: curl timing, log duration, browser Network tab, Lighthouse hoặc test focused.

---

## 3. Frontend performance

Codex phải ưu tiên:

- Next.js route/page nhỏ, tách component theo feature.
- Lazy load phần nặng hoặc ít dùng như editor, chart, AI panel, admin tool.
- TanStack Query cho cache, `staleTime`, prefetch, mutation pending và invalidate.
- Debounce search/filter/input gọi API liên tục.
- Pagination/infinite query/virtualization cho danh sách dài.
- Tối ưu image: kích thước phù hợp mobile, responsive image, lazy load ảnh ngoài viewport.
- Font tải gọn, tránh nhiều font/weight không cần thiết.
- Không render toàn bộ data lớn trong client component.
- Không dùng animation trên thuộc tính gây layout/reflow nặng; ưu tiên transform/opacity.

Khi connect API:

- UI phải có pending state ngay khi mutation bắt đầu.
- Không optimistic UI cho payment, auth, permission hoặc dữ liệu cần xác nhận server nghiêm ngặt.
- Query key phải rõ theo domain/user/role để tránh cache sai dữ liệu.
- Error state phải cho retry hoặc hướng xử lý thân thiện nếu phù hợp.

---

## 4. Backend/API performance

Codex phải ưu tiên:

- API list phải có pagination mặc định.
- Controller mỏng; service chứa nghiệp vụ; DB/provider đi qua service/repository phù hợp.
- Không xử lý tác vụ nặng trong request nếu có thể enqueue job BullMQ.
- Prisma query chỉ `select/include` field cần dùng.
- Tránh N+1 query; gom query hoặc dùng relation/select hợp lý.
- Không tin filter/sort từ client nếu gây query quá rộng; validate input và giới hạn page size.
- Endpoint có side effect nặng phải có timeout/error rõ.
- Log duration cho endpoint/job quan trọng khi hạ tầng logging sẵn sàng.

Các flow cần chú ý độ trễ:

- Login/register/refresh.
- Course list/detail.
- Lesson content.
- Quiz/test submit.
- Payment create/status/webhook.
- Notification list/bell.
- AI chat/generate/job status.

---

## 5. Database performance

Codex phải kiểm tra index khi thêm hoặc sửa query chính:

- Filter/sort theo `user_id`, `course_id`/`learning_path_id`, `chapter_id`, `lesson_id`, `status`, `created_at`, `updated_at`.
- Unique/idempotency key cho payment/webhook/job/cache.
- Enrollment active lookup.
- Notification recipient/time.
- Attempt/progress theo student/course/chapter/lesson.
- Report moderation status.
- Vector index cho embedding search khi triển khai pgvector.

Rules:

- Không query bảng lớn không phân trang.
- Không trả JSON/blob/rich text lớn nếu màn chỉ cần metadata.
- Không join/include nhiều quan hệ nếu UI không dùng.
- Course detail query có thể trả cây `chapters -> lessons`, nhưng chỉ trả metadata cần cho UI; tài liệu/rich text lớn của lesson phải lazy-load ở lesson detail.
- Với query phức tạp, cân nhắc raw SQL có kiểm soát và ghi rõ lý do.
- Migration thêm index phải được commit cùng thay đổi schema/query liên quan.

---

## 6. Worker, queue và integration performance

Tác vụ nên dùng worker/job:

- PDF extract/chunking.
- Embedding.
- AI generate quiz/flashcard/test/summary.
- Email/Zalo notification.
- Ảnh minh họa/render nặng nếu có.

Rules:

- API tạo job nên trả `202 Accepted` hoặc response có `jobId` khi xử lý lâu.
- UI phải poll/refetch hoặc nhận realtime status nếu flow cần.
- Job phải idempotent khi có thể.
- Job status phải đủ để UI hiển thị pending/success/error/retry.
- Không để worker lỗi âm thầm; lỗi phải lưu log/status phù hợp.

---

## 7. AI/RAG performance

AI là phần dễ tạo độ trễ và chi phí cao, nên Codex phải:

- Không gọi AI đồng bộ cho tác vụ generate nặng nếu có thể dùng job.
- Không gửi toàn bộ PDF/tài liệu mỗi lần hỏi.
- Retrieval chỉ lấy context cần thiết theo `lesson_id`; không có retrieval cấp chapter ở MVP.
- Cache AI explanation theo item khi docs đã quy định.
- Giới hạn số chunk/context đưa vào model.
- Validate structured output trước khi lưu.
- Có fallback/error state thân thiện khi provider chậm/lỗi.
- Ghi log usage/duration khi module AI log đã có.

---

## 8. Observability

Khi hạ tầng logging/monitoring được triển khai, cần có:

- Request duration theo endpoint.
- Error rate theo endpoint/job/provider.
- Slow query hoặc query duration cho flow nhạy cảm.
- Job duration, retry count, failed reason.
- AI provider latency, token/usage nếu có.
- Payment webhook verify/idempotency logs.
- Basic health check cho API/worker/Redis.

MVP chưa cần dashboard phức tạp ngay, nhưng code nên có điểm gắn log/metric rõ ở service/job/provider quan trọng.

---

## 9. Verification checklist

Khi task có ảnh hưởng performance, Codex nên chạy hoặc ghi rõ nếu bỏ qua:

- Frontend: browser check, Lighthouse/Web Vitals nếu app chạy được, hoặc ít nhất responsive + interaction check.
- API: curl timing, focused API test, log duration hoặc static review query path.
- Database: kiểm tra index/constraint liên quan query mới.
- Worker: job enqueue/status/error path.
- AI/RAG: cache/retrieval limit/provider timeout/error state.
- Bundle/dependency: không thêm package nặng nếu có cách nhẹ hơn.

Final response nên ghi ngắn:

```txt
Performance: checked <what> / Not run: <reason>
```

Không cần chạy full performance audit cho mọi task nhỏ; áp dụng theo rủi ro và bề mặt thay đổi.
