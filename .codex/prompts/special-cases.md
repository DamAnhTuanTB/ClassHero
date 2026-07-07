# Special-Case Prompts Cho Codex

Dùng khi task không phải một subtask tuyến tính. Mỗi lần chỉ copy một prompt và thay phần trong `<...>`.

## 1. Task Ngắn Chưa Rõ Subtask

```txt
Tôi muốn làm: <MÔ TẢ>.

Trước khi code:
- Đọc AGENTS.md và docs/09-implementation-plan.md.
- Tự map yêu cầu vào subtask gần nhất.
- Đọc docs liên quan theo Task routing map.
- Nếu có thể thuộc nhiều subtask, hỏi lại hoặc nêu ASSUMPTION.

Chỉ code khi phạm vi đã rõ. Sau khi có thay đổi file, cập nhật changelog.
```

## 2. Thêm Tính Năng Trong MVP

```txt
Hãy thêm/cài đặt tính năng trong MVP: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md, docs/01-product-scope.md, docs/09-implementation-plan.md và docs liên quan.
- Xác định subtask chứa tính năng.
- Chỉ implement phần nằm trong MVP.
- Không thêm tính năng phụ.
- Cập nhật docs nếu đổi API/database/UI/AI behavior.
- Chạy test/build liên quan và cập nhật changelog.
```

## 3. Đề Xuất Tính Năng Ngoài MVP

```txt
Tôi muốn xem xét tính năng ngoài MVP: <MÔ TẢ>.

Yêu cầu:
- Không sửa code.
- Đọc AGENTS.md và docs/01-product-scope.md.
- Trả đề xuất ngắn: mục tiêu, lý do nên/không nên, impact database/API/UI/AI/payment/notification, rủi ro, version đề xuất, docs cần sửa.
- Nếu cần tạo file, dùng docs/proposals/<slug>.md và cập nhật changelog.
```

## 4. Docs-Only Change

```txt
Hãy cập nhật tài liệu, không sửa code: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md.
- Xác định docs bị ảnh hưởng.
- Chỉ sửa tài liệu liên quan.
- Nếu thay đổi ảnh hưởng scope/architecture/API/database/AI, ghi rõ impact và TODO cần code sau.
- Cập nhật changelog và báo docs đã sửa.
```

## 5. Fix Bug

```txt
Hãy fix bug: <MÔ TẢ BUG>.

Trước khi code:
- Đọc AGENTS.md.
- Xác định module/subtask liên quan trong docs/09-implementation-plan.md.
- Đọc docs liên quan theo Task routing map.
- Tái hiện bug hoặc nói rõ vì sao chưa tái hiện được.

Yêu cầu:
- Sửa nguyên nhân gốc, không refactor rộng.
- Cập nhật docs nếu bug do contract/schema/spec sai.
- Thêm/cập nhật test nếu khả thi.
- Chạy test liên quan, cập nhật changelog, báo root cause.
```

## 6. Hotfix

```txt
Cần hotfix lỗi nghiêm trọng: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md và docs liên quan.
- Sửa tối thiểu, không refactor, không thêm tính năng.
- Tránh đổi schema; nếu bắt buộc, nêu rủi ro và rollback plan.
- Chạy test tối thiểu, cập nhật changelog, báo risk/rollback.
```

## 7. Refactor Không Đổi Hành Vi

```txt
Hãy refactor phần sau, không đổi behavior: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md và docs liên quan nếu ảnh hưởng API/database/AI.
- Không đổi public API, schema, business rule.
- Nếu cần đổi behavior, dừng lại hỏi owner.
- Giữ/bổ sung test chứng minh behavior không đổi.
- Chạy test/build liên quan và cập nhật changelog.
```

## 8. Database/Migration Change

```txt
Tôi cần đổi database schema: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md, docs/04-database-model.md, docs/09-implementation-plan.md.
- Đọc docs/05-api-contract.md nếu API bị ảnh hưởng.
- Đọc docs/06-ai-rag-spec.md nếu liên quan AI/RAG/pgvector.
- Nêu migration plan và rủi ro dữ liệu trước khi sửa.
- Cập nhật Prisma schema, migration, docs liên quan, seed/test nếu cần.
- Không drop dữ liệu nếu chưa được yêu cầu rõ.
- Chạy prisma format/validate/generate/migration check nếu có và cập nhật changelog.
```

## 9. API Contract Change

