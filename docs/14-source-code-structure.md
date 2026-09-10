# 14. Source Code Structure - Cấu trúc source code

Tài liệu này là contract tổ chức source code cho front-end và back-end. Mục tiêu là tránh file phình to, component/helper bị viết dồn, UI không đồng nhất, import rối và module khó bảo trì khi dự án lớn dần.

Khi làm task có sửa code, Codex đọc mục 1 và phần front-end, back-end hoặc shared
tương ứng với bề mặt sửa; không cần đọc toàn file nếu task chỉ chạm một layer.

---

## 1. Nguyên tắc bắt buộc

- Tách code theo trách nhiệm từ lần triển khai đầu tiên, không đợi file lớn rồi mới tách.
- Page/controller chỉ là entry boundary, không chứa nhiều logic nghiệp vụ hoặc nhiều component con.
- Component, hook, API client/service, schema, type, mapper, formatter, mock data và helper phải có vị trí rõ ràng.
- Code dùng chung phải đặt ở shared layer phù hợp; code chỉ dùng riêng một feature thì đặt trong feature đó.
- Không tạo lại component/pattern đã được owner duyệt với style khác. Phải kiểm tra shared components, feature tương tự và `docs/ui-references/approved-patterns.md` trước khi tạo mới.
- Khi tạo/sửa UI, phải đọc routing index trong `docs/ui-references/code-patterns.md` rồi chọn file/section pattern gần nhất trong `docs/ui-references/code-patterns/` cho form, modal, detail grid, action, upload hoặc state view trước khi tự viết biến thể mới.
- Import nội bộ phải dùng alias chuẩn: `@/...` trong `apps/web`, `#api/...` trong `apps/api`.
- Không tạo file barrel/re-export chỉ để gom import cho tiện, ví dụ `states.tsx`, `badges.tsx`, `index.ts` chỉ export lại file khác. Import thẳng file thật để cấu trúc dễ đọc và tránh file thừa.
- Không cập nhật changelog khi sửa code thường; changelog chỉ ghi trong workflow `/commit`.

---

## 2. Front-end structure

### 2.1. Route groups

Route trong `apps/web/app` phải dùng Next.js App Router và route group rõ theo vai trò.

```txt
apps/web/app/
├── (public)/
│   ├── page.tsx
│   └── courses/
├── (auth)/
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── register/
│   │   ├── student/page.tsx
│   │   └── parent/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (student)/student/
├── (parent)/parent/
└── (admin)/admin/
```

Rules:

- `page.tsx` chỉ compose screen component, truyền route params/search params khi cần và xử lý metadata/server boundary nếu có.
- Layout dùng `layout.tsx` của Next.js khi nhiều route cùng shell/guard/provider. Không tạo thêm shell wrapper tách rời nếu layout có thể chứa trực tiếp logic layout hợp lý.
- Auth route nằm trong `(auth)`, không nằm trong `(public)`. Public route là landing/course/news/event có thể index hoặc phục vụ visitor chưa đăng nhập.
- Admin/student/parent route phải có guard ở UI khi cần, nhưng backend vẫn enforce RBAC/ownership.
- Root `app/layout.tsx` không được trở thành app shell nặng cho mọi route. Shell, toaster, CSS, nav, guard hoặc provider chỉ dùng cho một role phải đặt ở route group layout tương ứng như `(auth)/layout.tsx`, `(admin)/layout.tsx`, `(student)/layout.tsx` hoặc `(parent)/layout.tsx`.
- CSS chỉ dành cho một role phải đặt gần route group đó, ví dụ `apps/web/app/(admin)/admin-theme.css`, và import từ role layout. `globals.css` chỉ giữ token/base/utility dùng chung thật sự cho mọi route.
- Route page nên import trực tiếp screen entry cần dùng. Tránh import qua file re-export ở route boundary vì có thể làm route chunk rộng hơn cần thiết và tạo thêm file không mang ý nghĩa sở hữu.

### 2.2. Feature folders

Feature code đặt trong `apps/web/features/<feature>/`.

```txt
features/<feature>/
├── api/          # API client hoặc query/mutation function riêng feature
├── data/         # Mock data, option list, constant dữ liệu hiển thị
├── hooks/        # Hook orchestration/state/query cho feature
├── schemas/      # Zod schema, form schema, validation helper
├── screens/      # Mỗi screen là một folder riêng
│   └── <screen-name>/
│       ├── index.tsx
│       └── components/
├── session/      # Session/store feature-specific nếu có
├── types/        # Type riêng feature
└── utils/        # Mapper, formatter, normalizer, pure helper
```

