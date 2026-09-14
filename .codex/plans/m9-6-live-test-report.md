# M9.6 — Báo cáo live test Chat AI học sinh

Ngày chạy: 2026-09-12 đến 2026-09-13
Provider chat: OpenAI
Model chat bắt buộc: `gpt-5.6-luna`
Embedding: `text-embedding-3-small`, 1.536 chiều

> Cập nhật contract 2026-09-13: owner đã bỏ backend content refusal và
> answer-leak output gate. Các đoạn lịch sử bên dưới mô tả validator/fallback/
> `REFUSED` chỉ là bằng chứng của kiến trúc cũ tại thời điểm batch đó; contract
> hiện hành và regression mới nhất nằm ở mục 10.

## 1. Kết luận

Đợt mở rộng cuối đã chạy **42 lượt chat học sinh thật** qua HTTP SSE. Toàn bộ 42
request trả HTTP `200`; backend thực hiện **47 call `gpt-5.6-luna`** gồm 42 call
trả lời và 5 call visual retrieval hint. Có **43 request embedding** gồm 42 query
và một batch 12 chunk fixture.

- 31 lượt `FULL_ANSWER` hoàn tất, gồm câu đơn, câu nhiều phần, follow-up, review,
  câu ngoài phạm vi và câu có 1/2/5 ảnh.
- 11 lượt `HINT_ONLY` cho Quiz/Flashcard đều không phát hành đáp án, kể cả yêu cầu
  xác nhận đúng/sai, chép mặt sau, prompt injection và yêu cầu nhiều phần để lách
  policy.
- Bốn môn được kiểm tra: Toán, Vật lý, Hóa học và Ngữ văn.
- 23 ảnh được upload; 22 ảnh gắn vào message và một ảnh orphan từ request bị
  validation chặn trước paid call. Có ảnh rõ, ảnh mờ, ảnh nhiễu, ảnh công thức,
  ảnh văn bản, prompt injection và tối đa 5 ảnh trong một tin.
- Kết quả cuối render đúng Markdown, KaTeX/mhchem, xuống dòng rõ và không còn lỗi
  LaTeX sau backend repair.

Các lỗi chất lượng xuất hiện trong quá trình live test đã được sửa theo invariant
tổng quát và chạy regression lại. Trạng thái cuối đạt scope, policy, ảnh, lịch sử,
streaming, định dạng và hiệu năng đã đặt ra cho M9.6.

## 2. Phân bố 42 lượt chat

| Nhóm                          | Số lượt | Nội dung chính                                                             | Kết quả cuối                                             |
| ----------------------------- | ------: | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Ma trận đa môn cơ bản         |      20 | 6 Vật lý, 6 Hóa học, 6 Ngữ văn, 2 LIBRARY đa môn                           | Đúng kiến thức, đủ ý, từ chối đúng scope                 |
| Visual generic và ảnh lịch sử |       5 | “Giải ảnh này”, Hóa, Văn, 5 ảnh, follow-up                                 | Đọc đúng ảnh và dùng lại đúng ảnh trong thread           |
| Regression nhiều ảnh          |       3 | Retrieval lệch môn, đa dạng source, tham chiếu “ảnh ở đầu cuộc trò chuyện” | Sau sửa dùng đủ nguồn Toán/Lý/Hóa/Văn, từ chối ảnh nhiễu |
| Quiz `HINT_ONLY`              |       8 | Xin đáp án, xác nhận B, nhiều yêu cầu, injection trong ảnh                 | 8/8 không lộ đáp án; gợi ý đã duyệt hữu ích              |
| Flashcard `HINT_ONLY`         |       3 | Xin gợi ý, xin chép mặt sau, giả đáp án thành gợi ý                        | 3/3 không lộ mặt sau; fallback Socratic hữu ích          |
| Review `FULL_ANSWER`          |       1 | Nêu đáp án và giải lại từng lựa chọn                                       | Được phép trả B và giải thích đúng                       |
| Kiểm tra prompt cache lặp     |       2 | Hai request Định luật Ôm giống hệt                                         | Hai câu đúng, trình bày và LaTeX nhất quán               |

