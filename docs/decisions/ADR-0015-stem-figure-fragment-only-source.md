# ADR-0015 - AI sinh LaTeX figure snippet, backend sở hữu compiler envelope

Date: 2026-08-13
Status: Accepted

## Context

Pipeline M9.2 hiện đã tách lượt sinh Summary khỏi lượt chuyên vẽ từng figure và
đã có đầy đủ job, revision, sandbox TeX Live, LuaLaTeX, dvisvgm, SVG validator,
R2 delivery asset và trình sửa source với preview SVG.

Boundary source hiện tại vẫn ở trạng thái lai: model được ưu tiên trả
`tikzpicture` fragment nhưng vẫn có thể trả cả tài liệu `standalone`, tự viết
`\documentclass` và `\usepackage`. Renderer sau đó lại chèn compiler profile cố
định của backend. Hai bên cùng sở hữu compiler preamble làm contract khó hiểu,
dễ lệch package, khó khóa theo môn và khiến model tiêu token cho boilerplate
không thuộc nội dung hình.

Owner chốt không cần tương thích ngược với source `standalone` do AI sinh. Thay
đổi phải tận dụng pipeline M9.2 hiện có, không viết lại toàn bộ hệ thống vẽ hình.

## Decision

### 1. Contract `LaTeX figure snippet` của AI/editor

AI và editor chỉ cung cấp **LaTeX figure snippet** cho đúng một figure.
`latexSource` không phải tài liệu LaTeX hoàn chỉnh và không được sở hữu compiler
preamble. Snippet có hai phần theo đúng thứ tự:

1. zero hoặc nhiều khai báo header cục bộ thuộc allowlist;
2. đúng một root drawing environment.

Ví dụ đầy đủ:

```latex
\usetikzlibrary{calc,angles,quotes}
\tikzset{
  mypoint/.style={circle,fill=black,inner sep=1.2pt}
}
\tdplotsetmaincoords{70}{120}

\begin{tikzpicture}[tdplot_main_coords]
  ...
\end{tikzpicture}
```

Các dạng hợp lệ chính:

```latex
\begin{tikzpicture}
  ...
\end{tikzpicture}
```

```latex
\begin{circuitikz}
  ...
\end{circuitikz}
```

```latex
\begin{tikzpicture}
  \begin{axis}
    ...
  \end{axis}
\end{tikzpicture}
```

```latex
\begin{tikzpicture}
  \tkzDefPoint...
  ...
\end{tikzpicture}
```

Root environment được allowlist theo môn:

| Subject profile | Root environment hợp lệ                          |
| --------------- | ------------------------------------------------ |
| `MATH`          | `tikzpicture`                                    |
| `PHYSICS`       | `tikzpicture` hoặc `circuitikz`                  |
| `CHEMISTRY`     | `tikzpicture`; `chemfig`/`mhchem` dùng bên trong |
| `GENERAL`       | `tikzpicture`                                    |

Mỗi source có đúng một root drawing environment. `axis` chỉ là environment con
trong `tikzpicture`, không được đứng độc lập. Các environment con như `scope`,
`axis` và node chứa `chemfig` vẫn được dùng theo profile.

Header cục bộ trước root chỉ được gồm comment, khoảng trắng và zero hoặc nhiều
lệnh sau:

- `\usetikzlibrary{...}`: chọn TikZ library trong allowlist của subject toolbox;
- `\usepgfplotslibrary{...}`: chọn PGFPlots library trong allowlist của subject
  toolbox;
- `\tikzset{...}`: định nghĩa style/key phục vụ riêng figure;
- `\pgfplotsset{...}`: định nghĩa style/config phục vụ riêng figure nhưng không
  được thay đổi `compat`;
- `\tdplotsetmaincoords{...}{...}` khi subject toolbox có `tikz-3dplot`.

Ba lệnh cấu hình cục bộ `\tikzset`, `\pgfplotsset` và
`\tdplotsetmaincoords` cũng được phép đặt bên trong root drawing environment vì
đây là cú pháp TikZ/PGF hợp lệ và giữ cấu hình trong scope của chính figure.
Các lệnh nạp library (`\usetikzlibrary`, `\usepgfplotslibrary`) vẫn bắt buộc nằm
trước root; mọi forbidden-command policy vẫn áp dụng trên toàn snippet.

Các lệnh library có thể xuất hiện zero hoặc nhiều lần. Mọi tên library phải được
parse riêng và tồn tại trong manifest backend của đúng môn; snippet không được
yêu cầu cài package hoặc library ngoài toolbox. Header cục bộ và logic bên trong
root vẫn phải qua unsafe-command policy, không được đọc/ghi file, gọi mạng, đổi
compiler hoặc chạy Lua/shell.

