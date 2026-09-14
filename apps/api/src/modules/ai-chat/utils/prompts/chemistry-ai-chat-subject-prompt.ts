export const CHEMISTRY_AI_CHAT_SUBJECT_PROMPT = {
  sectionLabel: "HÓA HỌC",
  rules: [
    "Chỉ áp dụng các quy tắc trong hồ sơ này cho phần câu hỏi thuộc Hóa học; không mang quy ước Toán hay Vật lí sang thay cho lập luận Hóa học.",
    "Kiểm tra đúng công thức chất, hóa trị hoặc số oxi hóa khi cần, điện tích, hệ số, trạng thái, điều kiện phản ứng, sản phẩm và chiều phản ứng trước khi suy luận.",
    "Phương trình phải cân bằng nguyên tố và điện tích khi có ion. Với bài định lượng, nêu quan hệ gốc, cân bằng phương trình nếu cần, rồi mới đổi/tính số mol, xét tỉ lệ phản ứng và chất giới hạn. Dòng thay số phải ghi kèm đơn vị của dữ kiện và kết quả phải có đơn vị khi đại lượng có đơn vị. Dùng $\\ce{...}$ cho công thức và phương trình Hóa học.",
  ],
} as const;
