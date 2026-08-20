# ADR-0016 - Searchable PDF packet và multimodal Summary

Date: 2026-08-14
Status: Accepted

## Context

Summary cũ gửi các OCR chunks lặp nội dung, mất bố cục trang và tách hình khỏi
ngữ cảnh sách. Toán 12 hiện dùng PDF scan thuần; Toán 7 có PDF searchable. Paid
OCR artifact, crop/page mapping và chi phí đã phát sinh phải được giữ nguyên khi
thêm text layer vào bản scan.

## Decision

- Canonical source của Summary là searchable PDF đã qua equivalence gate toàn
  tài liệu. Promote đổi file atomically nhưng không đổi active OCR artifact,
  page mapping, chunks hoặc paid-provider lineage.
- Mỗi prompt preview dựng một PDF packet deterministic theo document/range/page,
  kèm manifest, schema, prompt và model config trong request draft immutable.
  Generate chỉ consume đúng draft còn fresh và gửi packet bằng OpenAI
  `input_file` ở `detail=high`; không ghép OCR chunks vào prompt.
- Stage 1 trả section provenance cùng owner-local `figures[]`. Stage 2 resolve
  crop/full-page reference, snapshot brief + ảnh theo revision rồi mới yêu cầu AI
  sinh TikZ snippet. Source reference được ưu tiên để tái hiện bố cục/quan hệ/
  nhãn/phong cách SGK; màu không cần pixel-match.
- Chỉ `TEX_COMPILE_FAILED` có diagnostic batch đầy đủ được auto repair có giới
  hạn và phải gửi toàn bộ lỗi/log của đúng lượt compiler. Source policy,
  validator, provider, timeout, network, storage và hạ tầng không auto retry.
- Tách metric provider output, source-policy, compiler invoked, first-pass và
  repair; admin vẫn dùng lifecycle sửa draft/apply, retry thủ công, sinh mới,
  upload thay và xóa như trước.

## Consequences

- Summary đọc được bố cục, hình và text trong cùng packet, giảm duplication và
  cho phép đối chiếu nguồn trực tiếp.
- PDF scan phải có bước tạo searchable + equivalence review trước khi dùng; đây
  là thao tác vận hành riêng, không được fallback ngầm sang chunks.
- Request draft/packet/reference snapshot cần TTL và cleanup; OpenAI file tạm
  luôn phải xóa trong `finally`.
- Multimodal input cải thiện độ tương đồng nhưng không thay thế review thị giác;
  publish vẫn cần asset figure hợp lệ và admin chịu trách nhiệm chất lượng.
