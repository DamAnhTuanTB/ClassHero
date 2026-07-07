# 13. SEO and Content Discovery

File này là nguồn chuẩn cho các phần giúp dự án có khả năng được Google hiểu, crawl, index và hiển thị tốt hơn ở các trang public.

SEO không đảm bảo "lên top" ngay. Tài liệu này giúp Codex code đúng nền kỹ thuật để sau này tối ưu nội dung, đo đạc và cải thiện thứ hạng.

---

## 1. Phạm vi SEO trong MVP

Áp dụng cho các trang public:

- Landing page.
- Danh sách lộ trình public.
- Chi tiết lộ trình public.
- Tin tức/sự kiện/livestream public nếu bật trong MVP.
- Các trang nội dung có thể chia sẻ công khai.

Không index:

- Admin.
- Student dashboard, lesson, quiz, flashcard, test, profile, notification.
- Parent dashboard, children, payment, notification.
- API routes.
- Trang auth như login/register/forgot/reset, trừ khi có lý do rõ.

## 2. Nguyên tắc kỹ thuật

- Trang public quan trọng nên render được nội dung chính từ server bằng Next.js App Router.
- Không để trang SEO chính chỉ hiện shell rỗng rồi chờ client fetch mới có nội dung.
- Dùng metadata rõ cho từng route: title, description, canonical URL, Open Graph, robots.
- Public course/detail/news phải có URL ổn định, đọc được và không phụ thuộc query tạm.
- Nội dung chính phải là HTML text thật khi có thể, không render toàn bộ bằng ảnh.
- Heading phải có thứ bậc rõ: mỗi trang có một `h1`, section dùng `h2/h3` hợp lý.
- Ảnh public cần alt text mô tả đúng nội dung.
- Không nhồi keyword; ưu tiên nội dung hữu ích, rõ đối tượng học sinh/phụ huynh.
- Performance mobile vẫn là nền SEO quan trọng; đọc thêm `docs/12-performance-and-observability.md`.

## 3. Metadata tối thiểu

Mỗi trang public indexable cần xác định:

| Mục | Yêu cầu |
| --- | --- |
| `title` | Ngắn, rõ chủ đề trang, có tên lộ trình/tin tức nếu là detail |
| `description` | 1-2 câu mô tả lợi ích/nội dung chính |
| `canonical` | URL chính thức của trang |
| Open Graph | `og:title`, `og:description`, `og:image`, `og:url`, `og:type` |
| Robots | `index, follow` cho public; `noindex, nofollow` cho private/auth/admin |

Với Next.js App Router, ưu tiên dùng `metadata`, `generateMetadata`, `sitemap.ts` và `robots.ts` theo pattern của Next.js.

## 4. Sitemap, robots và canonical

Yêu cầu khi có route public thật:

- Tạo `sitemap.ts` để liệt kê landing, course list, course detail và các trang public đã publish.
- Tạo `robots.ts` để cho phép crawl public page và chặn private/admin/auth route.
- Trang detail phải có canonical trỏ về URL chính.
- Nếu có filter/sort/search trên public list, tránh tạo quá nhiều URL index trùng nội dung.
- Chỉ đưa item `published` vào sitemap.

## 5. Structured data

Khi có dữ liệu đủ rõ, dùng JSON-LD cho trang public:

- Organization/WebSite cho landing page.
- Course hoặc Product-like schema cho trang chi tiết lộ trình nếu phù hợp.
- Article/NewsArticle cho tin tức/sự kiện nếu có.
- BreadcrumbList cho trang list/detail.

JSON-LD phải lấy từ dữ liệu đã validate, không render raw input không kiểm soát.

## 6. Content và internal linking

Trang public nên có nội dung đủ giúp Google và người dùng hiểu:

- Lộ trình dành cho ai.
- Môn/lớp rõ ràng.
- Kết quả học tập kỳ vọng.
- Cấu trúc buổi học.
- Học thử hoặc CTA rõ.
- Câu hỏi thường gặp nếu thật sự hữu ích.

Internal link nên nối:

- Landing -> danh sách lộ trình.
- Danh sách lộ trình -> chi tiết lộ trình.
- Chi tiết lộ trình -> đăng ký/học thử/thanh toán.
- Tin tức/sự kiện -> lộ trình liên quan nếu có.

## 7. API và database ảnh hưởng SEO

Khi API cấp dữ liệu cho trang public indexable:

- API phải trả đủ dữ liệu SEO cần thiết: slug, title, summary/description, cover image, updated time, published status.
- Slug phải ổn định và unique theo domain phù hợp.
- Không expose dữ liệu private/chưa publish qua public endpoint.
- Query public list/detail phải có pagination, cache hoặc index phù hợp theo `docs/12-performance-and-observability.md`.

Nếu thiếu field SEO trong database/API, cập nhật docs database/API trước hoặc cùng task theo đúng scope.

## 8. Khi Codex phải đọc file này

Codex phải đọc file này khi task:

- Làm landing page, course public list/detail, news/event public.
- Thêm/sửa route public có thể được Google index.
- Thêm/sửa metadata, slug, sitemap, robots, canonical, Open Graph hoặc JSON-LD.
- Thêm/sửa API/database phục vụ nội dung public indexable.
- Review hiệu năng/UX của public page có mục tiêu SEO.

## 9. Checklist hoàn thành SEO

Với public page indexable:

- Có nội dung chính render được từ server hoặc không phụ thuộc shell rỗng client-only.
- Có title, description, canonical, Open Graph phù hợp.
- Có `index/follow` hoặc `noindex/nofollow` đúng loại trang.
- Có heading hierarchy rõ và alt text cho ảnh quan trọng.
- URL ổn định; slug không đổi tùy tiện.
- Sitemap/robots được cập nhật khi route public thật xuất hiện.
- Không index private/auth/admin/student/parent route.
- Mobile performance không bị phá bởi ảnh lớn, animation nặng hoặc fetch thừa.
- Nếu dùng structured data, JSON-LD hợp lệ và không chứa dữ liệu chưa publish.
