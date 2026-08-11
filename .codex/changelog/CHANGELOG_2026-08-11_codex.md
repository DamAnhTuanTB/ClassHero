# 2026-08-11

- 2026-08-11: Hoàn thiện corrective M9.2–M9.3/M9.8 với Quiz dùng chung cấu trúc ví dụ và hình minh họa, cơ chế partial recovery/kiểm tra GT–KL, chỉnh sửa và reset hình trực tiếp, prompt System/User round-trip nguyên vẹn, chuẩn hóa lỗi hiển thị cho người dùng, cùng các API/UI/test/docs liên quan.
- 2026-08-11: Bổ sung serializer Structured Output dùng `$defs`/`$ref` có feature flag rollback cho Summary, giữ nguyên contract/parser, đồng bộ preview và job fingerprint, giảm mạnh kích thước schema, đồng thời thêm regression test và live A/B cho nội dung, hình học cùng các nguồn nhỏ.
- 2026-08-11: Tối ưu an toàn tiếp input Sinh kiến thức bằng strategy `$defs`/`$ref` v2 tương đương schema cũ và Prompt Caching có cache key, retention, capability gate, rollback độc lập, preview/observability đồng bộ, cùng regression, historical-artifact và live comparison xác nhận prompt/context/output contract không đổi.