Không phải feature nào cũng cần đủ mọi folder. Chỉ tạo folder khi thật sự có file thuộc trách nhiệm đó.

Rules:

- Cấu trúc feature phải ưu tiên dễ quét bằng mắt: root feature chỉ giữ các folder trách nhiệm thật sự cần thiết, không tạo folder chỉ để chứa một file, không lồng thêm tầng khi tên folder không làm rõ ownership hơn.
- Khi route trong `apps/web/app` có sibling quan trọng theo role, feature code phải mirror sibling đó thay vì gộp vào một feature rộng. Ví dụ `app/(student)/student/courses` map về `features/student/courses`, còn `app/(student)/student/explore` map về `features/student/explore`.
- Nếu route là màn trực tiếp của role và không có feature con rõ ràng, đặt màn dưới `features/<role>/screens/<screen-name>/`. Ví dụ public home dùng `features/public/screens/home/index.tsx`, không tạo lặp `features/public/home/screens/home`.
- Mỗi màn hình trong feature phải là một folder dưới `screens/`, ví dụ `screens/admin-courses-manager/index.tsx` hoặc `screens/student-course-detail-screen/index.tsx`.
- Component chỉ phục vụ một màn hình phải đặt cạnh màn hình đó trong `screens/<screen-name>/components/`. Không tạo `features/<feature>/components/`, không tạo `components/<screen-key>/` ở root feature.
- `index.tsx` của screen được phép compose nhiều component và hook, nhưng không chứa danh sách dài subcomponent/helper inline.
- Component dùng chung giữa nhiều màn, nhiều feature hoặc nhiều route phải đưa ra `apps/web/components` theo đúng scope role; không để trong `features/**/shared/components`.
- `hooks/` giữ orchestration: local state, form wiring, query/mutation wiring, derived state phức tạp.
- `api/` giữ function gọi API hoặc query/mutation function; không gọi fetch rải rác trong component sâu.
- `schemas/` giữ Zod schema và type suy ra từ schema.
- `data/` giữ mock data hoặc option list. Mock data không được lẫn trong screen/component nếu màn hình không nhỏ.
- `utils/` chỉ chứa pure helper không render JSX.
- `types/` chứa type feature-specific. Type dùng chung nhiều app/package phải cân nhắc đưa vào `packages/shared`.

### 2.3. Shared front-end layers

```txt
apps/web/components/
├── common/       # Component dùng chung mọi role
│   ├── auth/
│   ├── forms/
│   └── ui/
├── admin/        # Component dùng chung riêng role admin
├── student/      # Component dùng chung riêng role student
└── parent/       # Component dùng chung riêng role phụ huynh

apps/web/lib/
├── api-client.ts # API client wrapper dùng chung
└── utils.ts      # Utility dùng chung thật sự nhỏ/generic
```

Rules:

- Shared component phải đủ generic để dùng lại nhiều màn, nhưng vẫn giữ style nhất quán của hệ thống.
- Toàn bộ shared component của front-end chỉ đặt trong một root duy nhất là `apps/web/components`, chia theo scope `common`, `admin`, `student`, `parent`.
- Form input/select/checkbox/submit/status/header đã được owner ưng phải được tái sử dụng hoặc nâng cấp tại `apps/web/components/common/forms`.
- Khi một form/control đã được owner duyệt hoặc dùng lặp lại từ hai nơi trở lên, không để mỗi feature tự dựng lại biến thể riêng; phải nâng cấp thành primitive/hook/helper trong `apps/web/components/common/forms` hoặc shared layer phù hợp rồi cho màn mới reuse.
- Validation helper dùng chung cho form text nên đặt ở shared web layer như `apps/web/lib/form-validation.ts`; form schema không nên lặp lại chuỗi Zod required/min/max dễ sai message ở từng feature.
- Không tạo `apps/web/types` như thư mục gom type chung chung. Type chỉ dùng một feature đặt trong `features/<feature>/types`; type dùng chung nhiều feature nhưng chỉ thuộc frontend đặt cạnh shared component/helper sở hữu nó; type/schema là contract của cả Web và API phải đặt trong `packages/shared`.
- Form numeric dùng chung như tiền, thứ tự, phần trăm hoặc số lượng phải có primitive/style thống nhất, không để từng màn dùng `type="number"` native với spinner/default UI riêng của browser.
- shadcn/Radix wrapper cũng phải tách mỗi wrapper một file khi có nhiều component con; không tạo thêm file compatibility chỉ re-export nếu không có call site bắt buộc.
- Không đặt component chỉ dùng một screen vào shared layer.
- Không tạo component shared mới nếu chỉ một màn dùng và chưa thấy nhu cầu tái sử dụng rõ.