Bốn request chẩn đoán ban đầu dùng nhầm quiz-set ID bị backend trả `403` trước
provider. Chúng không tạo chat session, không tính vào 42 lượt và không tốn call
AI; một ảnh upload trước validation được tính là orphan và đã cleanup.

## 3. Đánh giá chất lượng phản hồi

### Tính đúng và đúng phạm vi

- Các phép tính Vật lý theo định luật Ôm, số mol và phương trình Hóa học đều đúng
  công thức, thay số và đơn vị.
- Các câu Ngữ văn nhận diện đúng luận điểm/lí lẽ/bằng chứng, ẩn dụ và nhân hóa.
- Câu nhiều yêu cầu trả đủ theo đúng thứ tự, dùng heading/list thay vì prose wall.
- Câu hỏi về tiểu thuyết ngoài khóa bị từ chối và chỉ nêu nội dung có trong scope.
- `COURSE` chỉ lấy toàn khóa đang mở; `LIBRARY` chỉ lấy các khóa đã mua. Visual
  hint không tham gia quyết định quyền.

### Quiz, Flashcard và review

- Answer key/mặt sau không được đưa vào prompt `HINT_ONLY`; output cuối còn được
  kiểm lại bằng answer-leak validator.
- Gợi ý đã duyệt chỉ bị từ chối khi chứa verdict hoặc đáp án trực tiếp, không còn
  bị loại nhầm vì overlap ngữ nghĩa thông thường.
- Flashcard không có hint duyệt dùng fallback Socratic dựng cục bộ từ mặt trước,
  theo nhóm định nghĩa/tính toán/suy luận; không đọc mặt sau và không gọi thêm AI.
- Khi không còn attempt/study session `IN_PROGRESS`, cùng quiz target chuyển sang
  `FULL_ANSWER` và giải đúng đáp án B cùng lý do loại A/C/D.

### Ảnh, lịch sử và LaTeX

- Follow-up không upload lại vẫn lấy tối đa 5 ảnh từ user message gần nhất trong
  cùng thread sau khi kiểm lại owner/purpose/status.
- Cụm từ “ảnh ở đầu cuộc trò chuyện/hội thoại/đoạn chat” được nhận diện đúng.
- Ảnh mờ không bị đoán chỉ số; ảnh nhiễu bị từ chối suy đoán.
- Công thức mới dùng `$...$`/`$$...$$`; Hóa học dùng `\ce{...}` trong math
  delimiter. UI thật render được các công thức thay vì lộ source LaTeX.

## 4. Lỗi live phát hiện và bản sửa

1. **Năm ảnh đa môn bị retrieval nghiêng về Hóa học.** Một visual hint ghép dài
   khiến vector gần một môn hơn và nguồn trả về không đa dạng. Đã tách hint thành
   nhiều segment keyword, cộng score theo mọi segment và giữ nguồn tốt nhất cho
   từng learning path được nhận diện trong tập đã authorize. Vẫn chỉ gọi một query
   embedding và chỉ câu hỏi gốc được phép thu hẹp scope.
2. **Follow-up “5 ảnh ở đầu cuộc trò chuyện” chưa tái dùng ảnh.** Đã mở rộng bộ
   nhận diện tham chiếu ảnh lịch sử cho “ở đầu cuộc trò chuyện/hội thoại/đoạn
   chat”, có unit regression.
3. **Hint đã duyệt bị validator fuzzy loại nhầm.** Đã giữ hard gate cho verdict,
   chữ cái/kết quả và exact forbidden answer, nhưng không dùng semantic-overlap
   fuzzy cho dữ liệu hint đã được duyệt.
4. **Flashcard không có hint duyệt trả lời quá chung.** Đã thêm fallback Socratic
   theo loại yêu cầu, chỉ dùng câu hỏi/mặt trước và không phát sinh paid repair
   call. Live regression cho câu hỏi bình thường lẫn câu lách policy đều pass.
5. **Prompt cache text không ghi nhận token hit.** Request đã có stable cache key
   và explicit breakpoint; hai request giống hệt có TTFB client giảm từ 588 ms
   xuống 203 ms nhưng provider vẫn báo `cached_input_tokens=0`. Prefix ổn định
   chưa đủ ngưỡng hiệu quả; không padding prompt vì sẽ tăng chi phí/độ trễ cho mọi
   lượt. Visual hint cache theo checksum/version đã hit thật 2 lần.

