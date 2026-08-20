# BẢN CHỐT HỆ THỐNG VẼ HÌNH STEM TĨNH BẰNG TEX LIVE + LATEX/TIKZ

> **Trạng thái:** Owner chốt đây là hướng phát triển chính thức từ ngày
> 12/08/2026. Hệ thống `diagram_spec_json`/renderer hình học cũ được giữ và phát
> triển độc lập trên một nhánh riêng; kiến trúc TeX Live/TikZ trong tài liệu này
> được phát triển trên một nhánh mới. Không trộn âm thầm hai hướng triển khai hoặc
> xóa nhánh cũ trong quá trình xây dựng hướng mới.

## 1. MỤC TIÊU

Xây dựng hệ thống tự động tạo hình minh họa tĩnh cho nội dung học tập trong ClassHero.

Phạm vi kiến trúc dài hạn:

- Toán từ lớp 3 đến lớp 12.
- Vật lý.
- Hóa học.
- Mọi prompt, schema, validator và bộ ca kiểm thử coverage phải coi lớp 3–12 là
  phạm vi bắt buộc; không dùng giới hạn lớp 3–9 của renderer cũ.
- Mọi input gửi OpenAI phải tách theo `domain`/môn học của khóa: phần lõi chung
  chỉ chứa contract trung tính, sau đó ghép đúng một profile `MATH`, `PHYSICS`,
  `CHEMISTRY` hoặc `GENERAL`. Không gửi dồn rule/package Toán, Lý và Hóa trong
  cùng một request.
- Hình minh họa cho tài liệu/tóm tắt bài học do AI tạo.

**Phạm vi triển khai hiện tại:** chỉ nối hệ thống hình vào chức năng admin
**Sinh kiến thức** (Lesson Summary). Quiz, Flashcard, Test, Explanation và Chat
giữ text-only trong kế hoạch này. Hình cho các loại nội dung đó là khả năng mở
rộng về sau, không nằm trong Definition of Done hiện tại.

Hệ thống cần bao phủ được nhiều loại hình khác nhau, ví dụ:

- Hình học phẳng.
- Hình học không gian.
- Hệ trục tọa độ.
- Đồ thị hàm số.
- Đường số.
- Sơ đồ đoạn thẳng.
- Miền nghiệm.
- Biểu đồ.
- Bảng xét dấu.
- Bảng biến thiên.
- Hình thống kê.
- Mạch điện.
- Hình quang học.
- Sơ đồ lực.
- Đồ thị Vật lý.
- Công thức cấu tạo Hóa học.
- Sơ đồ phản ứng.
- Dụng cụ và sơ đồ thí nghiệm dạng kỹ thuật.
- Các sơ đồ và hình vector phục vụ học tập.

Tất cả hình trong hệ thống này là **hình tĩnh**, không yêu cầu kéo thả hoặc hình học động.

---

## 2. NGUYÊN TẮC THIẾT KẾ

Không sử dụng `diagram_spec_json`.

Không tự xây dựng ngôn ngữ hình học riêng cho ClassHero.

Không tự định nghĩa trước toàn bộ các loại điểm, đoạn thẳng, đường tròn, tam giác, phân giác, tiếp tuyến, đồ thị, mạch điện hoặc các cấu trúc STEM khác.

Không xây renderer hình học riêng.

Thay vào đó:

- AI chịu trách nhiệm đọc và hiểu nội dung bài toán.
- Hệ thống quy định một **mức tối thiểu bắt buộc có hình** theo đúng môn học.
- Danh sách bắt buộc chỉ là mức sàn, không phải danh sách đóng. Ngoài danh sách,
  AI vẫn phải chủ động quyết định thêm hình khi hình giúp hiểu đúng dữ kiện, quan
  hệ, hiện tượng, đề bài hoặc lời giải.
- AI quyết định cần một hay nhiều hình.
- AI tự quyết định cách bố trí hình.
- AI tự lựa chọn cú pháp/công cụ phù hợp trong compiler profile đúng môn mà
  backend công bố.
- AI chỉ sinh LaTeX figure snippet: được có local library/style header trong
  allowlist rồi đúng một drawing root; không sinh document wrapper, package hoặc
  compiler preamble.
- TeX Live chịu trách nhiệm compile mã thành hình.
- Backend sở hữu compiler envelope/preamble/toolbox, kiểm tra coverage tối thiểu
  đã biết trước khi lưu, sau đó quản lý compile, lưu trữ và phân phối kết quả.

Mức tối thiểu bắt buộc hiện tại:

- Toán: nếu bài thuộc Hình học thì mọi theory, illustration và cả hai bài tập vận
  dụng đều phải có figure. Ngoài Hình học, phần yêu cầu vẽ/đọc/suy luận từ đồ
  thị, trục số, mặt phẳng tọa độ, bảng xét dấu, bảng biến thiên, bảng, biểu đồ
  hoặc sơ đồ phải có figure.