### 2.4. Front-end file boundary checklist

Trước khi tạo hoặc sửa UI lớn, Codex phải tự kiểm:

- Có shared component/pattern đã duyệt dùng được chưa?
- Nếu có form, đã chọn form chuẩn/pattern tham chiếu và reuse primitive/hook/schema style tương ứng chưa?
- Nếu component thuộc form/modal/detail grid/action/upload/state view, đã đọc routing index và đối chiếu file/section phù hợp trong `docs/ui-references/code-patterns/` chưa?
- Form có validate on change, inline error copy đúng rule fail, submit invalid/pending state và numeric input không dùng native spinner chưa?
- `page.tsx` có đang chỉ compose screen/layout không?
- Mỗi `.tsx` có một component implementation chính chưa?
- Hook/state/form orchestration đã tách khỏi component render chưa?
- Schema/type/helper/mock data đã tách khỏi JSX chưa?
- Import nội bộ đã dùng `@/...` chưa?
- UI có loading, empty, error, disabled/pending state phù hợp chưa?
- Mock data có dễ xóa khi `/task-connect` không?
- Route boundary có kéo nhầm code role khác qua root layout, shared provider, CSS global hoặc re-export file không?
- Nếu admin/client chung app, đã build/curl route public chính và route admin chính để xác nhận public route không tải chunk/CSS/asset admin chưa?

---

## 3. Back-end structure

### 3.1. Common layer

Code dùng chung trong API đặt ở `apps/api/src/common`.

```txt
apps/api/src/common/
├── api/          # Response envelope/interceptor
├── ai/           # Policy/helper AI trung lập, dùng được giữa nhiều domain
├── auth/         # Guard/decorator/user request type
├── errors/       # HTTP exception factory/filter, Prisma error mapper
├── prisma/       # Prisma module/service
└── validation/   # Validation pipe/error helper
```

Rules:

- HTTP exception phải đi qua `common/errors/api-exception.ts`.
- Prisma known error detection/mapping dùng helper trong `common/errors/prisma-error.mapper.ts`.
- Common layer không chứa logic nghiệp vụ của một domain cụ thể.
- Policy AI đặt trong `common/ai` chỉ được chứa invariant trung lập thực sự dùng
  giữa nhiều flow; nguồn dữ kiện, prompt/schema, mapper và lifecycle riêng của
  Summary, Quiz hoặc domain khác vẫn phải thuộc module sở hữu.
- Policy chuyên môn Toán, Vật lý, Hóa học không được đặt trong `common/ai` hoặc
  dùng policy của một môn làm core cho môn khác. Mỗi task core hình đề/hình lời
  giải phải sở hữu system prompt hoàn chỉnh theo từng môn. Không dùng chung prompt
  prose hoặc fragment giữa các môn. Question Figure Core được phép dùng chung
  giữa Summary/Quiz cho role `QUESTION` problem-only theo ADR-0028; Solution
  Figure Core được phép dùng chung giữa Summary/Quiz/Flashcard cho role
  `SOLUTION` theo ADR-0027. Prompt source-redraw, repair và refinement khác
  contract vẫn do domain sở hữu; hạ tầng provider, queue, schema, validator,
  accounting và persistence tiếp tục được dùng chung khi trung lập.
- Domain có thể wrap helper common để chọn message/mã lỗi nghiệp vụ, nhưng không tự dựng body lỗi HTTP thủ công nhiều nơi.
- Core Sinh kiến thức là private boundary: mọi file/schema/helper/service/worker
  có tên `lesson-summary-*` chỉ được Summary và StemFigure thuộc Summary import.
  Quiz, Flashcard, Test và flow khác không được import để tái sử dụng prompt,
  schema, mapper, subject profile, context hoặc renderer. Flow cần khả năng tương
  tự phải sở hữu implementation trong domain của chính nó; chỉ provider, queue,
  routing, retrieval và accounting trung lập được dùng chung.