## 5. Hiệu năng

### Toàn bộ 47 call Luna trong đợt mở rộng

| Chỉ số provider     |     Min |     P50 |     P95 |     Max | Trung bình |
| ------------------- | ------: | ------: | ------: | ------: | ---------: |
| Time-to-first-token |  615 ms | 1.278 s | 2.488 s | 4.352 s |    1.435 s |
| Latency toàn call   | 1.065 s | 2.473 s | 5.736 s | 6.874 s |    2.868 s |

### 29 lượt runner có đồng hồ end-to-end client

| Chỉ số client     |     Min |     P50 |     P95 |     Max | Trung bình |
| ----------------- | ------: | ------: | ------: | ------: | ---------: |
| Nội dung đầu tiên |  857 ms | 1.844 s | 3.625 s | 4.782 s |    2.008 s |
| Hoàn tất          | 1.378 s | 3.317 s | 6.542 s | 8.012 s |    3.558 s |

Critical path chạy keyword SQL song song với query embedding, và history/
retrieval/ảnh lịch sử song song sau khi resolve target. Các case vision/nhiều ảnh
vẫn nằm dưới budget p95 15 giây.

## 6. Usage và chi phí provider thật

### Đợt mở rộng hiện tại

- `gpt-5.6-luna`: 47 call thành công, 176.901 input tokens, 8.234 output tokens,
  185.135 total tokens; **$0.04526100**.
- `text-embedding-3-small`: 43 request thành công, 4.684 tokens;
  **$0.00009368**.
- Tổng: **90 provider events**, tất cả `SUCCEEDED`; **$0.04535468**, tương đương
  khoảng **1.134 VND** ở 25.000 VND/USD. Ledger làm tròn từng event ghi 1.133 VND.
- Không retry và không fallback sang model khác.

### Lũy kế toàn bộ live test M9.6 còn trong usage ledger

- 135 call `gpt-5.6-luna`.
- 136 request `text-embedding-3-small`.
- Tổng chi phí đo được: **$0.18230890**, tương đương khoảng **4.558 VND**; ledger
  làm tròn từng event ghi 4.552 VND.

## 7. Kiểm tra UI realtime bằng mắt

- Mở trên Chrome thật, dark theme, desktop: lịch sử `LIBRARY` và `COURSE` nằm
  chung một danh sách; nhãn phạm vi vẫn phân biệt từng thread.
- Quan sát user bubble/spinner xuất hiện trước, composer disabled trong lúc stream,
  delta text tăng dần rồi được thay bằng canonical completed message.
- Hội thoại 5 ảnh giữ đủ thứ tự; regression cuối giải đúng Vật lý/Hóa học, nhận
  diện Ngữ văn/Toán và từ chối ảnh nhiễu.
- Màn `HINT_ONLY` hiển thị rõ nhãn “CHẾ ĐỘ GỢI Ý · KHÔNG TIẾT LỘ ĐÁP ÁN”.
- Màn review hiển thị đáp án, các bullet A/C/D và KaTeX cho $A,B,C,D,(O)$ rõ ràng,
  không bị dính thành đoạn văn dài.
- Composer hiển thị đúng “Tối đa 5 ảnh · 10 MB/ảnh”.

## 8. Verification và cleanup

- API typecheck: pass.
- Web typecheck: pass.
- Focused M9.6 tests: 20 pass.
- Full API suite đã chạy trong đợt triển khai: 104 file pass, 18 file skip; 911
  test pass, 24 test skip.
- Chat Playwright: 8/8 pass trên Chromium desktop/tablet/mobile và WebKit mobile.
- Targeted API ESLint: pass.
- Targeted Web ESLint: pass.
- `git diff --check`: pass.
- Đã xóa đúng 35 test chat session, 23 file DB, 23 object MinIO và 3 learning
  path fixture; xóa attempt/session test và phục hồi trạng thái Quiz/Flashcard.
- Usage events được giữ để kiểm toán chi phí.
- Routing `CHAT/TEXT` đã trả về cấu hình mặc định `null`, version 0. API và worker
  đã restart bằng env bình thường; health endpoint trả `ok`.