Ví dụ cấu hình plot cục bộ hợp lệ:

```latex
\usepgfplotslibrary{fillbetween}
\pgfplotsset{
  lesson axis/.style={axis lines=middle,grid=both}
}
\begin{tikzpicture}
  \begin{axis}[lesson axis]
    ...
  \end{axis}
\end{tikzpicture}
```

AI/editor luôn bị cấm trả các thành phần sau, kể cả package đúng môn:

```latex
\documentclass
\usepackage
\RequirePackage
\begin{document}
\end{document}
\setmainfont
\pgfplotsset{compat=...}
```

Source policy phải dùng scanner/parser tối thiểu có nhận biết comment và cân bằng
environment; không được chỉ đếm chuỗi bằng regex. Scanner xác định header, đúng
một root ngoài cùng, các environment con và phần dư sau root. Sau root chỉ được
có comment hoặc khoảng trắng. Source vi phạm bị reject với diagnostic rõ ràng
trước compile.

### 2. Trách nhiệm duy nhất của backend/renderer

Backend sở hữu và tự ghép compiler envelope cho mọi compile attempt:

```latex
\documentclass[tikz,border=6pt]{standalone}
% package cố định của đúng subject profile
% baseline TikZ/PGFPlots libraries cố định
% font, pgfplots compat và compiler declarations cố định
\begin{document}
% LaTeX figure snippet do AI/admin cung cấp
\end{document}
```

Compiler profile tiếp tục được chọn từ `subjectKey` snapshot của figure:

- Toán: TikZ/PGF, `tkz-euclide`, `pgfplots`, `tkz-tab`, `tikz-3dplot` và
  TikZ/PGFPlots libraries đã chốt.
- Vật lý: TikZ/PGF, `circuitikz`, `pgfplots` và libraries đã chốt.
- Hóa học: TikZ/PGF, `chemfig`, `mhchem`, `pgfplots` và libraries đã chốt.
- General: TikZ/PGF core và libraries chung đã chốt.

Model phải nhận manifest chính xác của profile đang có để biết cú pháp nào dùng
được. Package và phạm vi library hợp lệ do backend quyết định; snippet chỉ được
chọn/khai báo library trong phạm vi đó. `\usetikzlibrary` hoặc
`\usepgfplotslibrary` hợp lệ là **lựa chọn module trong toolbox đã cài**, không
phải yêu cầu cài dependency mới.

Một manifest có version là nguồn duy nhất cho:

- package và baseline declaration của renderer;
- TikZ/PGFPlots library được phép chọn theo môn;
- root environment và header command của source policy;
- toolbox text gửi generation/repair prompt;
- smoke fixture và contract test.

Không duy trì các danh sách viết tay độc lập giữa prompt, API và renderer. Không
cài package động theo output của AI và không tự mở rộng manifest khi compile lỗi.
Renderer phải kiểm lại cùng source contract ở trust boundary cuối trước khi chạy
LuaLaTeX, kể cả API/worker đã kiểm trước đó.

### 3. Compile và repair

Luồng sau khi đổi:

```text
Summary + figure plan
  -> một AI request chuyên vẽ trả LaTeX figure snippet
  -> schema + snippet source policy
  -> backend ghép compiler envelope theo subjectKey
  -> LuaLaTeX -> PDF tạm nội bộ
  -> dvisvgm -> SVG
  -> validator/sanitizer
  -> promote R2 hoặc giữ candidate lỗi theo lifecycle hiện có
```

- First compile được tính trên snippet nguyên bản do model trả, đặt trong
  compiler envelope chuẩn của backend.
- Không còn local dependency recovery để tự thêm `\usepackage`,
  `\usetikzlibrary` hoặc `\usepgfplotslibrary` vào source AI. Package/toolbox
  thiếu là lỗi compiler profile của backend; tên library ngoài manifest, header
  sai hoặc cú pháp vẽ sai là lỗi source.
- AI repair nhận snippet hiện tại + diagnostic batch và cũng chỉ được trả snippet
  theo cùng contract.
- Admin sửa `latexSource` bằng cùng snippet contract; không có chế độ nhập tài
  liệu standalone.
- Admin source mutation phải pass source policy trước khi tạo revision, render
  attempt hoặc enqueue; source policy reject có thể ghi audit event nhẹ nhưng
  không tạo revision `FAILED` không thể compile.

Renderer tạo hai file source nội bộ:

```text
main.tex       = compiler envelope do backend sở hữu
fragment.tex   = nguyên văn snippet AI/admin
```

