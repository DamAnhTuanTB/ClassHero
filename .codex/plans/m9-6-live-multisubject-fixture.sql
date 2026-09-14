-- Local-only, deterministic fixture for the paid M9.6 multi-subject live matrix.
-- These rows must be removed after exporting the live-test evidence.

INSERT INTO domains (id, name, slug, sort_order, created_at, updated_at)
VALUES
  ('96000000-0000-4000-8000-000000000001', 'Vật lý', 'm96-live-vat-ly', 9601, now(), now()),
  ('96000000-0000-4000-8000-000000000002', 'Hóa học', 'm96-live-hoa-hoc', 9602, now(), now()),
  ('96000000-0000-4000-8000-000000000003', 'Ngữ văn', 'm96-live-ngu-van', 9603, now(), now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = now();

INSERT INTO learning_paths (
  id, kind, domain_id, title, slug, original_price_vnd, sale_price_vnd,
  total_lesson_count, status, published_at, sort_order, created_by_id,
  updated_by_id, created_at, updated_at
)
VALUES
  ('96100000-0000-4000-8000-000000000001', 'CATALOG', '96000000-0000-4000-8000-000000000001', 'M9.6 Live · Vật lý 9', 'm96-live-vat-ly-9', 1000, 1000, 2, 'PUBLISHED', now(), 9601, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now()),
  ('96200000-0000-4000-8000-000000000001', 'CATALOG', '96000000-0000-4000-8000-000000000002', 'M9.6 Live · Hóa học 9', 'm96-live-hoa-hoc-9', 1000, 1000, 2, 'PUBLISHED', now(), 9602, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now()),
  ('96300000-0000-4000-8000-000000000001', 'CATALOG', '96000000-0000-4000-8000-000000000003', 'M9.6 Live · Ngữ văn 9', 'm96-live-ngu-van-9', 1000, 1000, 2, 'PUBLISHED', now(), 9603, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, deleted_at = NULL, updated_at = now();

INSERT INTO lessons (
  id, learning_path_id, order_index, title, short_description, status,
  created_by_id, updated_by_id, created_at, updated_at
)
VALUES
  ('96100000-0000-4000-8000-000000000011', '96100000-0000-4000-8000-000000000001', 1, 'Định luật Ôm', 'Hiệu điện thế, cường độ dòng điện và điện trở.', 'PUBLISHED', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now()),
  ('96100000-0000-4000-8000-000000000012', '96100000-0000-4000-8000-000000000001', 2, 'Mạch điện nối tiếp', 'Quy tắc cường độ dòng điện và điện trở tương đương.', 'PUBLISHED', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now()),
  ('96200000-0000-4000-8000-000000000011', '96200000-0000-4000-8000-000000000001', 1, 'Mol và khối lượng mol', 'Quan hệ giữa số mol, khối lượng và khối lượng mol.', 'PUBLISHED', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now()),
  ('96200000-0000-4000-8000-000000000012', '96200000-0000-4000-8000-000000000001', 2, 'Phương trình hóa học', 'Cân bằng và ý nghĩa hệ số phản ứng.', 'PUBLISHED', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now()),
  ('96300000-0000-4000-8000-000000000011', '96300000-0000-4000-8000-000000000001', 1, 'Luận điểm và bằng chứng', 'Cấu trúc cơ bản của đoạn văn nghị luận.', 'PUBLISHED', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now()),
  ('96300000-0000-4000-8000-000000000012', '96300000-0000-4000-8000-000000000001', 2, 'Ẩn dụ và nhân hóa', 'Nhận biết và phân tích tác dụng của hai biện pháp tu từ.', 'PUBLISHED', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', now(), now())
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, deleted_at = NULL, updated_at = now();

INSERT INTO files (
  id, provider, purpose, bucket, object_key, original_name, mime_type,
  size_bytes, visibility, status, uploaded_by_id, created_at, updated_at
)
SELECT
  ('96400000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'MINIO_LOCAL', 'LESSON_DOCUMENT', 'm96-live-fixture',
  'm96/live/multisubject/' || series || '.txt', 'm96-live-' || series || '.txt',
  'text/plain', 1, 'PRIVATE', 'READY',
  '00000000-0000-4000-8000-000000000001', now(), now()
FROM generate_series(1, 6) AS series
ON CONFLICT (id) DO UPDATE SET status = 'READY', deleted_at = NULL, updated_at = now();

INSERT INTO lesson_documents (
  id, lesson_id, file_id, kind, sort_order, title, status, extracted_text,
  content_hash, chunk_count, processed_at, created_at, updated_at
)
VALUES
  ('96500000-0000-4000-8000-000000000001', '96100000-0000-4000-8000-000000000011', '96400000-0000-4000-8000-000000000001', 'SUPPLEMENT', 0, 'Định luật Ôm', 'READY', 'Định luật Ôm và ví dụ áp dụng.', 'm96-physics-ohm', 2, now(), now(), now()),
  ('96500000-0000-4000-8000-000000000002', '96100000-0000-4000-8000-000000000012', '96400000-0000-4000-8000-000000000002', 'SUPPLEMENT', 0, 'Mạch nối tiếp', 'READY', 'Cường độ dòng điện và điện trở trong mạch nối tiếp.', 'm96-physics-series', 2, now(), now(), now()),
  ('96500000-0000-4000-8000-000000000003', '96200000-0000-4000-8000-000000000011', '96400000-0000-4000-8000-000000000003', 'SUPPLEMENT', 0, 'Mol', 'READY', 'Mol, khối lượng và khối lượng mol.', 'm96-chem-mol', 2, now(), now(), now()),
  ('96500000-0000-4000-8000-000000000004', '96200000-0000-4000-8000-000000000012', '96400000-0000-4000-8000-000000000004', 'SUPPLEMENT', 0, 'Phương trình hóa học', 'READY', 'Cân bằng phương trình hóa học.', 'm96-chem-equation', 2, now(), now(), now()),
  ('96500000-0000-4000-8000-000000000005', '96300000-0000-4000-8000-000000000011', '96400000-0000-4000-8000-000000000005', 'SUPPLEMENT', 0, 'Nghị luận', 'READY', 'Luận điểm, lí lẽ và bằng chứng.', 'm96-literature-argument', 2, now(), now(), now()),
  ('96500000-0000-4000-8000-000000000006', '96300000-0000-4000-8000-000000000012', '96400000-0000-4000-8000-000000000006', 'SUPPLEMENT', 0, 'Biện pháp tu từ', 'READY', 'Ẩn dụ và nhân hóa.', 'm96-literature-figure', 2, now(), now(), now())
ON CONFLICT (id) DO UPDATE SET status = 'READY', replaced_at = NULL, updated_at = now();

INSERT INTO document_chunks (
  id, document_id, lesson_id, chunk_index, content, content_hash, token_count,
  created_at
)
VALUES
  ('96600000-0000-4000-8000-000000000001', '96500000-0000-4000-8000-000000000001', '96100000-0000-4000-8000-000000000011', 0, 'Định luật Ôm: cường độ dòng điện I chạy qua dây dẫn tỉ lệ thuận với hiệu điện thế U và tỉ lệ nghịch với điện trở R. Công thức I = U / R hay U = I R. U đo bằng vôn, I đo bằng ampe, R đo bằng ôm.', 'm96-physics-ohm-1', 58, now()),
  ('96600000-0000-4000-8000-000000000002', '96500000-0000-4000-8000-000000000001', '96100000-0000-4000-8000-000000000011', 1, 'Ví dụ: đặt hiệu điện thế 12 V vào điện trở 6 ohm thì cường độ dòng điện là I = 12 / 6 = 2 A. Cần đổi về đơn vị vôn, ampe và ôm trước khi thay số.', 'm96-physics-ohm-2', 46, now()),
  ('96600000-0000-4000-8000-000000000003', '96500000-0000-4000-8000-000000000002', '96100000-0000-4000-8000-000000000012', 0, 'Mạch điện nối tiếp: cường độ dòng điện có cùng giá trị tại mọi vị trí, I = I1 = I2. Hiệu điện thế toàn mạch bằng tổng hiệu điện thế thành phần, U = U1 + U2. Điện trở tương đương R = R1 + R2.', 'm96-physics-series-1', 55, now()),
  ('96600000-0000-4000-8000-000000000004', '96500000-0000-4000-8000-000000000002', '96100000-0000-4000-8000-000000000012', 1, 'Trong mạch nối tiếp, dòng điện không bị chia nhánh. Nhận định I = I1 + I2 là sai đối với mạch nối tiếp nhưng phù hợp với quy tắc dòng điện tại điểm phân nhánh của mạch song song.', 'm96-physics-series-2', 49, now()),
  ('96600000-0000-4000-8000-000000000005', '96500000-0000-4000-8000-000000000003', '96200000-0000-4000-8000-000000000011', 0, 'Số mol n, khối lượng m và khối lượng mol M liên hệ bởi n = m / M. Đơn vị thường dùng: m tính bằng gam, M tính bằng gam trên mol và n tính bằng mol.', 'm96-chem-mol-1', 43, now()),
  ('96600000-0000-4000-8000-000000000006', '96500000-0000-4000-8000-000000000003', '96200000-0000-4000-8000-000000000011', 1, 'Khối lượng mol của nước H2O là 18 g/mol. Vì vậy 18 g nước ứng với 1 mol và 9 g nước ứng với 0,5 mol.', 'm96-chem-mol-2', 37, now()),
  ('96600000-0000-4000-8000-000000000007', '96500000-0000-4000-8000-000000000004', '96200000-0000-4000-8000-000000000012', 0, 'Phương trình 2 H2 + O2 -> 2 H2O đã cân bằng. Hệ số cho biết tỉ lệ số mol: 2 mol hiđro phản ứng với 1 mol oxi tạo thành 2 mol nước. Không được thay đổi chỉ số nhỏ trong công thức hóa học để cân bằng.', 'm96-chem-equation-1', 55, now()),
  ('96600000-0000-4000-8000-000000000008', '96500000-0000-4000-8000-000000000004', '96200000-0000-4000-8000-000000000012', 1, 'Khi cân bằng phương trình hóa học, đặt hệ số nguyên tối giản trước các công thức để số nguyên tử của mỗi nguyên tố bằng nhau ở hai vế. Kiểm tra lại từng nguyên tố sau khi cân bằng.', 'm96-chem-equation-2', 45, now()),
  ('96600000-0000-4000-8000-000000000009', '96500000-0000-4000-8000-000000000005', '96300000-0000-4000-8000-000000000011', 0, 'Đoạn văn nghị luận cần có luận điểm rõ ràng. Lí lẽ giải thích vì sao luận điểm hợp lí; bằng chứng là sự việc, số liệu hoặc chi tiết tiêu biểu làm căn cứ. Bằng chứng phải liên quan trực tiếp tới luận điểm.', 'm96-literature-argument-1', 49, now()),
  ('96600000-0000-4000-8000-000000000010', '96500000-0000-4000-8000-000000000005', '96300000-0000-4000-8000-000000000011', 1, 'Cách trình bày ngắn: nêu luận điểm, đưa lí lẽ, dẫn bằng chứng rồi phân tích mối liên hệ giữa bằng chứng và luận điểm. Không chỉ kể lại bằng chứng mà thiếu phần phân tích.', 'm96-literature-argument-2', 43, now()),
  ('96600000-0000-4000-8000-000000000011', '96500000-0000-4000-8000-000000000006', '96300000-0000-4000-8000-000000000012', 0, 'Ẩn dụ gọi tên sự vật hoặc hiện tượng này bằng tên sự vật hoặc hiện tượng khác dựa trên nét tương đồng. Tác dụng thường là làm cách diễn đạt cô đọng, gợi hình và gợi cảm.', 'm96-literature-figure-1', 43, now()),
  ('96600000-0000-4000-8000-000000000012', '96500000-0000-4000-8000-000000000006', '96300000-0000-4000-8000-000000000012', 1, 'Nhân hóa dùng từ ngữ vốn dành cho con người để gọi hoặc miêu tả sự vật, cây cối hay con vật. Cần dựa vào dấu hiệu ngôn ngữ cụ thể và phân tích tác dụng trong ngữ cảnh.', 'm96-literature-figure-2', 44, now())
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, content_hash = EXCLUDED.content_hash;

INSERT INTO enrollments (
  id, student_user_id, learning_path_id, status, starts_at, expires_at,
  created_at, updated_at
)
VALUES
  ('96700000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '96100000-0000-4000-8000-000000000001', 'ACTIVE', now() - interval '1 day', now() + interval '1 day', now(), now()),
  ('96700000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '96200000-0000-4000-8000-000000000001', 'ACTIVE', now() - interval '1 day', now() + interval '1 day', now(), now()),
  ('96700000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '96300000-0000-4000-8000-000000000001', 'ACTIVE', now() - interval '1 day', now() + interval '1 day', now(), now())
ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', starts_at = EXCLUDED.starts_at, expires_at = EXCLUDED.expires_at, updated_at = now();