- Vật lý: mạch điện, quang học/tia sáng, lực/vector, đồ thị chuyển động–nhiệt
  học, bố trí thí nghiệm và phần yêu cầu vẽ/đọc/suy luận từ hình hoặc sơ đồ phải
  có figure.
- Hóa học: công thức cấu tạo/mô hình phân tử, sơ đồ hoặc chuỗi phản ứng, dụng
  cụ/bố trí thí nghiệm và phần yêu cầu vẽ/đọc/suy luận từ hình hoặc sơ đồ phải có
  figure.
- General: phần yêu cầu vẽ/đọc/suy luận từ hình, đồ thị, bảng, biểu đồ hoặc sơ đồ
  phải có figure.

Nếu output bỏ sót một figure thuộc mức tối thiểu, semantic coverage checker phải
gắn cảnh báo `MISSING_REQUIRED_FIGURE` đúng block bị thiếu nhưng vẫn lưu đầy đủ
Summary để admin đọc và chỉnh sửa. Cảnh báo này không tự làm hỏng toàn bộ lượt
sinh và không chặn lưu/phát hành. Ngược lại, figure do AI chủ động thêm ngoài
danh sách vẫn được chấp nhận và đi qua pipeline render bình thường. Đây là việc
kế thừa **ngữ nghĩa coverage** của hướng cũ, không mang `diagramSpec` hay renderer
JSON cũ sang kiến trúc mới.

Kiến trúc tổng quát:

```text
Nội dung bài toán / lời giải
            ↓
          OpenAI
            ↓
AI sinh LaTeX figure snippet
            ↓
Schema/Zod + semantic figure coverage checker
            ↓
      BullMQ Render Job
            ↓
    TeX Live Sandbox Worker
            ↓
Compile thành công?
      /          \
   Không          Có
     ↓             ↓
Error log      SVG validator
     ↓             ↓
OpenAI sửa mã  SVG preview
     ↓             ↓
Compile lại    Lưu R2 + trạng thái thành công
            ↓
       ClassHero UI
```

---

## 3. HỆ THỐNG RENDER CHÍNH

Môi trường render sử dụng:

**TeX Live + LaTeX + PGF/TikZ**

TeX Live được cài trong container chuyên dùng để render hình.

PGF/TikZ là graphics engine chính.

AI chỉ được sử dụng tập con package của đúng profile môn học hiện tại, dù image
renderer có cài sẵn package cho nhiều môn.

Backend không cần biết bài toán thuộc dạng hình học nào. Backend luôn nạp toàn bộ
toolbox cố định của đúng subject profile; AI chỉ chọn cú pháp cần dùng trong
toolbox đó và không được tự khai package/library.

Backend vẫn phải biết `subjectKey` để chọn profile prompt và validator package.
Snapshot `subjectKey`/`subjectName`/`subjectSlug` được ghi vào job và từng
`stem_figures` row; source hash của Summary cũng bao gồm snapshot này để preview,
worker và retry không bị lệch môn khi metadata khóa thay đổi.

Mọi profile được dùng các package nền tảng `tikz`, `pgf`, `xcolor`, `amsmath`,
`amssymb`, `fontspec`, `lmodern`. Package chuyên môn theo profile:

- Toán: TikZ/PGF, `tkz-euclide`, `pgfplots`, `tkz-tab`, `tikz-3dplot`.
- Vật lý: TikZ/PGF, `circuitikz`, `pgfplots`; quang học dùng TikZ core.
- Hóa học: TikZ/PGF, `chemfig`, `mhchem`, `pgfplots`.
- Domain chưa có profile: chỉ TikZ/PGF core và không tự suy diễn quy ước chuyên môn.

Nếu admin dùng prompt override, hệ thống vẫn nối subject profile và subject
boundary không thể ghi đè vào request thực tế. Source policy cho phép local
header command và library selection nằm trong versioned toolbox manifest, nhưng
reject `documentclass`, `usepackage`, compiler preamble và root environment không
thuộc profile trước compile, kể cả source do admin sửa. Repair prompt tiếp tục
dùng snapshot môn của hình, không tự phân loại lại từ compile log. Các request
OpenAI text-only khác của cùng khóa cũng dùng snapshot/profile môn riêng, dù chưa
sinh hình trong giai đoạn này.

Contract figure-snippet-only, không có compatibility path, được chốt tại
`docs/decisions/ADR-0015-stem-figure-fragment-only-source.md`.

---

## 4. CÁC PACKAGE CHÍNH

### 4.1. Package nền tảng

Sử dụng:

- `tikz`
- `pgf`
- `xcolor`
- `standalone` do backend dùng cho compiler envelope, không xuất hiện trong
  source AI
- `amsmath`
- `amssymb`

TikZ chịu trách nhiệm cho các hình vector tổng quát như:

- điểm;
- đoạn thẳng;
- đường thẳng;
- đường cong;
- mũi tên;
- hình đa giác;
- vòng tròn;
- hình elip;
- tô màu;
- pattern;
- chú thích;
- sơ đồ;
- các hình minh họa tự do có cấu trúc.

Có thể sử dụng các TikZ library có sẵn như:

- `calc`
- `intersections`
- `angles`
- `quotes`
- `positioning`
- `arrows.meta`
- `patterns`
- `decorations`
- `shapes`
- `backgrounds`

Backend cài package và công bố phạm vi library trong versioned toolbox manifest.
AI có thể chọn library cần cho đúng figure bằng `\usetikzlibrary{...}` trong local
header; mọi tên library ngoài allowlist của môn bị reject trước LuaLaTeX.

---

## 5. TOÁN HỌC

### 5.1. Hình học Euclid

Ưu tiên sử dụng:

- `tkz-euclide`
- TikZ core

Phục vụ các dạng hình như:

- tam giác;
- tam giác bằng nhau;
- tam giác đồng dạng;
- đường cao;
- trung tuyến;
- đường trung trực;
- đường phân giác;
- trung điểm;
- trọng tâm;
- trực tâm;
- tâm đường tròn nội tiếp;
- tâm đường tròn ngoại tiếp;
- đường tròn;
- dây cung;
- cung tròn;
- tiếp tuyến;
- cát tuyến;
- tứ giác;
- tứ giác nội tiếp;
- hình thang;
- hình bình hành;
- hình chữ nhật;
- hình thoi;
- hình vuông;
- đa giác;
- các đường phụ phục vụ chứng minh.

AI tự quyết định construction cần sử dụng.

### 5.2. Hình học tọa độ và đồ thị

Sử dụng:

- TikZ;
- `pgfplots`.

Phục vụ:

- hệ trục $Oxy$;
- hệ trục tọa độ;
- đồ thị hàm số;
- hàm bậc nhất;
- hàm bậc hai;
- parabol;
- hyperbol;
- hàm phân thức;
- hàm lượng giác;
- hàm mũ;
- hàm logarithm;
- tiếp tuyến;
- miền nghiệm;
- giao điểm đồ thị;
- phần diện tích tô màu;
- hình minh họa tích phân;
- biểu đồ dữ liệu.

### 5.3. Bảng xét dấu và bảng biến thiên

Sử dụng:

- `tkz-tab`.

Phục vụ:

- bảng xét dấu;
- bảng biến thiên;
- điểm cực trị;
- giới hạn;
- chiều biến thiên của hàm số.

### 5.4. Hình học không gian

Sử dụng:

- TikZ;
- `tikz-3dplot`.

Phục vụ các hình tĩnh như:

- hình hộp;
- hình lập phương;
- lăng trụ;
- hình chóp;
- hình tứ diện;
- hình trụ;
- hình nón;
- hình cầu;
- mặt phẳng;
- đường thẳng trong không gian;
- góc giữa các đối tượng;
- hình chiếu;
- hệ tọa độ không gian.

Không yêu cầu rendering 3D tương tác.

### 5.5. Toán tiểu học

TikZ core được sử dụng cho:

- tia số;
- đường số;
- sơ đồ đoạn thẳng;
- hình chia phần;
- phân số trực quan;
- hình vuông;
- hình chữ nhật;
- hình tam giác;
- hình tròn;
- ô lưới;
- bảng đơn giản;
- biểu đồ;
- sơ đồ minh họa bài toán lời văn;
- các hình vector đơn giản phục vụ bài toán lớp 3, 4, 5.

---

## 6. VẬT LÝ

### 6.1. Hình Vật lý tổng quát

Sử dụng:

- TikZ;
- PGF;
- `pgfplots`.

Phục vụ:

- sơ đồ lực;
- vector;
- chuyển động;
- vận tốc;
- gia tốc;
- mặt phẳng nghiêng;
- ròng rọc;
- đòn bẩy;
- lò xo;
- vật rơi;
- chuyển động ném;
- dao động;
- sóng;
- đồ thị $x-t$;
- đồ thị $v-t$;
- đồ thị $a-t$;
- đồ thị nhiệt học;
- các sơ đồ Vật lý khác.

### 6.2. Mạch điện

Sử dụng:

- `circuitikz`.

Phục vụ:

- nguồn điện;
- điện trở;
- biến trở;
- ampe kế;
- vôn kế;
- tụ điện;
- cuộn cảm;
- công tắc;
- diode;
- bóng đèn;
- mạch nối tiếp;
- mạch song song;
- các sơ đồ điện phổ thông.

### 6.3. Quang học

Sử dụng:

- TikZ;
- TikZ core với library/intersection phù hợp.

Phục vụ:

- gương phẳng;
- gương cầu;
- thấu kính hội tụ;
- thấu kính phân kỳ;
- trục chính;
- tiêu điểm;
- tia sáng;
- đường truyền ánh sáng;
- ảnh qua thấu kính;
- hệ quang học đơn giản.

AI chịu trách nhiệm hiểu quan hệ vật lý và quyết định các tia cần thể hiện.

---

## 7. HÓA HỌC

### 7.1. Công thức và phương trình hóa học

Sử dụng:

- `mhchem`.

Phục vụ:

- công thức hóa học;
- ion;
- điện tích;
- trạng thái chất;
- phương trình phản ứng;
- phương trình ion;
- ký hiệu hóa học.

### 7.2. Công thức cấu tạo và phân tử

Sử dụng:

- `chemfig`.

Phục vụ:

- liên kết đơn;
- liên kết đôi;
- liên kết ba;
- mạch carbon;
- mạch nhánh;
- vòng;
- công thức cấu tạo;
- hợp chất hữu cơ;
- sơ đồ phản ứng hữu cơ.

### 7.3. Hình minh họa thí nghiệm

Sử dụng:

- TikZ;
- các TikZ library phù hợp.

AI có thể dựng các sơ đồ kỹ thuật như:

- bình;
- cốc;
- ống nghiệm;
- ống dẫn;
- giá đỡ;
- mũi tên;
- dòng khí;
- quá trình truyền chất;
- sơ đồ bố trí thí nghiệm.

Các hình này là hình sơ đồ kỹ thuật, không nhằm thay thế ảnh thực tế của thiết bị phòng thí nghiệm.

---

## 8. MỘT BÀI CÓ THỂ CÓ NHIỀU HÌNH

Không giới hạn mỗi bài chỉ có một hình.

AI tự quyết định dựa trên nội dung.

Ví dụ một bài có thể cần:

- hai tam giác đặt cạnh nhau;
- một hình chính và một hình phụ;
- đường tròn và tứ giác nội tiếp;
- hình trước khi dựng đường phụ và hình sau khi dựng đường phụ;
- nhiều trường hợp (a), (b), (c);
- một đồ thị và một hình học;
- nhiều hình tương ứng với các bước của lời giải.

Có thể:

### Cách 1: Một SVG chứa nhiều hình

AI bố trí nhiều hình trong cùng một `tikzpicture`.

Phù hợp khi các hình cần được so sánh hoặc liên quan trực tiếp.

### Cách 2: Nhiều SVG riêng

Mỗi hình được compile riêng.

Phù hợp cho lời giải từng bước hoặc khi một hình tổng hợp sẽ quá phức tạp.

ClassHero không áp đặt số lượng hình cố định.

---

## 9. AI TỰ QUYẾT ĐỊNH CÔNG CỤ

Không cần code backend dạng:

```text
nếu là tam giác → tkz-euclide
nếu là đồ thị → pgfplots
nếu là mạch điện → circuitikz
...
```

AI nhận versioned toolbox manifest mà backend đã cài trong môi trường và tự lựa
chọn cú pháp phù hợp. AI không được trả `\usepackage`, nhưng có thể khai báo
`\usetikzlibrary`/`\usepgfplotslibrary` thuộc allowlist để source tự mô tả chính
xác module cục bộ mà figure sử dụng.

Ví dụ:

```text
Bài hình học
        ↓
AI có thể dùng tkz-euclide

Bài đồ thị
        ↓
AI có thể dùng pgfplots

Bài điện
        ↓
AI có thể dùng circuitikz

Bài hóa hữu cơ
        ↓
AI có thể dùng chemfig
```

Backend không cần hiểu quyết định này.

---

## 10. SOURCE AI SINH RA

AI chỉ sinh LaTeX figure snippet có thể đặt vào compiler envelope của backend.
Snippet gồm optional local header rồi đúng một root drawing environment. Không có
tương thích ngược, parser legacy, fallback, auto-strip hay migration cho tài liệu
standalone do AI viết; source cũ cũng bị reject như source sai.

Root mặc định là một `tikzpicture`. Riêng Vật lý cho phép một `circuitikz` làm
root. `axis` phải nằm trong `tikzpicture`; các lệnh `tkz-*`, `chemfig`, `mhchem`
được dùng bên trong root theo đúng subject profile.

Ví dụ:

```latex
\usetikzlibrary{calc,angles,quotes}
\usepgfplotslibrary{fillbetween}
\tikzset{
  lesson point/.style={circle,fill=black,inner sep=1.2pt}
}
\pgfplotsset{
  lesson axis/.style={axis lines=middle,grid=both}
}
\begin{tikzpicture}
  \begin{axis}[lesson axis]
    ...
  \end{axis}
\end{tikzpicture}
```

Local header được phép có zero hoặc nhiều `\usetikzlibrary`,
`\usepgfplotslibrary`, `\tikzset`, `\pgfplotsset` không đổi `compat` và
`\tdplotsetmaincoords`. Library phải thuộc manifest của đúng môn. AI không được
trả `\documentclass`, `\usepackage`, `\RequirePackage`, document wrapper, font
hoặc `pgfplots compat`; backend tự ghép toàn bộ compiler preamble. Source policy
phải parse comment/header/root, kiểm đúng một root ngoài cùng và reject phần dư
không hợp lệ sau root.

Source LaTeX của hình cần được lưu lại để:

- tạo lại hình;
- admin chỉnh sửa;
- debug;
- regenerate;
- thay model AI;
- thay đổi prompt;
- tái render khi nâng cấp TeX Live/package.

---

## 11. QUY TRÌNH COMPILE

Pipeline:

```text
AI LaTeX figure snippet
    ↓
Tạo temporary render job
    ↓
Backend ghép compiler envelope theo môn
    ↓
TeX Live container
    ↓
LuaLaTeX
    ↓
PDF trung gian
    ↓
SVG conversion
    ↓
Validate + sanitize SVG local
    ↓
Upload SVG lên Cloudflare R2
    ↓
Đánh dấu hình thành công và tạo preview cho admin
```

Ưu tiên sử dụng **LuaLaTeX** để có khả năng tương thích tốt với Unicode và các
package hiện đại trong image.

SVG là định dạng output chính.

PNG chỉ tạo khi thật sự cần.

---

## 12. CƠ CHẾ TỰ SỬA LỖI AI

AI có thể tạo source bị lỗi.

Hệ thống không coi lần sinh đầu tiên là kết quả cuối cùng.

Pipeline:

```text
OpenAI sinh source
        ↓
Compile
        ↓
Compile thành công?
      /          \
   Không          Có
     ↓             ↓
Lấy TeX log    Validate + sanitize SVG
     ↓             ↓
Gửi source +   SVG hợp lệ?
log cho OpenAI    /       \
     ↓         Không       Có
AI sửa source    ↓          ↓
     ↓       Phân loại   SVG preview
Compile lại      lỗi         ↓
              /      \     Lưu R2 + thành công
       Do source    Hạ tầng
           ↓           ↓
   OpenAI sửa mã  Worker retry/fail
```

Cơ chế retry tự động là bắt buộc. Mặc định mỗi hình có tối đa **2 lượt OpenAI
repair** sau source ban đầu và có thể cấu hình trong giới hạn an toàn. Retry hạ
tầng của BullMQ được đếm riêng, không gọi OpenAI và không tiêu repair budget.
Mọi lượt được lưu theo từng render job, không được tạo vòng lặp vô hạn.

Nếu vẫn thất bại:

- đánh dấu render failed;
- lưu source;
- lưu error log;
- giữ placeholder lỗi ngay tại block tương ứng;
- cho admin xóa, thay bằng ảnh upload, sinh lại bằng AI hoặc chỉnh source và
  render lại.

---

## 13. VALIDATOR VÀ KIỂM DUYỆT HÌNH SAU KHI RENDER

### 13.1. Validator SVG bắt buộc

Sau khi compile thành công, output phải đi qua validator và sanitizer local trước
khi tạo preview cho admin. Bước này chạy bằng code trong hệ thống, không gọi AI
Vision và không phát sinh chi phí provider.

Validator tối thiểu phải kiểm tra:

- SVG parse được và không rỗng;
- không có `script`, event handler, `foreignObject`, raw HTML hoặc executable content;
- không có external URL, network request, external image/font hoặc file reference;
- kích thước file, số node/path và độ phức tạp nằm trong giới hạn cấu hình;
- `viewBox`, width, height và aspect ratio hợp lệ;
- không có tọa độ `NaN`, vô hạn hoặc giá trị cực lớn ngoài giới hạn;
- số page/output đúng với render job;
- compile log không có lỗi font/glyph nghiêm trọng;
- màu và background tuân thủ light-theme profile đã chốt;
- output sau sanitize vẫn parse và render được.

Validator phải sanitize output theo whitelist rồi validate lại chính output đã
sanitize. Chỉ output sau sanitize mới được dùng làm SVG preview hoặc asset chính
thức.

Lỗi validator được phân loại:

- **Lỗi do source AI và có thể sửa:** gửi source cùng diagnostics ngắn gọn cho
  OpenAI sửa rồi compile lại; lượt này dùng chung giới hạn retry của render job.
- **Lỗi hạ tầng, container, converter hoặc sanitizer:** worker tự retry theo chính
  sách job hoặc đánh dấu failed; không gửi OpenAI vì model không sửa được lỗi hệ
  thống.
- **Lỗi nội dung, bố cục hoặc sư phạm:** không tự kết luận bằng validator; SVG
  hợp lệ kỹ thuật được coi là hình thành công, còn admin có quyền xóa, thay thế,
  sinh lại hoặc sửa source nếu thấy chưa đạt.

### 13.2. Trạng thái hình và quyền xử lý của admin

Compile thành công không đồng nghĩa hình chắc chắn đẹp hoặc đúng về mặt sư phạm.

Sau khi render thành công và qua validator, hệ thống upload asset lên R2, đánh
dấu hình `SUCCEEDED` và tạo preview để admin kiểm tra:

- hình có bị cắt không;
- nhãn có đè nhau không;
- chữ có quá nhỏ không;
- điểm có bị che không;
- hình có quá rối không;
- hình có thể hiện đúng nội dung cần minh họa không.

Pipeline chính thức không có bước AI Vision tự động. Không còn trạng thái
`NEEDS_REVIEW`/`APPROVED` riêng cho figure. Nếu hình chưa đạt, admin chỉnh source,
thay ảnh upload hoặc yêu cầu OpenAI sinh lại rồi đưa candidate mới qua pipeline.

```text
Compile + validator thành công
             ↓
    Lưu R2 + SUCCEEDED
             ↓
 Admin xem / sửa / thay / sinh lại / xóa
```

Nếu candidate sinh lại của một hình đang thành công bị lỗi, asset thành công cũ
vẫn được giữ và tiếp tục dùng; lỗi candidate không biến hình cũ thành placeholder
thất bại. Với hình chưa từng thành công, retry cạn tạo placeholder `FAILED` và
placeholder này phải được xóa, thay thế hoặc sinh/render lại thành công trước khi
nút Lưu/phát hành bật lại.

---

## 14. CHỨC NĂNG PHÍA ADMIN

Admin có thể:

- xem hình sau khi render;
- xem và sửa source LaTeX figure snippet;
- biên dịch thử source draft cục bộ và xem preview SVG đã sanitize;
- áp dụng atomically revision đã compile thành công;
- yêu cầu compile/retry lại hình;
- sinh lại riêng hình bằng AI;
- upload JPEG/PNG/WebP để thay riêng hình đó;
- xóa bất kỳ hình thành công hoặc placeholder lỗi nào.

Editor không có PDF preview, SyncTeX, click-preview-to-source, source map hoặc
edit session. LuaLaTeX vẫn tạo PDF tạm nội bộ để dvisvgm sinh SVG, nhưng renderer
xóa thư mục tạm ngay sau request và không trả/lưu PDF đó.

Ví dụ admin có thể yêu cầu:

- “Dịch điểm A sang trái một chút.”
- “Đừng để nhãn B đè lên đường tròn.”
- “Hai tam giác đặt xa nhau hơn.”
- “Thêm ký hiệu góc vuông tại H.”
- “Bỏ đường phụ này.”
- “Vẽ nét đứt đoạn MN.”
- “Làm hình đơn giản hơn.”

Trong phạm vi hiện tại, OpenAI tự sửa source khi compile/validator báo lỗi và
action `Sinh lại bằng AI` tạo source candidate mới cho đúng figure. Sửa source
thủ công rồi compile lại chỉ chạy local và không gọi OpenAI; `Sinh lại bằng AI`
có gọi provider và được tính usage/chi phí.

Admin có thể thay ảnh hoặc sinh lại nếu không muốn sửa TikZ; khi sửa thủ công,
admin can thiệp trực tiếp trong source editor rồi compile preview SVG.

---

## 15. LƯU TRỮ

Cloudflare R2 lưu:

- SVG đã compile + sanitize thành công;
- ảnh JPEG/PNG/WebP do admin upload để thay thế figure.

Candidate đang render chưa thay asset thành công hiện tại. Việc đổi sang asset
mới chỉ diễn ra nguyên tử sau khi compile/validate hoặc upload validation thành
công.

Database lưu metadata như:

- hình thuộc câu hỏi/lời giải nào;
- source LaTeX;
- source kind `AI_TEX | ADMIN_UPLOAD`;
- URL/file key asset hiện hành;
- AI model tạo hình;
- trạng thái render;
- trạng thái và phiên bản validator;
- hash của SVG sau sanitize;
- số lần retry;
- error log gần nhất khi cần;
- phiên bản source;
- current/pending revision và delivery file của revision thành công.

