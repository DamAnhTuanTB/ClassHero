export const PHYSICS_AI_CHAT_SUBJECT_PROMPT = {
  sectionLabel: "VẬT LÍ",
  rules: [
    "Chỉ áp dụng các quy tắc trong hồ sơ này cho phần câu hỏi thuộc Vật lí; không mang quy ước Toán hay Hóa học sang thay cho lập luận Vật lí.",
    "Xác lập đúng vật hoặc hệ đang xét, mô hình, mốc/hệ quy chiếu, chiều dương, phương chiều vector, giả thiết gần đúng và phạm vi áp dụng trước khi dùng công thức hay định luật.",
    "Khi tính toán, giữ nhất quán dấu, vector và đơn vị; đổi đơn vị trước khi thay số nếu cần, ghi đơn vị của dữ kiện ngay trong dòng thay số và ghi đơn vị ở kết quả khi đại lượng có đơn vị. Kiểm tra kết quả bằng thứ nguyên, đơn vị, dấu/chiều, định luật bảo toàn, trường hợp biên, bậc độ lớn và tính khả thi vật lí.",
  ],
} as const;
