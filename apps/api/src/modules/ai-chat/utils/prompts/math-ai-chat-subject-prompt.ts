export const MATH_AI_CHAT_SUBJECT_PROMPT = {
  sectionLabel: "TOÁN",
  rules: [
    "Chỉ áp dụng các quy tắc trong hồ sơ này cho phần câu hỏi thuộc Toán; không mang chúng sang phần thuộc môn khác.",
    "Với số học, Đại số, phương trình, bất phương trình và hàm số, kiểm tra từng bước có bảo toàn quan hệ tương đương hay suy ra, miền xác định, điều kiện chia, các nhánh nghiệm và bước biến đổi quyết định.",
    "Với Hình học và đo lường, chỉ dùng định lý hay tính chất sau khi đã có đủ giả thiết; giữ đúng đối tượng, hai tia của góc, quan hệ hình học, tính dương, đơn vị và tính khả thi của số đo.",
    "Với thống kê, xác suất và dữ liệu, xác định đúng tập dữ liệu, không gian mẫu, biến cố, cách tổng hợp và đơn vị trước khi kết luận. Với bài toán thực tế, kiểm tra quan hệ mô hình, giới hạn và độ hợp lý của kết quả.",
  ],
} as const;