---

## 16. CACHE VÀ TÁI SỬ DỤNG

Hình sau khi render được cache.

Không gọi AI và không compile lại mỗi lần học sinh mở trang.

Luồng học sinh:

```text
Student request
      ↓
Database
      ↓
R2 SVG
      ↓
Frontend
```

AI/TeX Live chỉ chạy khi:

- hình chưa tồn tại;
- admin yêu cầu regenerate;
- source thay đổi;
- nội dung câu hỏi thay đổi;
- tài liệu nguồn thay đổi và hình cần tạo lại.

---

## 17. AN TOÀN KHI COMPILE SOURCE DO AI TẠO

LaTeX là một hệ thống có khả năng thực thi logic nên không được compile trực tiếp trong backend API chính.

Render phải chạy trong container sandbox riêng.

Yêu cầu:

- không chạy TeX trong API container;
- không chạy với quyền root;
- tắt `shell-escape`;
- không cho truy cập network;
- giới hạn CPU;
- giới hạn RAM;
- giới hạn thời gian compile;
- giới hạn kích thước source;
- giới hạn kích thước output;
- filesystem tạm thời;
- chỉ mount các thư mục cần thiết;
- tự xóa temporary files sau khi render.

Không cho source AI tự ý chạy:

- shell command;
- chương trình bên ngoài không được cho phép;
- network request;
- thao tác file ngoài thư mục sandbox.

---

## 18. CÀI PACKAGE

Không cài package động theo yêu cầu của AI trong lúc render.

Các package được cài sẵn trong image TeX Live của worker.

Nếu AI dùng cú pháp ngoài toolbox đã công bố:

- render báo lỗi;
- hệ thống yêu cầu AI tạo lại bằng công cụ hiện có, không cho AI tự khai package;
- hoặc developer quyết định bổ sung package vào image ở phiên bản sau.

Điều này giúp:

- môi trường ổn định;
- dễ reproduce;
- tránh dependency không kiểm soát;
- giảm rủi ro bảo mật.

---

## 19. VERSIONING MÔI TRƯỜNG TEX

Docker image của TeX renderer cần được version.

Ví dụ:

```text
classhero-tex-renderer:v1
classhero-tex-renderer:v2
```

Mỗi hình có thể lưu `renderer_version`.

Nhờ đó nếu sau này nâng cấp TeX Live hoặc package làm kết quả render thay đổi, hệ thống vẫn biết hình được tạo bởi môi trường nào.

---

## 20. FONT

Ưu tiên sử dụng font có license phù hợp và được đóng gói sẵn trong renderer.

Không phụ thuộc font cài trên VPS host.

Điều này giúp hình render đồng nhất giữa:

- dev;
- staging;
- production.

Font toán học và font chữ cần hiển thị tốt tiếng Việt.

---

## 21. OUTPUT CHÍNH

Định dạng ưu tiên:

**SVG**

Lý do:

- vector;
- sắc nét ở mọi kích thước;
- phù hợp màn hình điện thoại, tablet và desktop;
- nhẹ hơn ảnh raster trong nhiều trường hợp;
- zoom không vỡ;
- phù hợp với hình toán học và kỹ thuật.

PNG chỉ dùng khi:

- cần tương thích với luồng khác;
- cần thumbnail;
- hoặc SVG không phù hợp trong một trường hợp đặc biệt.

### 21.1. Theme của hình

Phiên bản đầu chỉ tạo hình ở **light theme**.

- Không gọi AI hoặc compile thêm một bản dark.
- Không tự đảo màu bằng CSS filter vì có thể làm sai màu ngữ nghĩa, độ tương phản
  hoặc màu nền/tô miền.
- Khi ClassHero đang ở dark theme, UI vẫn hiển thị hình bên trong một surface
  light riêng để giữ nguyên khả năng đọc và kết quả đã được admin duyệt.
- Source mới nên dùng một nhóm màu/palette chuẩn thay vì rải màu hard-code không
  có quy ước, để có thể bổ sung dark theme sau này mà không phải viết lại hình.

Nếu bổ sung dark theme trong tương lai, ưu tiên dùng cùng source và cùng hình
học, chỉ thay render profile/palette rồi compile thành variant riêng. Cách này
không làm thay đổi quan hệ toán học nhưng làm tăng số lượt compile, dung lượng
lưu trữ và ma trận visual review. Không yêu cầu AI viết lại toàn bộ source chỉ để
tạo dark theme, vì một lượt sinh độc lập sẽ làm tăng tính bất định và nguy cơ sai
khác giữa hai phiên bản.

---

## 22. HÌNH MINH HỌA KHÔNG MANG TÍNH KỸ THUẬT

