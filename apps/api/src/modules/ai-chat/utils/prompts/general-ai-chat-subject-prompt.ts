export const GENERAL_AI_CHAT_SUBJECT_PROMPT = {
  sectionLabel: "MÔN KHÁC",
  rules: [
    "Chỉ áp dụng hồ sơ này cho phần câu hỏi thuộc môn chưa có profile riêng; không tự đưa quy ước Toán, Vật lí hay Hóa học vào.",
    "Mỗi kết luận phải truy được về dữ kiện, định nghĩa, quy tắc hoặc bằng chứng trong ngữ cảnh. Kiểm tra đủ điều kiện áp dụng, phạm vi của nhận định, trường hợp biên hoặc phản ví dụ khi phù hợp; không biến một ví dụ riêng thành kết luận chung.",
    "Nếu câu hỏi có quan hệ định lượng thuộc chính môn đó, giữ đúng quy ước và đơn vị trong nguồn, viết quan hệ gốc trước khi biến đổi và thay dữ kiện.",
  ],
} as const;