```txt
Tôi cần đổi API contract: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md và docs/05-api-contract.md.
- Đọc database/user-flow/UI docs nếu bị ảnh hưởng.
- Nêu endpoint thêm/sửa/xóa trước khi code.
- Cập nhật contract, DTO/controller/service/frontend client/Swagger/test liên quan.
- Không phá backward compatibility nếu chưa cần.
- Chạy test/build liên quan và cập nhật changelog.
```

## 10. AI/RAG Behavior Change

```txt
Tôi cần đổi AI/RAG behavior: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md, docs/06-ai-rag-spec.md, docs/04-database-model.md, docs/05-api-contract.md.
- Đọc docs/07-integration-and-env.md nếu đổi provider/model/env.
- Không gửi toàn bộ tài liệu vào prompt.
- Retrieval phải filter theo lesson_id và provider/model/dimensions.
- Output AI phải validate bằng Zod/JSON Schema.
- Cập nhật logs/cache/retrieval/prompt/schema docs nếu behavior đổi.
- Test bằng mock provider nếu có và cập nhật changelog.
```

## 11. UI/UX Change

```txt
Tôi cần làm UI: <MÔ TẢ>.

Yêu cầu:
- Đọc AGENTS.md, docs/11-ui-design-system.md, docs/08-ui-pages-and-components.md, docs/02-user-flows.md.
- Đọc docs/ui-references/approved-patterns.md nếu có pattern đã chốt liên quan.
- Đọc docs/05-api-contract.md nếu UI gọi API.
- Xác định role bị ảnh hưởng.
- Ưu tiên mobile-first nhưng phải ổn trên tablet/iPad và laptop/desktop.
- Không thay backend permission bằng UI-only guard.
- Không thêm thư viện ngoài stack nếu chưa được duyệt.
- Có loading, empty, error, disabled state nếu màn hình có data/action.
- Nếu có thể chạy app, kiểm tra browser/screenshot ở mobile và desktop; layout phức tạp kiểm tra thêm tablet/iPad.
- Nếu cần gửi owner review, lưu screenshot vào `.codex/screenshots/<ten-man-hinh>-<viewport>.png`.
- Chạy check liên quan và cập nhật changelog.
```

## 11.1. UI Shell

```txt
Hãy tạo UI shell cho frontend theo docs/11-ui-design-system.md.

Phải đọc:
- AGENTS.md
- docs/03-technical-architecture.md
- docs/08-ui-pages-and-components.md
- docs/11-ui-design-system.md
- docs/09-implementation-plan.md

Phạm vi:
- Chỉ làm frontend UI shell.
- Không connect API thật.
- Không làm business logic.

Yêu cầu:
- Setup layout public/student/parent/admin.
- Tạo common Header, PageHeader, EmptyState, LoadingState, ErrorState.
- Tạo layout responsive cho mobile, tablet/iPad, laptop/desktop.
- Dùng Tailwind + shadcn/ui.
- Nếu có thể chạy app, cung cấp URL/route để review.
- Cập nhật changelog.
```

## 11.2. Page UI Với Mock Data

```txt
Hãy implement UI màn hình: <TÊN MÀN HÌNH>.

Phải đọc:
- AGENTS.md
- docs/11-ui-design-system.md
- docs/08-ui-pages-and-components.md
- docs/02-user-flows.md
- docs/05-api-contract.md nếu màn hình có data/API.

Phạm vi:
- Chỉ làm UI với mock data rõ ràng, dễ xóa khi connect API.
- Không sửa backend/database.

Yêu cầu UI:
- Người dùng chính: <student/parent/admin/public>.
- Mục tiêu màn hình: <mục tiêu>.
- Dữ liệu hiển thị: <danh sách dữ liệu>.
- Hành động chính: <CTA/workflow>.
- Có loading, empty, error, disabled state nếu phù hợp.
- Responsive mobile, tablet/iPad, laptop/desktop.
- Nếu cần owner review, lưu screenshot vào `.codex/screenshots/<ten-man-hinh>-<viewport>.png`.
- Không thêm tính năng ngoài MVP.
- Cập nhật changelog.
```

## 11.3. Connect UI Với API