### 3.2. Domain module folders

Mỗi domain module trong `apps/api/src/modules/<domain>` phải giữ root sạch.

```txt
modules/<domain>/
├── <domain>.module.ts
├── controllers/
├── dto/
├── services/
├── selectors/
├── serializers/
├── utils/
├── types/
├── repositories/  # chỉ khi thật sự cần abstraction DB riêng
└── guards/        # chỉ khi guard riêng domain
```

Rules:

- Root module chỉ nên giữ `*.module.ts`. Không đặt controller/service/helper/select/serializer/type ngang hàng ở root.
- `controllers/`: HTTP boundary, decorator, guard, param/query/body mapping. Không chứa nghiệp vụ hoặc Prisma query.
- `dto/`: request DTO/class-validator, Swagger DTO nếu có.
- `services/`: nghiệp vụ, transaction, gọi Prisma/provider/job queue. Không trả response envelope thủ công.
- `selectors/`: Prisma select/include object, tránh duplicate select rải rác.
- `serializers/`: map entity/Prisma result sang API response shape.
- `utils/`: pure helper, normalizer, domain-specific error wrapper nhỏ.
- `types/`: type nội bộ domain hoặc type response/service input chưa thuộc shared package.
- `repositories/`: chỉ dùng khi service bị trộn DB query quá nhiều hoặc cần abstraction provider; không tạo repository máy móc cho mọi module.
- Import nội bộ phải dùng `#api/...`.

### 3.3. Back-end file boundary checklist

Trước khi tạo hoặc sửa API/module, Codex phải tự kiểm:

- Controller có đang chỉ xử lý HTTP boundary không?
- Service có chứa nghiệp vụ chính và không bị trộn serializer/select/helper inline quá nhiều không?
- Prisma `select/include` dùng lại đã tách vào `selectors/` chưa?
- Response mapper đã tách vào `serializers/` chưa?
- Helper/normalizer/error wrapper domain đã đặt trong `utils/` chưa?
- Type nội bộ đã đặt trong `types/` chưa?
- Exception/error có đi qua `common/errors` không?
- Module root có sạch, chỉ còn `*.module.ts` không?
- Import nội bộ đã dùng `#api/...` chưa?

---

## 4. Shared package

`packages/shared` chỉ dùng cho type/schema/constant thật sự chia sẻ giữa web và API hoặc nhiều package.

```txt
packages/shared/src/
├── constants/
├── schemas/
├── types/
└── index.ts
```

Rules:

- Không đưa type chỉ dùng một app vào shared.
- Zod schema dùng chung web/API nên đặt ở shared khi cả hai bên thật sự cần cùng contract.
- Shared package không phụ thuộc vào Next.js hoặc NestJS.

---

## 5. Khi nào phải cập nhật tài liệu

Codex phải cập nhật tài liệu khi:

- Di chuyển module/feature lớn hoặc đổi layout thư mục quan trọng: cập nhật `.codex/context/code-index.md`.
- Thêm route/screen/UI surface quan trọng: cập nhật `docs/08-ui-pages-and-components.md` nếu source-of-truth màn hình thay đổi.
- Thay đổi rule UI rộng: cập nhật `docs/11-ui-design-system.md`.
- Thay đổi rule kiến trúc/code organization rộng: cập nhật `AGENTS.md`, `docs/03-technical-architecture.md`, file này và skill liên quan.
- Thay đổi API/database/AI/env behavior: cập nhật docs contract/domain tương ứng.

---

## 6. Anti-patterns cần tránh

- Một file UI chứa nhiều component render JSX, nhiều schema, mock data và helper cùng lúc.
- Page route vừa render, vừa giữ toàn bộ state, vừa chứa subcomponent.
- Shared primitive bị copy lại trong feature khác với style khác.
- API client/fetch nằm trong component sâu thay vì feature hook/client.
- Backend module root phẳng với nhiều controller/service/helper/select/type.
- Controller gọi Prisma/provider trực tiếp.
- Service chứa nhiều object `select`/serializer/helper lặp lại thay vì tách file.
- Tạo trực tiếp Nest exception kèm `{ code, message }` ở nhiều module.
- Import tương đối nội bộ giữa các source file trong `apps/web` hoặc `apps/api`.