LaTeX/TikZ là hệ thống chính cho **hình STEM và hình vector có cấu trúc**.

Không bắt buộc TikZ phải xử lý các hình mang tính tranh minh họa như:

- con vật chân thực;
- nhân vật;
- phong cảnh;
- tranh hoạt hình;
- ảnh đời sống.

Nếu bài học cần dạng hình này, có thể sử dụng hệ thống tạo ảnh AI hoặc asset riêng.

Việc này độc lập với STEM figure renderer.

---

## 23. KHÔNG SỬ DỤNG TRONG HỆ THỐNG MỚI

Bỏ hoàn toàn:

- `diagram_spec_json`;
- geometry DSL tự xây;
- raw SVG do AI tự viết làm renderer chính;
- GeoGebra cho hình tĩnh;
- JSXGraph cho hình tĩnh;
- renderer geometry tự phát triển.

Không cần ClassHero tự xây một engine toán học.

---

## 24. STACK CHỐT

```text
AI
└── OpenAI
      ↓
Core drawing fragment
      ↓
BullMQ
      ↓
NestJS Render Worker
      ↓
Docker Sandbox
└── TeX Live
    ├── LuaLaTeX
    ├── PGF/TikZ
    ├── tkz-euclide
    ├── pgfplots
    ├── tkz-tab
    ├── tikz-3dplot
    ├── circuitikz
    ├── chemfig
    ├── mhchem
    └── các TikZ libraries cần thiết
      ↓
SVG validator + sanitizer local
      ↓
SVG preview
      ↓
Admin duyệt
      ↓
Cloudflare R2 lưu SVG chính thức
      ↓
Next.js frontend
```

---

## 25. PHÂN CHIA TRÁCH NHIỆM

### OpenAI

Chịu trách nhiệm:

- hiểu bài;
- quyết định có cần hình;
- quyết định cần bao nhiêu hình;
- quyết định nội dung hình;
- quyết định bố cục;
- quyết định công cụ/cú pháp cần dùng trong toolbox đúng môn;
- viết LaTeX figure snippet bằng cú pháp và local header trong toolbox allowlist;
- sửa source khi compile lỗi;
- sửa hình khi admin yêu cầu.

### TeX Live

Chịu trách nhiệm:

- xử lý LaTeX;
- tính toán và dựng hình thông qua các package;
- tạo output vector.

### NestJS/BullMQ worker

Chịu trách nhiệm:

- quản lý job;
- chọn compiler profile theo subject snapshot và ghép document
  wrapper/package/library/preamble;
- sandbox;
- compile;
- timeout;
- retry;
- lấy error log;
- gọi AI sửa lỗi;
- chuyển output thành SVG;
- validate và sanitize SVG bằng code local;
- phân loại lỗi do source với lỗi hạ tầng trước khi quyết định retry;
- tạo SVG preview cho source draft của admin;
- upload SVG lên R2 ngay sau compile + validator thành công;
- cập nhật database.

### Cloudflare R2

Chịu trách nhiệm:

- lưu SVG;
- lưu ảnh JPEG/PNG/WebP do admin dùng để thay figure;
- phân phối file.

### Admin

Chịu trách nhiệm:

- xem kết quả và cảnh báo;
- render lại;
- yêu cầu AI chỉnh sửa;
- chỉnh source thủ công nếu muốn.

### Học sinh

Chỉ nhận hình SVG đã render.

Không chạy TeX hoặc source AI trên thiết bị học sinh.

---

## 26. KẾT LUẬN

Hệ thống vẽ hình của ClassHero sử dụng:

**TeX Live + LaTeX + PGF/TikZ ecosystem**

làm nền tảng chính cho hình tĩnh phục vụ Toán, Vật lý và Hóa học.

AI chịu trách nhiệm hiểu nội dung và sinh mã bằng hệ sinh thái LaTeX/TikZ có sẵn.

ClassHero không tự xây:

- ngôn ngữ mô tả hình;
- bộ primitive hình học;
- geometry engine;
- renderer toán học riêng.

Toàn bộ `diagram_spec_json` được loại bỏ khỏi thiết kế.

Kiến trúc cuối cùng:

```text
Nội dung
   ↓
OpenAI
   ↓
LaTeX/TikZ source
   ↓
TeX Live sandbox
   ↓
Compile lỗi? ─ Có → error log → OpenAI sửa mã → compile lại
   ↓ Không
Validator + sanitizer local
   ↓
Output không hợp lệ? → phân loại lỗi → OpenAI sửa mã hoặc worker retry/fail
   ↓ Hợp lệ
SVG preview
   ↓
Admin duyệt
   ↓
R2
   ↓
ClassHero
```

Đây là cơ chế vẽ hình STEM tĩnh chính thức của hệ thống.