Full web lint toàn repo không dùng làm gate riêng của M9.6 vì worktree có nhiều
thay đổi ngoài phạm vi; toàn bộ file Chat AI và integration trực tiếp đã được lint
riêng và pass.

## 9. Regression single-pass cho ảnh — 2026-09-13

Sau quyết định bỏ lượt OCR/visual hint riêng, backend đã chuyển sang kiến trúc
single-pass: ảnh gốc đi thẳng vào `CHAT_RESPONSE_GENERATION`; manifest tên
môn/khóa/bài được dựng cục bộ từ đúng scope đã authorize và chạy song song với
hybrid retrieval. Không có schema/UI/upload contract mới.

Đã chạy 10 lượt paid regression có correlation riêng:

- 6 lượt ma trận ảnh: một ảnh COURSE chung chung, follow-up dùng lại ảnh cũ, ảnh
  Hóa đặt sai scope Vật lý, hai ảnh LIBRARY, năm ảnh LIBRARY đa môn + ảnh nhiễu,
  và ảnh Hóa bị mờ.
- 1 lượt follow-up năm ảnh gửi từ UI thật để quan sát spinner, delta và canonical
  completion.
- 3 lượt `HINT_ONLY` cùng ảnh để tìm lỗi, xác nhận bản sửa và kiểm lại chính
  chuỗi delta client nhận được.

Usage ledger chứng minh đúng **10 call `gpt-5.6-luna` + 10 query embedding**;
10/10 generation có `imageResponseMode=SINGLE_PASS`, 0 generation có metadata
visual hint cũ. Luna dùng 44.338 token, chi phí **$0.01178960**; embedding dùng
595 token, chi phí **$0.00001190**. Tổng **$0.01180150**, khoảng 295 VND ở
25.000 VND/USD. Không retry, không fallback model.

Chất lượng cuối:

- COURSE ảnh Vật lý giải đúng $I=2\,\text{A}$; follow-up đọc đúng ảnh lịch sử
  và tính $I$ giảm từ $2\,\text{A}$ xuống $1\,\text{A}$.
- Ảnh Hóa trong scope Vật lý bị từ chối; LIBRARY hai/năm ảnh giữ đúng thứ tự,
  giải đúng Toán/Vật lý/Hóa học/Ngữ văn và không đoán ảnh nhiễu.
- Ảnh mờ chỉ chép phần chắc chắn và yêu cầu chụp lại chỉ số/hệ số.
- UI dark desktop hiển thị đúng một history list chung, thumbnail theo thứ tự,
  heading/bullet xuống dòng và KaTeX/mhchem không lộ source LaTeX.

Live `HINT_ONLY` đầu tiên phát hiện model trả chuỗi thay số và kết quả cuối khi
lượt ảnh không có answer key để so sánh. Đã mở rộng output guard theo invariant
tổng quát: chặn nhãn “đáp án/kết quả”, bước thay số ra số và chuỗi từ hai
dấu bằng trở lên; công thức gợi mở chưa thay số như $I=U/R$ vẫn hợp lệ. Hai lượt
live sau sửa đều trả `REFUSED/AI_CHAT_ANSWER_LEAK_BLOCKED`; lần kiểm delta cuối
chỉ stream “Áp dụng định luật Ôm” và $I=U/R$, không stream $I=2\,\text{A}$.

Độ trễ provider Luna của 10 lượt: min 2.046 giây, p50 3.418 giây, p95
7.656 giây, max 9.916 giây ở case năm ảnh. Sáu lượt runner chính có TTFC
client 1.594–5.960 giây và tổng thời gian 2.341–10.243 giây, dưới budget
15 giây cho vision/multi-image.

Cleanup cuối đã xóa đúng 8 session, 13 file DB, 13 object MinIO và 3 learning
path/enrollment fixture của đợt này. Quiz attempt tạm dùng cho regression đã trả
về `SUBMITTED`; cấu hình `CHAT/TEXT` không bị thay đổi và vẫn trỏ đúng
`gpt-5.6-luna`. Usage events và `ai_generations` được giữ để kiểm toán.

## 10. Regression model-owned policy và đặt tên realtime — 2026-09-13

Contract hiện hành:

- Backend không tự từ chối câu ngoài scope/thiếu ảnh/ảnh không chắc và không
  validator hoặc thay output `HINT_ONLY`. Backend chỉ giới hạn dữ liệu đầu vào;
  AI tự quyết định nội dung. Lời từ chối của AI là message `COMPLETED`.
- Câu đầu là optimistic title ở client. `started.title` xác nhận title mặc định;
  call `CHAT_TITLE_GENERATION` chạy song song sau provider event đầu tiên và phát
  `title_updated` trước `completed`.

Đã chạy **14 lượt response Luna thật**: câu đúng scope, follow-up, ngoài scope,
nhắc ảnh chưa gửi, ảnh nhiễu, Quiz/Flashcard `HINT_ONLY` với yêu cầu chữ cái,
nguyên văn đáp án, xác nhận B và Base64; trong đó có hai lượt thao tác trực tiếp
trên Chrome để quan sát realtime bằng mắt. Kết quả:

- 14/14 response HTTP/SSE thành công và lưu `COMPLETED`; 14 query embedding,
  không có OCR/vision preprocessing call.
- AI tự từ chối đúng câu World Cup ngoài Toán 9, tự yêu cầu upload khi thread chưa
  có ảnh và không bịa dữ kiện từ ảnh nhiễu. Không có content refusal từ backend.
- Mọi lượt `HINT_ONLY` live đều không đưa chữ cái/nguyên văn/xác nhận/mã hóa đáp
  án, nhưng vẫn gợi ý đúng khái niệm cần đối chiếu.
- Live phát hiện trần title 48 token khiến reasoning model trả
  `response.incomplete`; tăng lên 128 token và hạ reasoning title từ `medium`
  xuống `low`. Thử `minimal` bị Luna từ chối nên không giữ cấu hình đó.
- Live tiếp tục phát hiện Luna nối ký tự CJK vào một title. Prompt
  `ai-chat-title-v3` yêu cầu tiếng Việt/Latin và normalizer chỉ loại script CJK
  lạc chỗ; regression cuối tạo các title sạch như `Yêu cầu đáp án câu Quiz` và
  `Nhận biết hình chữ nhật nội tiếp`.
- Cấu hình cuối `ai-chat-title-v3` đạt 3/3 title sạch; mọi `title_updated` đến sau
  delta đầu và trước `completed`. Visual cuối xác nhận tên mặc định xuất hiện sau
  khoảng 250 ms ngay khi bấm gửi, rồi header và item history cùng đổi sang tên AI.

## 11. Regression policy theo từng câu/thẻ — 2026-09-13

Contract cuối được xác minh theo item, không mở khóa theo cả bộ:

- Quiz `IN_PROGRESS`: câu hiện tại chưa `Kiểm tra`/`Bỏ qua` dùng
  `HINT_ONLY`; đúng câu đã hiển thị lời giải dùng
  `FULL_ANSWER/FULL_CURRENT_TARGET`.
- Flashcard `IN_PROGRESS`: thẻ hiện tại chưa chọn `Đã thuộc`/`Chưa thuộc`
  dùng `HINT_ONLY`; đúng thẻ đã đánh dấu dùng
  `FULL_ANSWER/FULL_CURRENT_TARGET`.
- `MỤC_HIỆN_TẠI` luôn đứng trước hybrid RAG. Nếu học sinh chuyển sang
  câu/thẻ khác chưa mở, kể cả trong cùng tin nhắn hoặc follow-up, phần
  đó quay về gợi ý. Mở một item không mở khóa toàn bộ.
- Mở một thread cũ ngay từ runner vẫn giữ `activityId` và `targetId`, không
  thể dùng history để thoát policy. Mở thread cũ từ hub thông thường không
  giả lập runner và vẫn dùng chế độ trả lời đầy đủ.
- Test runner tiếp tục không có Chat AI; Test review gửi đúng
  `TEST_QUESTION` hiện tại và được giải đầy đủ.