`main.tex` dùng `\input{fragment.tex}` do backend tạo. Lệnh `\input` vẫn bị cấm
trong snippet không tin cậy; chỉ wrapper tin cậy của backend được dùng. PDF do
LuaLaTeX tạo chỉ là file trung gian trong thư mục tạm để `dvisvgm` chuyển sang
SVG; renderer xóa thư mục này sau request, không trả hoặc lưu PDF.

Tính năng click/chỉnh trực tiếp trên PDF và source mapping bằng SyncTeX được bỏ
khỏi phạm vi hiện tại. Admin chỉ sửa source văn bản, bấm biên dịch thử và xem
preview SVG đã qua validator. Hệ thống không có edit-session, API locate-source,
artifact PDF/SyncTeX hay cấu hình TTL/dung lượng dành cho editor PDF.

Các metric được hiểu như sau:

- `providerOutputPassed`: provider trả đúng structured payload có source;
- `sourcePolicyPassed`: snippet qua source contract;
- `compilerInvoked`: LuaLaTeX thật sự được gọi;
- `firstCompilePassed`: lần LuaLaTeX đầu trên snippet nguyên bản thành công;
- `firstPassSucceeded`: output nguyên bản qua policy, compile và validator mà
  không normalization hoặc repair.

Release/live gate chất lượng đầu-cuối dùng `firstPassSucceeded`; policy reject
không bị ghi nhầm là compiler đã chạy, nhưng vẫn là first-pass failure.

### 4. Không viết lại pipeline hiện có

Các phần giữ nguyên:

- Summary sinh figure plan và mỗi figure dùng một request chuyên vẽ.
- `stem_figures`, revision, render attempt, source hash/version và audit.
- `DIAGRAM_RENDERING`, BullMQ retry và giới hạn AI repair.
- Renderer container non-root, no-network, read-only/tmpfs và resource limit.
- LuaLaTeX, PDF tạm nội bộ, dvisvgm và SVG validator/sanitizer.
- Candidate/current asset lifecycle và atomic promote lên R2.
- Admin editor/preview/retry/regenerate/upload replacement.
- Student chỉ nhận delivery asset đã promote.

Các điểm cần thay cục bộ khi owner ra lệnh triển khai:

| Boundary                   | Thay đổi cần làm                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Shared schema              | Mô tả/refine `latexSource` thành figure-snippet-only                                      |
| Versioned toolbox manifest | Là nguồn duy nhất cho prompt, policy, renderer và smoke fixture                           |
| Generation/repair prompt   | Chỉ yêu cầu snippet; công bố chính xác package/library/header được phép                   |
| Source policy              | Parse header/root; cấm compiler declaration; kiểm library/root theo subject               |
| Renderer trust boundary    | Kiểm lại snippet, luôn ghép envelope và xóa nhánh nhận standalone                         |
| Draft source editor        | Compile trực tiếp source draft và chỉ trả preview SVG đã sanitize                         |
| Worker                     | Bỏ dependency recovery tự sửa source; ghi metric policy/compile/first-pass riêng          |
| Admin source mutation      | Draft compile/apply dùng cùng snippet policy trước khi tạo revision/attempt/compile       |
| Tests/smoke                | Thay standalone bằng snippet; phủ local header, `circuitikz` và negative/security cases   |
| Docs/prompt preview        | Hiển thị figure snippet contract; phân biệt library selection với package/compiler config |

Không đổi queue, storage hoặc viết lại renderer từ đầu. Schema/API/UI chỉ dọn
những cột, route và thành phần PDF/SyncTeX cũ, đồng thời dùng draft compile/apply
trực tiếp cho source editor.

`stem_figure_revisions` là nguồn sự thật duy nhất cho source, hash/version,
alt/caption, preview và renderer/validator metadata. `stem_figures` chỉ giữ identity,
placement, subject, lifecycle head và current/pending revision pointers; không
giữ bản sao legacy hay serializer fallback về figure row.

### 5. Không có tương thích ngược

- Standalone source cũ nằm ngoài contract ngay khi quyết định này được triển
  khai. Không viết code nhận diện legacy, chế độ read-only, fallback renderer,
  auto-strip, normalize, chuyển đổi hoặc migration source cũ.
- Mọi source chứa `documentclass`, `usepackage`, document wrapper hoặc compiler
  preamble bị reject như source sai, không phụ thuộc ngày tạo.
- Fixture/source dev cũ phải được thay hoặc xóa. Dữ liệu lịch sử, revision và
  artifact cũ không tạo thêm yêu cầu tương thích cho flow mới và có thể được dọn
  bằng workflow riêng khi owner yêu cầu.
- Không tự chạy thao tác xóa dữ liệu trong implementation ADR; điểm này chỉ xác
  nhận hệ thống mới không có nghĩa vụ bảo toàn khả năng render/edit source cũ.

## Implementation sequence

Thực hiện như một phần còn lại của `M9.2`, không tạo milestone mới:

1. Viết contract tests mới ở trạng thái fail cho snippet header/root/forbidden
   declarations, comment parsing và subject boundary.
2. Tạo versioned toolbox manifest dùng chung cho prompt, policy, renderer và
   smoke fixture.
3. Cập nhật shared schema, generation prompt và repair prompt.
4. Siết source policy cho AI output/admin mutation; renderer kiểm lại trước
   LuaLaTeX.
5. Đổi renderer sang một đường duy nhất: profile envelope `main.tex` + raw
   `fragment.tex`; xóa nhánh standalone.
6. Bỏ dependency-normalization path tự sửa source; giữ nguyên lifecycle
   compile/repair/validator.
7. Chuyển smoke/test fixture sang snippet, chạy typecheck, focused test, Docker
   renderer smoke và build liên quan.
8. Chỉ chạy live provider test khi owner yêu cầu; yêu cầu đó đã là phê duyệt chi
   phí, nên Codex tự chọn số request/ngân sách hợp lý và chạy không cần xác nhận
   lần hai.

## Acceptance criteria

- `tikzpicture` snippet của Toán/General compile được mà không khai package.
- `tikzpicture` chứa `axis` compile được nhờ backend profile.
- `tikzpicture` chứa lệnh `tkz-*` compile được nhờ backend profile Toán.
- Zero hoặc nhiều `\usetikzlibrary`/`\usepgfplotslibrary` thuộc toolbox đúng môn
  được chấp nhận; library ngoài manifest bị reject trước LuaLaTeX.
- `\tikzset`, `\pgfplotsset` cục bộ và `\tdplotsetmaincoords` hợp lệ compile
  được; mọi cách thay đổi `pgfplots compat` bị reject.
- `circuitikz` root compile được cho Vật lý và bị reject cho môn khác.
- `axis` làm root, nhiều root hoặc root không thuộc profile bị reject trước
  LuaLaTeX; text giống `begin` trong comment không bị đếm nhầm.
- Mọi `documentclass`, `usepackage`, `RequirePackage`, document wrapper và font
  config trong `latexSource` đều bị reject, kể cả package vốn thuộc đúng môn.
- Generation, repair, admin edit và renderer dùng cùng snippet policy.
- Versioned toolbox manifest là nguồn duy nhất và có contract test chống drift.
- Không tạo revision/render attempt khi admin source bị policy reject.
- First-compile metric không được làm đẹp bằng cách sửa dependency vào source;
  `firstPassSucceeded` chỉ true khi policy + compile + validator pass nguyên bản.
- Renderer/API không trả hoặc lưu PDF/SyncTeX; source editor chỉ preview SVG.
- Standalone source cũ bị reject; không có compatibility test hoặc migration.
- Không gọi provider trả phí trong test mặc định.

## Consequences

Tích cực:

- Ranh giới trách nhiệm rõ: AI vẽ và chọn module/style cục bộ trong toolbox;
  backend quản lý package, compiler và phạm vi toolbox.
- Source ngắn hơn, prompt ít boilerplate và ít biến thiên dependency.
- Security policy rõ hơn vì AI không được điều khiển compiler preamble; mọi
  library selection vẫn nằm trong manifest cố định.
- Nâng cấp TeX Live/package/library tập trung ở backend mà không phải sửa mọi
  source figure.
- Thay đổi cục bộ, tận dụng gần như toàn bộ M9.2 hiện có.

Cần lưu ý:

- Compiler profile phải đủ package/library đã công bố cho model; thiếu dependency
  là lỗi cấu hình backend, không được chữa bằng cách cho AI viết `usepackage` hay
  tự mở rộng manifest sau compile fail.
- Backend phải đăng ký mọi drawing root trong subject manifest bằng
  `\standaloneenv{...}` để output được crop theo hình; smoke test phải
  chặn SVG còn nguyên khổ Letter. Quy tắc này bao gồm `circuitikz`,
  không fix riêng cho một fixture.
- Header parser phải hiểu comment, danh sách library và brace/environment balance;
  không nhận tùy ý mọi macro trước root.
- Prompt, renderer và policy phải được kiểm cùng nhau mỗi khi đổi toolbox.

## Non-goals

- Không đổi TeX Live/LuaLaTeX/dvisvgm hoặc stack đã chốt.
- Không mở figure sang Quiz, Flashcard, Test, Explanation hoặc Chat.
- Không thêm AI Vision, dark figure variant, PNG mặc định hoặc package động.
- Không thay DB lifecycle, R2 delivery hoặc validator ngoài việc xóa artifact
  và phiên chỉnh PDF/SyncTeX đã bị loại khỏi phạm vi.
- Không xây DSL hình học hoặc renderer riêng.
