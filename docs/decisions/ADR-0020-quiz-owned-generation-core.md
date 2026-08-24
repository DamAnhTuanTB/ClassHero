# ADR-0020 - Quiz sở hữu lõi sinh nội dung riêng

Date: 2026-08-21
Status: Accepted

## Context

Luồng sinh Quiz từng dùng các schema, subject profile, prompt helper, mapper,
`EXAMPLE` block và component hiển thị được tạo trước cho luồng Sinh kiến thức.
Điều này làm thay đổi của Summary có thể tác động trực tiếp tới Quiz và khiến
contract persisted của Quiz mang ngữ nghĩa của một feature khác.

Owner chốt Sinh kiến thức là một luồng độc lập. Mọi luồng khác muốn có hành vi
tương tự phải tự sở hữu phiên bản của mình, không import hoặc gọi lõi của Sinh
kiến thức.

## Decision

- Toàn bộ file `lesson-summary-*`, schema block Summary, Summary subject
  profile, Summary mapper/context/worker và component Summary là private core
  của Sinh kiến thức.
- Quiz sở hữu riêng schema provider output, subject resolver/profile, prompt,
  context snapshot/retrieval, job service, mapper, worker persistence, form cấu
  hình, document readiness và renderer lời giải.
- Quiz persist structured explanation ở
  `quiz_questions.source_metadata_json.quizExplanationBlock` với
  `type=quizExplanation`; student API trả field `explanationBlock`.
- Có thể sao chép và thích nghi invariant đã ổn định của Summary vào code Quiz
  (solution kiểu SGK, độc lập với hình, phân loại `isGeometry` và GT–KL theo lớp),
  nhưng không import constant/schema/helper runtime từ Summary. Tái sử dụng theo
  ngữ nghĩa, không bê máy móc provenance/crop/block contract không thuộc Quiz.
- Prompt Quiz phải giữ ở mức invariant tổng quát. Lỗi quan sát được trong một
  bài live trở thành regression case, không trở thành câu lệnh production riêng
  cho đúng quan hệ, dạng bài hay hình đó; chỉ sửa prompt khi có thể khái quát lỗi
  về tính đúng chuyên môn, nội dung tối thiểu hoặc annotation không mơ hồ.
- Do hình Quiz được dựng mới mà không có ảnh mẫu, prompt Phase 2 được phép có
  visual grammar cụ thể ở cấp quan hệ/ký hiệu chuyên môn và tách theo môn (chẳng
  hạn cách biểu diễn vuông góc, trung điểm, vector, liên kết hóa học). Không được
  biến checklist này thành danh sách vá theo lesson, tên điểm, số liệu hay một
  output live cụ thể.
- `isGeometry`/GT–KL và figure là hai quyết định độc lập. Một câu Hình học hoặc có
  bảng GT–KL không mặc nhiên cần hình; chỉ sinh figure khi hình có giá trị sư phạm
  thật sự cho chính câu đó.
- Đây là hard cutover. Runtime không đọc `exampleBlock`, không trả
  `explanationExampleBlock` và không có adapter tương thích ngược. Dữ liệu Quiz
  cũ theo shape Summary phải được sinh lại hoặc chuyển đổi bằng một migration
  riêng được owner yêu cầu sau.
- Hạ tầng trung lập vẫn được dùng chung: `AiProvider`, lifecycle/background job,
  model routing, budget/usage accounting, Prisma, BullMQ và retrieval primitive.
  Các lớp này không được chứa schema/prompt/mapper/UI contract của Summary.
- Flashcard, Test hoặc flow khác không được import Summary core. Nếu cần cùng
  loại khả năng, flow đó phải tạo implementation thuộc domain của chính nó.

## Consequences

- Thay đổi Summary không còn làm đổi contract hoặc UI Quiz.
- Quiz có version prompt/schema riêng và boundary test ngăn import ngược vào
  Summary/lesson-content core.
- Không có tương thích ngược nên các Quiz cũ chỉ có `exampleBlock` sẽ không hiện
  structured explanation sau deploy.
- Có một mức lặp có chủ đích giữa các domain; chỉ hạ tầng thật sự trung lập mới
  được nâng lên shared layer.