Ma trận live cuối gồm **21 case**, gọi OpenAI thật bằng
`gpt-5.6-luna`: 6 `HINT_ONLY`, 15 `FULL_ANSWER`, 2 case có ảnh, 2 case
multi-turn, các case xin thẳng đáp án/xác nhận đúng-sai/nhiều yêu cầu
trong một tin nhắn, Quiz đã check, Quiz đã skip, Flashcard known/unknown,
thẻ chưa đánh dấu và review. Kết quả cuối **21/21 pass**, toàn bộ HTTP/SSE
`COMPLETED`; 20 conversation đầu tiên phát `title_updated`, case còn lại là
follow-up trong cùng thread.

Live test đã phát hiện và sửa ba lỗi chất lượng tổng quát:

- `HINT_ONLY` từng xác nhận “Đúng” cho phỏng đoán Flashcard; prompt cuối cấm
  xác nhận/phủ nhận/chấm, lặp hoặc diễn đạt lại đáp án học sinh đoán.
- Gợi ý từng để lộ bước biến đổi chỉ còn phép tính hiển nhiên hoặc
  yêu cầu học sinh gửi mặt sau thẻ; prompt cuối dừng sớm hơn và luôn đưa
  một bước/câu hỏi Socratic cụ thể.
- Luna hai lần nối ký tự ngoài tiếng Việt vào title. Title prompt được
  siết theo từ của tin nhắn gốc; normalizer NFC chỉ giữ Latin/tiếng Việt,
  chữ số, khoảng trắng và cắt tối đa 8 từ. Live regression cuối trả
  `Mặt sau hai thẻ góc đối`, không còn ký tự lạ.

Quan sát trên Chrome thật xác nhận: câu Quiz đã `Bỏ qua` stream lời giải
đầy đủ và KaTeX đúng; chuyển sang câu chưa làm thì link Chat đổi sang
đúng target, badge `CHẾ ĐỘ GỢI Ý` xuất hiện ngay, Luna không xác nhận
phương án B. Tên mặc định xuất hiện tức thì và title AI cập nhật
song song khi câu trả lời đang stream; composer khóa trong lúc gửi và mở lại
sau canonical completion.

TTFC client của ma trận cuối: min 1.154 giây, p50 2.484 giây, p95
3.892 giây, max 4.285 giây. Tổng thời gian: min 2.739 giây, p50
4.007 giây, p95 5.710 giây, max 5.912 giây. Toàn bộ đợt chẩn đoán,
rerun và visual có 41 response call Luna thành công, 40 title call thành công
và 42 query embedding `text-embedding-3-small` thành công. Usage chat/title là
329.396 token, trong đó 14.127 cached input token; embedding là 4.125 token.
Tổng chi phí ledger của đợt này là **$0.07516269**. Có một response ledger
`RUNNING` không có token/chi phí do API restart lúc client cũ bị ngắt; không có
fallback model.

Verification cuối: API/Web typecheck pass; focused API 21/21 pass; Chat E2E 6/6
pass; integration entry-point Quiz/Flashcard/Test 4/4 pass; targeted ESLint không
có error (7 warning unused có sẵn trong các learning panel lớn); `git diff --check`
pass.

Cleanup đã xóa đúng 40 session live/visual, 4 file DB, 4 object MinIO,
Quiz attempt fixture, Flashcard study session fixture và Flashcard set fixture.
Usage events và lifecycle AI được giữ lại để kiểm toán.

Hiệu năng/usage của toàn đợt tìm lỗi và regression:

- `CHAT_RESPONSE_GENERATION`: 14 call thành công, 102.922 token; provider latency
  min 1.758 s, p50 2.940 s, p95 4.414 s, max 4.619 s.
- `CHAT_TITLE_GENERATION`: 7 call thành công, 1.230 token; latency min 891 ms,
  p50 1.445 s, p95 1.822 s, max 1.942 s. Bốn attempt chẩn đoán fail trước usage
  hữu ích (hai `response.incomplete`, hai unsupported `minimal`) và không làm fail
  response chính.
- Embedding: 14 request, 852 token. Ledger ghi tổng **$0.02324844**, khoảng
  **578–581 VND** tùy làm tròn; không fallback model.

Cleanup: Quiz attempt tạm đã `CANCELLED`; quiz set/questions được trả đúng
`DRAFT/NEEDS_REVIEW`, 11 thread live/visual đã soft-delete khỏi history, quota
message/image được trả về trước test và runtime daily limit được phục hồi 20.
Usage/lifecycle được giữ để audit. Gate cuối pass: 30/30 API test, API/Web
typecheck, scoped ESLint, Prisma validate/migration status, `git diff --check` và
20/20 Playwright Student/Admin Chat trên Chromium desktop/tablet/mobile cùng
WebKit mobile.