```txt
Hãy connect UI màn hình <TÊN MÀN HÌNH> với API thật. Nếu API chưa có, hãy code API đầy đủ theo phạm vi subtask/API contract rồi kết nối.

Phải đọc:
- AGENTS.md
- docs/11-ui-design-system.md
- docs/08-ui-pages-and-components.md
- docs/05-api-contract.md
- docs/02-user-flows.md

Yêu cầu:
- Giữ layout/UI hiện có, không polish lớn nếu chưa cần.
- Nếu endpoint/API chưa có, implement backend API đầy đủ theo contract và docs liên quan.
- Thay mock data bằng API client/hook phù hợp.
- Dùng TanStack Query cho server state.
- Form dùng React Hook Form + Zod nếu có validation.
- Xử lý loading, empty, error, disabled state.
- Không mở rộng backend ngoài phạm vi màn hình/subtask đang connect.
- Chạy check liên quan và cập nhật changelog.
```

## 11.4. Polish UI Theo Feedback

```txt
Hãy polish UI theo feedback sau: <FEEDBACK>.

Yêu cầu:
- Đọc AGENTS.md và docs/11-ui-design-system.md.
- Chỉ sửa UI/CSS/component layout.
- Không sửa logic/backend/database.
- Không đổi flow nếu owner không yêu cầu.
- Kiểm tra lại mobile, tablet/iPad, laptop/desktop ở phần bị ảnh hưởng.
- Nếu owner nói "ưng rồi/ok rồi/chốt UI này" sau vòng sửa, lưu pattern vào docs/ui-references/approved-patterns.md; chỉ cập nhật docs/11-ui-design-system.md nếu là rule dùng rộng.
- Cập nhật changelog.
```

## 11.5. Responsive/UI Consistency Audit

```txt
Hãy audit UI consistency cho: <MÀN HÌNH/THƯ MỤC>.

Yêu cầu:
- Đọc AGENTS.md, docs/11-ui-design-system.md và docs/08-ui-pages-and-components.md.
- Kiểm tra mobile, tablet/iPad, laptop/desktop.
- Tìm overflow, overlap, text bị cắt, spacing lệch, state thiếu, màu ngoài design system.
- Nếu lỗi nhỏ rõ ràng thì sửa luôn.
- Nếu lỗi lớn hoặc đổi flow thì báo findings trước.
- Cập nhật changelog nếu có sửa file.
```

## 12. Add Tests

```txt
Hãy thêm test cho: <MODULE/FLOW>.

Yêu cầu:
- Đọc AGENTS.md, docs/10-seed-data-and-test-cases.md và docs liên quan.
- Chọn đúng loại test: unit/API/E2E.
- Không đổi behavior chỉ để test pass.
- Mock OpenAI/payOS/R2/Resend/Zalo khi phù hợp.
- Nếu phát hiện bug, báo root cause và sửa nếu nằm trong scope.
- Chạy test liên quan và cập nhật changelog.
```

## 13. Review Trước Commit

```txt
Hãy review thay đổi hiện tại trước commit.

Yêu cầu:
- Đọc AGENTS.md.
- Không sửa code trừ lỗi nhỏ rõ ràng.
- Kiểm tra scope, stack, secret, docs database/API/AI, test/build, changelog.
- Trả findings theo mức độ nghiêm trọng, checklist, rủi ro còn lại.
```

## 14. Sửa Build/Lint/Typecheck/Test Fail

```txt
Lệnh sau đang fail: <LỆNH/LOG>.

Yêu cầu:
- Đọc AGENTS.md.
- Xác định module lỗi.
- Sửa tối thiểu để lệnh pass.
- Không refactor rộng, không skip/delete test nếu chưa có lý do hợp lệ.
- Nếu test fail do bug thật, nêu root cause.
- Chạy lại lệnh fail và cập nhật changelog.
```

## 15. Security Review

```txt
Hãy review bảo mật cho: <MODULE/FLOW>.

Yêu cầu:
- Đọc AGENTS.md và docs liên quan.
- Không sửa code ngay; trả findings trước.
- Kiểm tra RBAC/IDOR, secret leakage, file signed URL, webhook verify/idempotency, AI prompt injection nếu liên quan, rate limit endpoint nhạy cảm.
- Phân loại Critical/Major/Minor và đề xuất patch cụ thể.
```

## 16. Continue Task Đang Dở

```txt
Hãy tiếp tục task đang dở: <MÔ TẢ/SUBTASK>.

Trước khi code:
- Đọc AGENTS.md, docs/09-implementation-plan.md, changelog gần nhất.
- Kiểm tra code hiện tại và TODO.
- Nêu kế hoạch tiếp tục, không làm lại phần đã xong nếu không cần.

Chỉ tiếp tục đúng subtask, cập nhật changelog sau khi hoàn thành phần mới.
```
