# Hệ thống học theo lộ trình

Dự án MVP cho hệ thống học theo lộ trình, gồm front-end Next.js, back-end NestJS và package shared dùng chung trong một monorepo Turborepo.

## Cần cài trước

- Node.js
- pnpm `11.10.0`

Nếu chưa có pnpm:

```bash
npm install --global pnpm@11.10.0
```

## Cài dependencies

```bash
pnpm install
```

## Chạy local

Chạy cả front-end và back-end:

```bash
pnpm dev
```

Mở trên trình duyệt:

```txt
Front-end: http://localhost:3000
Back-end:  http://localhost:4000
```

Chạy riêng từng phần:

```bash
pnpm --filter @learning-path/web dev
pnpm --filter @learning-path/api dev
```

## Lệnh kiểm tra

```bash
pnpm typecheck
pnpm build
pnpm lint
```

Lưu ý: lint hiện mới là placeholder, phần ESLint/Prettier sẽ làm ở subtask `M0.2`.

## Cấu trúc chính

```txt
apps/web         Next.js front-end
apps/api         NestJS back-end
packages/shared  Type/schema/constant dùng chung
docs/            Tài liệu sản phẩm và kỹ thuật
.codex/          Plan, prompt, skill và changelog cho Codex
```

## Tài liệu quan trọng

Trước khi code, Codex sẽ bám theo các file chính:

```txt
AGENTS.md                         Quy tắc cao nhất cho Codex
docs/09-implementation-plan.md     Danh sách milestone/subtask
docs/11-ui-design-system.md        Gu UI, token, responsive, screenshot review
docs/ui-references/                Reference UI và pattern đã được duyệt
.codex/plans/codex-execution-plan.md  Kế hoạch thực thi/phụ thuộc nếu đã tạo
.codex/changelog/                 Changelog ngắn sau mỗi thay đổi
```

## Cách làm việc với Codex bằng skill

Giao việc theo mã subtask bằng 1 trong 3 lệnh:

```txt
/task-ui M3.4       # Làm UI với mock data trước
/task-connect M3.4  # Kết nối UI đã làm với API thật
/task-full M0.2     # Làm trọn task theo phạm vi docs/09
```

Ngoài ra còn có:

```txt
/fix bug <mô tả lỗi>  # Sửa bug, nói nguyên nhân và cách xử lý
/commit               # Tự kiểm tra diff/changelog rồi commit
```

Codex sẽ đọc tài liệu liên quan trước khi code, giữ đúng MVP/stack, cập nhật changelog sau khi xong và gợi ý bước tiếp theo.

## Quy trình chuẩn của từng skill

### `/task-ui <mã task>`

Dùng khi muốn làm giao diện trước bằng mock data.

Codex sẽ:

1. Đọc `AGENTS.md`, `docs/09-implementation-plan.md`, UI docs và flow/API liên quan.
2. Kiểm tra task có UI hay không. Nếu không có UI, Codex dừng và gợi ý lệnh đúng hơn.
3. Code UI mobile-first, vẫn ổn trên tablet/iPad và desktop.
4. Dùng mock data rõ ràng, dễ xóa khi connect API.
5. Nếu app chạy được, kiểm tra responsive và có thể lưu screenshot review vào `.codex/screenshots/`.
6. Cập nhật changelog.
7. Gợi ý bước tiếp theo, thường là `/task-connect <mã task>`.

Khi bạn review UI và nói `ưng rồi`, `ok rồi`, `đúng ý rồi` hoặc `chốt UI này`, Codex sẽ lưu pattern đã duyệt vào:

```txt
docs/ui-references/approved-patterns.md
```

Nếu feedback là rule dùng rộng cho nhiều màn, Codex mới cập nhật thêm `docs/11-ui-design-system.md`.

### `/task-connect <mã task>`

Dùng sau khi UI mock đã ổn và cần nối API thật.

Codex sẽ:

1. Đọc UI/API docs, approved UI patterns và database docs nếu API còn thiếu.
2. Kiểm tra đã có UI/mock UI chưa. Nếu chưa có, Codex dừng và gợi ý `/task-ui` hoặc `/task-full`.
3. Giữ layout/UI đã duyệt, không redesign lớn.
4. Nếu API chưa có, code API đầy đủ theo task/API contract.
5. Thay mock data bằng API client/hooks, ưu tiên TanStack Query.
6. Backend vẫn enforce auth/RBAC, không chỉ guard bằng UI.
7. Chạy check phù hợp, cập nhật changelog và mô tả luồng kỹ thuật.

### `/task-full <mã task>`

Dùng khi muốn Codex làm trọn một subtask trong một lượt.

Codex sẽ:

1. Đọc docs liên quan theo `Task routing map` trong `AGENTS.md`.
2. Làm đủ phần cần thiết của task: UI, API, database, worker, shared types hoặc docs nếu task yêu cầu.
3. Không làm sang subtask khác nếu bạn chưa yêu cầu.
4. Nếu task quá lớn hoặc thiếu dependency, Codex sẽ báo và đề xuất tách nhỏ.
5. Chạy check phù hợp, cập nhật changelog và gợi ý subtask tiếp theo.

### `/fix bug <mô tả lỗi>`

Dùng khi gặp lỗi cần sửa.

Codex sẽ:

1. Đọc docs liên quan tới module nghi ngờ.
2. Tái hiện lỗi hoặc lấy bằng chứng từ log/code.
3. Xác định nguyên nhân trước khi sửa.
4. Sửa nhỏ nhất có thể, không refactor lan rộng.
5. Chạy lại check phù hợp.
6. Báo ngắn gọn: nguyên nhân bug, cách xử lý và luồng kỹ thuật đã áp dụng.

### `/commit`

Dùng khi muốn Codex commit các thay đổi hiện tại.

Codex sẽ:

1. Kiểm tra `git status`, diff và changelog.
2. Không sửa code production trong bước commit.
3. Bổ sung changelog ngắn nếu thiếu.
4. Kiểm tra không có secret/file rác.
5. Stage đúng file cần commit.
6. Commit bằng message ngắn theo format:

```txt
<type>(<scope>): <summary>
```

Ví dụ:

```txt
docs(codex): update task workflow guide
fix(api): handle root health check
```

## Quy trình UI khuyến nghị

Với màn hình mới, nên làm theo thứ tự:

```txt
/task-ui <mã task>
review UI trong browser/screenshot
góp ý để Codex polish
nói "ưng rồi" khi chốt UI
/task-connect <mã task>
```

Nếu muốn làm nhanh cả UI + API trong một lượt:

```txt
/task-full <mã task>
```

## Lưu ý khi làm việc

- Mỗi lần nên giao một subtask, ví dụ `M3.4`.
- Không dùng `/task-connect` khi chưa có UI mock.
- Không dùng `/task-ui` cho task không có giao diện.
- Nếu task nhỏ/bug nhỏ, Codex có thể dùng quy trình nhẹ hơn để hoàn thành nhanh.
- Nếu thay đổi file, Codex phải cập nhật changelog trong `.codex/changelog/`.
- Codex không tự commit nếu bạn chưa gọi `/commit` hoặc yêu cầu rõ.