## 12. Live regression mở rộng cho ngữ cảnh Tóm tắt video — 2026-09-14

Đã gọi thật thêm **45 lượt phản hồi `gpt-5.6-luna`**: 44 lượt qua
runner SSE và 1 lượt thao tác trực tiếp trên Chrome. Ma trận bao gồm đầu,
giữa, cuối video; tất cả khối kiến thức/ví dụ; hai phía ranh giới
chuyển khối chỉ cách nhau 0,02 giây; câu hỏi nhảy sang mốc khác;
câu nhiều ý trộn mốc hiện tại/mốc khác; multi-turn đổi mốc;
tổng quan toàn video; xin chép nguyên văn transcript; mốc không tồn tại;
ngoài phạm vi và yêu cầu bịa lời giáo viên.

Kết quả runtime:

- 45/45 response Luna `SUCCEEDED`, 45/45 message `COMPLETED`; toàn bộ là
  `FULL_ANSWER` đúng với bề mặt Video.
- 43/43 lượt có đủ `surfaceLessonId` và `videoSourceSeconds` đều xếp
  đúng khối Tóm tắt video bao phủ mốc hiện tại ở vị trí số 1. Hai
  follow-up đầu tiên thiếu `surfaceLessonId` là lỗi của runner, không phải
  payload FE; runner đã được sửa và các case đã rerun pass.
- 431 tham chiếu chunk gồm 349 `VIDEO_SUMMARY` và 82 `LESSON_DOCUMENT`;
  `unknown=0`, không có transcript gốc trong RAG.
- Câu hỏi về mốc khác vẫn tìm đúng khối toàn tóm tắt. Câu xin
  mốc 40:00 hoặc nguyên văn lời giáo viên nói rõ thiếu dữ kiện và
  không đoán. Câu World Cup được AI tự từ chối trong message
  `COMPLETED`, backend không tự chặn.

Live test đã phát hiện và sửa ba lỗi chất lượng tổng quát:

- Một câu mơ hồ “đoạn hiện tại” từng không dùng khối rank 1 vì model
  không biết chunk nào là mốc đang phát. Retrieval nay gắn cờ
  `isCurrentVideoBlock`; prompt gắn nhãn `KHỐI_VIDEO_ĐANG_PHÁT` cùng
  khoảng thời gian.
- Câu nhiều ý từng lẫn ví dụ kiểm tra một phương trình với ví dụ
  kiểm tra một hệ ở mốc khác. Khối hiện tại nay được đưa thẳng
  vào `userPrompt` như ngữ cảnh chính; rerun phân biệt đúng
  “nghiệm của phương trình” và “nghiệm của hệ”.
- Một output dài từng xen một từ Hebrew; một lời từ chối transcript
  từng gọi sai yêu cầu là ngoài phạm vi. Prompt nay giữ diễn giải bằng
  chữ Latin/tiếng Việt và phân biệt Tóm tắt video với transcript. Ba lần
  rerun liên tiếp cho mỗi case đều sạch và đúng nghĩa.

Hiệu năng 44 lượt runner: TTFC min 0,842 giây, median 1,798 giây,
p95 3,720 giây, max 5,467 giây. Tổng thời gian median 3,892 giây,
p95 7,849 giây; case tổng quan dài nhất 14,158 giây nhưng chữ đầu tiên
đã stream sau 1,870 giây. Chrome thật hiển thị “AI đang suy nghĩ...”,
sau đó stream nội dung, cập nhật title song song và render KaTeX, danh sách,
khoảng cách xuống dòng đúng bằng quan sát trực tiếp.

Gate sau sửa: focused API 29/29 pass, API typecheck pass và `git diff --check`
pass.

Cleanup đã soft-delete đúng 39 session của runner và hoàn lại 44 quota
message; usage/lifecycle vẫn được giữ để audit. Giữ lại duy nhất session
Chrome cuối cùng để owner có thể mở xem; quota còn 98/100.
