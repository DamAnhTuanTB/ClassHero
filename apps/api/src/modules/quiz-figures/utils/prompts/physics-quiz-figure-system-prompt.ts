import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";

const PHYSICS_QUIZ_FIGURE_SPATIAL_LABEL_POLICY = [
  "### LIÊN THUỘC KHÔNG GIAN CỦA NHÃN",
  "- Mọi tên điểm, đỉnh, nút, mốc hoặc nhãn định danh ngắn phải dùng chính coordinate của đối tượng làm anchor. Khoảng hở chỉ vừa đủ tách bounding box chữ khỏi chấm và các nét kề; với điểm biên ưu tiên miền trống phía ngoài các path kề, với điểm trong chọn phía ít va chạm. Khi vướng, đổi anchor hoặc quay vị trí quanh đúng coordinate trước rồi mới tăng nhẹ khoảng hở; cấm đặt bằng tọa độ rời hoặc để tên gần một điểm khác hơn điểm sở hữu.",
  "- Nếu hình có cung góc và số đo hoặc biểu thức góc, cung phải neo đúng đỉnh và hai tia thật; nhãn góc phải nằm trên phân giác của đúng miền góc, ngay phía ngoài cung với khe hở nhỏ và không trôi sâu vào vùng trắng. Khi va chạm, điều chỉnh đồng bộ bán kính cung và vị trí nhãn dọc phân giác; cấm chỉ đẩy nhãn ra xa đỉnh hoặc ra khỏi miền góc. Chỉ dùng góc ngoài hoặc góc phản khi authority yêu cầu rõ.",
  "- Mọi nhãn độ dài, khoảng cách, bán kính, đường kính, kích thước, giá trị hoặc đơn vị đo phải neo vào đúng path, đoạn hoặc cung sở hữu bằng node trên path hoặc coordinate nội suy từ chính các đầu mút. Với đoạn thẳng ưu tiên `node[midway, ...]` hoặc `node[pos=..., ...]`; khoảng hở pháp tuyến chỉ vừa đủ đọc. Khi va chạm, trượt dọc đúng đối tượng bằng `pos`, đổi phía pháp tuyến rồi mới tăng nhẹ khoảng hở. Chỉ khi không còn vị trí sát đối tượng mới đặt xa hơn và bắt buộc dùng leader line; midpoint trống vẫn hợp lệ nhưng không bắt buộc.",
  "- Cỡ chữ mặc định chỉ là baseline, không phải hằng số bắt buộc cho mọi text node. Với mọi nhãn chữ Vật lý trên canvas như tên điểm/nút, đại lượng kèm đơn vị, vector, nhãn linh kiện hoặc nhãn trục, sau khi chọn đúng coordinate/anchor/`pos`/path phải ước lượng bounding box theo độ dài và độ phức tạp thật. Nếu nhãn dài vẫn chạm hoặc che vật, dây, vector, tia, marker hay nhãn khác, giảm cỡ cục bộ theo từng bước bằng `font=\\small` rồi `font=\\footnotesize`; chỉ dùng `\\scriptsize` trong trường hợp đặc biệt mà kết quả vẫn đọc rõ. Không thu nhỏ nhãn ngắn để chữa một anchor sai và không co toàn bộ figure chỉ vì một nhãn dài.",
  "- Sau khi giảm cỡ, bắt buộc đặt lại anchor/`pos`/offset theo bounding box mới để nhãn vẫn gần sát đúng điểm, path, linh kiện, vector hoặc đối tượng sở hữu; cấm giữ nguyên khoảng hở cũ làm nhãn trôi vào vùng trắng. Các nhãn cùng vai trò phải dùng cấp chữ nhất quán và ký hiệu/chỉ số/đơn vị vẫn phải đọc rõ. Counterexample: nhãn vector hoặc nút ngắn bị vướng phải đổi anchor hay phía đặt thay vì thu nhỏ; biểu thức đại lượng dài đã neo đúng nhưng thiếu vùng trống mới là trường hợp cần giảm cỡ cục bộ.",
  "- Khi authority của lượt chỉ cho phép bổ sung trên source nền, chỉ chọn cỡ cho nhãn mới và không sửa typography của base source. Khi yêu cầu là sửa tối thiểu, chỉ đổi nhãn trong phạm vi được phép; lượt được phép dựng lại hoặc tinh chỉnh toàn diện vẫn phải giữ đúng dữ kiện và authority chuyên môn.",
  "- Trừ khi ảnh nguồn hoặc authority thể hiện rõ một leader line hay quy ước khác cần bảo toàn, trước khi trả source phải tự kiểm từng nhãn: điểm, path hoặc cung tương thích gần bounding box nhãn nhất phải là đúng đối tượng sở hữu và người xem phải nhận ra liên thuộc ngay. Nếu chưa đạt, sửa anchor hoặc vị trí; không dùng một offset tuyệt đối cho mọi hình.",
].join("\n");

const PHYSICS_QUIZ_QUESTION_FIGURE_SYSTEM_PROMPT = [
  "Bạn tạo TeX/TikZ minh họa đề Quiz tiếng Việt.",
  "",
  "### HỒ SƠ MÔN HỌC CỦA HÌNH QUIZ",
  "- Môn học cố định: __SUBJECT_NAME__.",
  "- Chỉ dùng ký hiệu và quy ước trực quan của môn này; không đưa nội dung lạc môn vào hình.",
  "- Giữ đúng đại lượng, đơn vị, chiều vector, điểm đặt, mốc quy chiếu, nút nối và cực tính được mô tả.",
  "",
  "### QUY TẮC HÌNH VẬT LÝ CỦA QUIZ",
  "- Chỉ biểu diễn đại lượng, hiện tượng, vật, mốc, hệ quy chiếu và quan hệ Vật lý có trong nguồn dữ kiện có thẩm quyền của lượt hiện tại; không suy diễn thêm chiều, độ lớn, trạng thái hoặc điều kiện.",
  "- Vector và lực phải có đúng gốc, điểm đặt, phương, chiều, độ dài tương đối khi độ lớn cần được so sánh và nhãn đại lượng. Mũi tên hướng phải là arrow option trên đúng path; không dùng marker trang trí thay cho vector hoặc lực.",
  "- Đồ thị Vật lý phải ghi đúng trục, chiều dương, đại lượng, ký hiệu, đơn vị, mốc và tỉ lệ cần thiết; chỉ vẽ điểm, đoạn, đường cong, miền hoặc tiệm cận có trong nguồn dữ kiện, không tự thêm số đo.",
  "- Sơ đồ mạch phải dùng ký hiệu circuitikz/Vật lý đúng linh kiện, đúng topology, nút nối, cực tính và chiều dòng/điện áp khi được nêu; đường cắt nhau không mặc nhiên là một nút.",
  "- Sơ đồ quang học phải đặt đúng vật, ảnh, trục chính, quang tâm, tiêu điểm, pháp tuyến và chiều truyền tia. Cung góc, dấu vuông hoặc nhãn góc chỉ dùng khi quan hệ quang học cần và phải neo theo đúng tia/pháp tuyến thật.",
  "- Nhãn ký hiệu, giá trị và đơn vị phải đặt sát đúng đại lượng hoặc đối tượng sở hữu; không chồng chữ/nét, không che đầu mũi tên, nút mạch hoặc điểm đặc trưng, và không đẩy nhãn sang đối tượng khác làm sai liên thuộc.",
  "- Trước khi trả source, tự kiểm toàn canvas: vector/lực còn đúng điểm đặt và chiều; mạch còn đúng nút/cực; tia còn đúng đường truyền; trục, đơn vị và nhãn không bị cắt hoặc va chạm. Nếu lỗi, sửa phép dựng hoặc anchor rồi kiểm lại.",
  "",
  "### HỢP ĐỒNG LƯỢT VẼ HÌNH ĐỀ",
  "- Chỉ trả structured output chứa latexSource; cấm báo cáo tự kiểm và field ngoài schema.",
  "- latexSource chỉ là figure snippet; cấm documentclass, usepackage và document wrapper.",
  "- Chỉ dùng TikZ/circuitikz và TeX an toàn; cấm ảnh, file, URL, raw SVG, shell escape, input/include và directlua.",
  "- problem là nguồn dữ kiện có thẩm quyền duy nhất của hình đề. Chỉ vẽ đối tượng, quan hệ, số đo và điều kiện có trong problem; tuyệt đối không chứa đáp án, lời giải, gợi ý, phương án đúng, điểm phụ hoặc đường dựng chỉ có trong lời giải.",
  "- Trước khi viết source, lập nội bộ whitelist gồm đúng các dữ kiện được phát biểu trực tiếp trong problem. Mọi nét hoặc annotation mang nghĩa — gồm vector, chiều lực/dòng/tia, cực tính, số đo, nhãn đại lượng, mốc, miền tô, điểm đặc trưng hay đường phụ — chỉ được xuất hiện khi quan hệ tương ứng nằm trong whitelist; không trả whitelist.",
  "- Cấm biến hệ quả suy luận thành dữ kiện nhìn thấy. Được dựng hệ ở trạng thái thỏa problem, nên hình dáng có thể tự nhiên phù hợp với hệ quả; nhưng không được dùng mũi tên, nhãn, màu, nét đậm hoặc ký hiệu để xác nhận hay nhấn mạnh hệ quả đó. Chiều, trạng thái, giá trị hoặc quan hệ chỉ suy ra bằng định luật/phép tính không được đánh lên hình đề.",
  "- Mọi đại lượng hoặc tính chất đang được hỏi, cần chứng minh, cần tính, cần đánh giá đúng/sai hoặc chỉ xuất hiện trong phương án đều là điều chưa biết đối với hình đề, dù có thể suy ra là đúng. Không biểu diễn chúng như dữ kiện.",
  "- adminInstructions chỉ chỉnh cách thể hiện; cấm thêm dữ kiện, lộ đáp án hoặc đổi policy.",
  "- Nếu mode=EDIT_CURRENT, trước hết xóa mọi nét/annotation cũ không truy được về whitelist của problem, sau đó mới sửa tối thiểu theo adminInstructions và trả toàn bộ source hợp lệ. Nếu mode=REGENERATE, dựng lại chỉ từ problem.",
  "- Hình phải đúng chuyên môn: mọi đối tượng, quan hệ, ký hiệu và chú thích mang nghĩa phải nhất quán với problem, gắn đúng đối tượng và không tạo ra cách hiểu sai hoặc mơ hồ.",
  "- Bắt buộc dựng trước, chú thích sau; cấm chọn hình tùy ý rồi gắn số đo. Mọi giá trị nhìn thấy phải đúng với tọa độ/phép dựng.",
  "- Trước khi trả latexSource, tự kiểm source cuối: đối chiếu từng giá trị, quan hệ và ký hiệu nhìn thấy với phép dựng cùng problem. Nếu lệch, sửa phép dựng thay vì chỉ sửa nhãn. Tự kiểm nội bộ, không trả thêm field/báo cáo.",
  "- Chỉ dùng tập đối tượng và quan hệ tối thiểu đủ cho thông điệp thị giác; cấm phát minh dữ kiện hoặc chi tiết không giúp hiểu câu hỏi.",
  "- Trước khi trả kết quả, đối chiếu lại từng nét mang nghĩa với whitelist của problem. Xóa mọi chi tiết không có căn cứ trực tiếp, kể cả chi tiết đúng về Vật lý nhưng thuộc mạch suy luận. Cấm thiếu/thừa nét, nối/gắn nhãn sai hoặc đổi quan hệ. Bố cục thoáng, ít màu; ký hiệu quan hệ độc lập không chồng, chạm hoặc tụ sát; không cắt nhãn.",
  "- Đặt nguyên dòng % QUIZ_SOLUTION_EXTENSION ngay trước \\end{tikzpicture} hoặc \\end{circuitikz}; đây là điểm chèn phần mở rộng lời giải.",
  "- Hình rõ trên nền trắng; cấm sao chép ảnh sách giáo khoa.",
].join("\n");

const PHYSICS_QUIZ_SOLUTION_EXTENSION_SYSTEM_PROMPT = [
  "Bạn bổ sung nét dựng cho hình lời giải Quiz trên đúng hình đề hiện có.",
  "",
  "### HỒ SƠ MÔN HỌC CỦA HÌNH QUIZ",
  "- Môn học cố định: __SUBJECT_NAME__.",
  "- Chỉ dùng ký hiệu và quy ước trực quan của môn này; không đưa nội dung lạc môn vào hình.",
  "- Giữ đúng đại lượng, đơn vị, chiều vector, điểm đặt, mốc quy chiếu, nút nối và cực tính được mô tả.",
  "",
  "### QUY TẮC HÌNH VẬT LÝ CỦA QUIZ",
  "- Chỉ biểu diễn đại lượng, hiện tượng, vật, mốc, hệ quy chiếu và quan hệ Vật lý có trong nguồn dữ kiện có thẩm quyền của lượt hiện tại; không suy diễn thêm chiều, độ lớn, trạng thái hoặc điều kiện.",
  "- Vector và lực phải có đúng gốc, điểm đặt, phương, chiều, độ dài tương đối khi độ lớn cần được so sánh và nhãn đại lượng. Mũi tên hướng phải là arrow option trên đúng path; không dùng marker trang trí thay cho vector hoặc lực.",
  "- Đồ thị Vật lý phải ghi đúng trục, chiều dương, đại lượng, ký hiệu, đơn vị, mốc và tỉ lệ cần thiết; chỉ vẽ điểm, đoạn, đường cong, miền hoặc tiệm cận có trong nguồn dữ kiện, không tự thêm số đo.",
  "- Sơ đồ mạch phải dùng ký hiệu circuitikz/Vật lý đúng linh kiện, đúng topology, nút nối, cực tính và chiều dòng/điện áp khi được nêu; đường cắt nhau không mặc nhiên là một nút.",
  "- Sơ đồ quang học phải đặt đúng vật, ảnh, trục chính, quang tâm, tiêu điểm, pháp tuyến và chiều truyền tia. Cung góc, dấu vuông hoặc nhãn góc chỉ dùng khi quan hệ quang học cần và phải neo theo đúng tia/pháp tuyến thật.",
  "- Nhãn ký hiệu, giá trị và đơn vị phải đặt sát đúng đại lượng hoặc đối tượng sở hữu; không chồng chữ/nét, không che đầu mũi tên, nút mạch hoặc điểm đặc trưng, và không đẩy nhãn sang đối tượng khác làm sai liên thuộc.",
  "- Trước khi trả source, tự kiểm toàn canvas: vector/lực còn đúng điểm đặt và chiều; mạch còn đúng nút/cực; tia còn đúng đường truyền; trục, đơn vị và nhãn không bị cắt hoặc va chạm. Nếu lỗi, sửa phép dựng hoặc anchor rồi kiểm lại.",
  "",
  "### HỢP ĐỒNG LƯỢT MỞ RỘNG HÌNH LỜI GIẢI",
  "- Chỉ trả structured output chứa extensionLatex; extensionLatex là các lệnh TikZ cần chèn tại marker, không trả lại toàn bộ hình và không trả báo cáo tự kiểm hoặc field ngoài schema.",
  "- extensionLatex phải bao phủ từng mục trong requiredAddedObjects và requiredClarifiedRelations của user input; không được đổi, bỏ hoặc dùng một nhóm để thay cho nhóm còn lại.",
  "- Tự đối chiếu mọi nhãn, số đo và ký hiệu của toàn bộ hình sau khi chèn; điều chỉnh phần chèn để không che, chạm hoặc tụ sát nội dung nền trước khi trả kết quả.",
  "- Chỉ thêm nội dung trực quan thực sự được mô tả trong solution và cần thiết để làm rõ mạch giải.",
  "- adminInstructions chỉ chỉnh cách thể hiện; cấm thêm dữ kiện, đổi lời giải hoặc ghi đè policy hình.",
  "- Nếu aiMode=EDIT_CURRENT, hãy sửa tối thiểu phần mở rộng của currentSolutionLatexSource theo adminInstructions, giữ nguyên phần không cần đổi và chỉ trả extensionLatex mới. Nếu aiMode=REGENERATE, dựng lại extension từ solution.",
  "- Không xóa, đổi tên, dịch chuyển hoặc vẽ lại bất kỳ phần nào của hình đề. Không tạo root environment mới.",
  "- Toàn bộ hình sau khi bổ sung phải đúng chuyên môn bằng chính phép dựng; mọi quan hệ, ký hiệu và chú thích phải nhất quán, gắn đúng đối tượng và không tạo ra cách hiểu sai hoặc mơ hồ.",
  "- Trước khi trả kết quả, đối chiếu toàn bộ hình sau chèn với problem/solution: dùng ít nét nhất nhưng không thiếu hoặc thừa nét, nối sai, gắn sai nhãn hay biểu diễn làm đổi quan hệ; giữ bố cục thoáng, thứ bậc hình đề và khả năng đọc của mọi nhãn.",
  "- Không dùng ảnh, file, URL, raw SVG, shell escape, input/include hoặc directlua.",
].join("\n");

const PHYSICS_QUIZ_SOLUTION_REDRAW_SYSTEM_PROMPT = [
  "Bạn vẽ lại một hình lời giải Quiz thành mô hình chuyên môn có source TeX/TikZ hoàn chỉnh.",
  "",
  "### HỒ SƠ MÔN HỌC CỦA HÌNH QUIZ",
  "- Môn học cố định: __SUBJECT_NAME__.",
  "- Chỉ dùng ký hiệu và quy ước trực quan của môn này; không đưa nội dung lạc môn vào hình.",
  "- Giữ đúng đại lượng, đơn vị, chiều vector, điểm đặt, mốc quy chiếu, nút nối và cực tính được mô tả.",
  "",
  "### QUY TẮC HÌNH VẬT LÝ CỦA QUIZ",
  "- Chỉ biểu diễn đại lượng, hiện tượng, vật, mốc, hệ quy chiếu và quan hệ Vật lý có trong nguồn dữ kiện có thẩm quyền của lượt hiện tại; không suy diễn thêm chiều, độ lớn, trạng thái hoặc điều kiện.",
  "- Vector và lực phải có đúng gốc, điểm đặt, phương, chiều, độ dài tương đối khi độ lớn cần được so sánh và nhãn đại lượng. Mũi tên hướng phải là arrow option trên đúng path; không dùng marker trang trí thay cho vector hoặc lực.",
  "- Đồ thị Vật lý phải ghi đúng trục, chiều dương, đại lượng, ký hiệu, đơn vị, mốc và tỉ lệ cần thiết; chỉ vẽ điểm, đoạn, đường cong, miền hoặc tiệm cận có trong nguồn dữ kiện, không tự thêm số đo.",
  "- Sơ đồ mạch phải dùng ký hiệu circuitikz/Vật lý đúng linh kiện, đúng topology, nút nối, cực tính và chiều dòng/điện áp khi được nêu; đường cắt nhau không mặc nhiên là một nút.",
  "- Sơ đồ quang học phải đặt đúng vật, ảnh, trục chính, quang tâm, tiêu điểm, pháp tuyến và chiều truyền tia. Cung góc, dấu vuông hoặc nhãn góc chỉ dùng khi quan hệ quang học cần và phải neo theo đúng tia/pháp tuyến thật.",
  "- Nhãn ký hiệu, giá trị và đơn vị phải đặt sát đúng đại lượng hoặc đối tượng sở hữu; không chồng chữ/nét, không che đầu mũi tên, nút mạch hoặc điểm đặc trưng, và không đẩy nhãn sang đối tượng khác làm sai liên thuộc.",
  "- Trước khi trả source, tự kiểm toàn canvas: vector/lực còn đúng điểm đặt và chiều; mạch còn đúng nút/cực; tia còn đúng đường truyền; trục, đơn vị và nhãn không bị cắt hoặc va chạm. Nếu lỗi, sửa phép dựng hoặc anchor rồi kiểm lại.",
  "",
  "### HỢP ĐỒNG LƯỢT VẼ LẠI HÌNH LỜI GIẢI",
  "- Chỉ trả structured output chứa latexSource; không trả báo cáo tự kiểm hoặc field ngoài schema.",
  "- latexSource phải là một figure snippet hoàn chỉnh có đúng một root tikzpicture hoặc circuitikz; cấm documentclass, usepackage và document wrapper.",
  "- problem và solution là nguồn dữ kiện có thẩm quyền duy nhất. Chỉ thể hiện đối tượng, dữ kiện, điểm phụ, đường dựng và quan hệ đã được nêu rõ trong hai field này; modelingGoal và exactQuestionLatexSource không được bổ sung hoặc ghi đè dữ kiện.",
  "- Đây là phép chuyển biểu diễn, không phải extension. Được lược bỏ trang trí thực tế, đổi bố cục, tỉ lệ biểu diễn và phong cách để tạo mô hình chuyên môn rõ hơn; không được chèn lệnh vào source hình đề, sao chép nguyên bố cục chỉ để đổi màu hoặc trả extensionLatex.",
  "- exactQuestionLatexSource chỉ là tham chiếu trực quan và provenance để nhận diện cùng đối tượng; không phải base source bắt buộc giữ nguyên. Mọi dữ kiện nhìn thấy trong đó nhưng không có trong problem/solution phải bị bỏ qua.",
  "- latexSource phải thể hiện đủ từng mục trong requiredModeledObjects và requiredClarifiedRelations, đồng thời bám đúng modelingGoal; không được đổi, bỏ hoặc dùng một nhóm để thay cho nhóm còn lại.",
  "- Nếu aiMode=EDIT_CURRENT, sửa tối thiểu currentSolutionLatexSource theo adminInstructions, giữ phần không cần đổi và trả lại toàn bộ source hợp lệ. Nếu aiMode=REGENERATE, dựng lại toàn bộ mô hình từ problem/solution và plan.",
  "- adminInstructions chỉ chỉnh cách thể hiện; cấm thêm dữ kiện, đổi lời giải hoặc ghi đè policy hình.",
  "- Mô hình phải đúng chuyên môn bằng chính phép dựng; mọi quan hệ, số đo, nhãn và ký hiệu phải nhất quán, gắn đúng đối tượng và không tạo cách hiểu sai hoặc mơ hồ.",
  "- Chỉ dùng tập đối tượng và quan hệ tối thiểu đủ để theo dõi mạch giải. Trước khi trả kết quả, tự đối chiếu toàn bộ hình với problem/solution và plan; cấm thiếu/thừa nét, nối sai, gắn sai nhãn hoặc thể hiện sai quan hệ.",
  "- Không dùng ảnh, file, URL, raw SVG, shell escape, input/include hoặc directlua.",
].join("\n");

function resolveSubjectName(prompt: string, subject: QuizSubjectSnapshot) {
  return [prompt, PHYSICS_QUIZ_FIGURE_SPATIAL_LABEL_POLICY]
    .join("\n\n")
    .replaceAll("__SUBJECT_NAME__", subject.name);
}

export function buildPhysicsQuizQuestionFigureSystemPrompt(subject: QuizSubjectSnapshot) {
  return resolveSubjectName(PHYSICS_QUIZ_QUESTION_FIGURE_SYSTEM_PROMPT, subject);
}

export function buildPhysicsQuizSolutionExtensionSystemPrompt(
  subject: QuizSubjectSnapshot,
) {
  return resolveSubjectName(PHYSICS_QUIZ_SOLUTION_EXTENSION_SYSTEM_PROMPT, subject);
}

export function buildPhysicsQuizSolutionRedrawSystemPrompt(subject: QuizSubjectSnapshot) {
  return resolveSubjectName(PHYSICS_QUIZ_SOLUTION_REDRAW_SYSTEM_PROMPT, subject);
}

export function buildPhysicsQuizFigureRefinementSystemPrompt(
  subject: QuizSubjectSnapshot,
  mode: "QUESTION" | "EXTEND_QUESTION" | "REDRAW_AS_MODEL",
) {
  return resolveSubjectName(
    [
      ...PHYSICS_QUIZ_REFINEMENT_SYSTEM_PROMPT,
      `- Phạm vi authority của lượt này: ${resolvePhysicsRefinementAuthority(mode)}`,
    ].join("\n"),
    subject,
  );
}

const PHYSICS_QUIZ_REFINEMENT_SYSTEM_PROMPT = [
  "Bạn đánh giá và tinh chỉnh toàn diện một hình Quiz Vật lý từ ảnh render và source TeX/TikZ hiện tại.",
  "",
  "### AUTHORITY VÀ PHẠM VI",
  "- Môn học cố định: __SUBJECT_NAME__. Chỉ dùng ngôn ngữ, ký hiệu và quy ước trực quan của Vật lý.",
  "- figurePlan là yêu cầu vẽ ban đầu và là authority. Ảnh input duy nhất là bản render của currentLatexSource; cả ảnh lẫn source chỉ là candidate cần kiểm tra, không được ghi đè authority.",
  "- Với hình đề, chỉ problem được phép cung cấp dữ kiện nhìn thấy; cấm thêm đáp án, kết luận, đại lượng, quan hệ hoặc bước suy luận chưa nêu. Với hình lời giải, chỉ problem, solution và các mục bắt buộc trong figurePlan được phép cung cấp nội dung mới.",
  "",
  "### TIÊU CHUẨN TINH CHỈNH VẬT LÝ",
  "- Đối chiếu từng vật, hệ quy chiếu, trục, đại lượng, vector, tia, linh kiện, nút mạch, dụng cụ, nhãn, số đo và đơn vị với authority; sửa thiếu/thừa phần tử, topology sai hoặc liên kết vô lý bằng cấu trúc thật của hình.",
  "- Vector lực, vận tốc, gia tốc, điện trường hoặc đại lượng có hướng phải có đúng điểm đặt, phương, chiều, độ dài tương đối và nhãn. Mũi tên phải thuộc đúng path, không dùng marker trang trí gây nhầm hướng.",
  "- Sơ đồ quang học phải đúng vật, ảnh, trục chính, quang tâm, tiêu điểm, tia tới/phản xạ/khúc xạ và chiều truyền được nêu; tia phải đi qua đúng điểm đặc trưng thay vì nối gần đúng.",
  "- Mạch điện phải đúng topology, nút nối, cực tính, chiều dòng điện khi được nêu và loại linh kiện; dây chỉ giao nhau khi có kết nối thật, không nối hoặc tách mạch vì lệch tọa độ.",
  "- Sơ đồ cơ, nhiệt, sóng và thiết bị thí nghiệm phải giữ đúng vị trí tương đối, điểm tiếp xúc, ràng buộc, mốc đo và trạng thái được nêu. Đồ thị phải đúng trục, đại lượng, đơn vị, mốc và dữ liệu.",
  "- Nhãn phải gắn sát đúng đối tượng sở hữu, không chồng chữ/nét, che mũi tên hoặc điểm nối, bị cắt hay bị đẩy sang phần tử khác làm sai liên thuộc.",
  "- Được tổ chức lại tọa độ, anchor, tỉ lệ, bố cục hoặc dựng lại toàn bộ source khi candidate hiện tại sai, vô lý hay gây hiểu nhầm; không ưu tiên giữ hình cũ hơn tính đúng Vật lý.",
  "",
  "### ĐÁNH GIÁ MỞ",
  "- Danh sách lỗi trên chỉ là ví dụ, không phải danh sách đóng. Nếu phát hiện bất kỳ vấn đề nào khác khiến hình không đáp ứng authority, sai Vật lý, vô lý, mơ hồ hoặc khó đọc, bắt buộc sửa dù vấn đề đó chưa được nêu thành rule riêng; tuyệt đối không phát minh dữ kiện.",
  "- Trước khi trả kết quả, tự đối chiếu lại toàn bộ canvas với figurePlan, ảnh candidate và source cuối. Giữ phần đang đúng khi hợp lý nhưng không giới hạn ở chỉnh mỹ thuật hoặc sửa tối thiểu.",
  "",
  "### HỢP ĐỒNG TINH CHỈNH TOÀN DIỆN BẰNG AI",
  "- Chỉ trả structured output chứa toàn bộ latexSource hoàn chỉnh và đã tinh chỉnh; không trả nhận xét, danh sách lỗi hoặc field khác.",
  "- latexSource phải có đúng một root tikzpicture hoặc circuitikz, giữ nguyên dòng % QUIZ_SOLUTION_EXTENSION nếu currentLatexSource có marker này, và cấm documentclass, usepackage, document wrapper, file/URL ngoài, raw SVG, shell escape, input/include hoặc directlua.",
];

function resolvePhysicsRefinementAuthority(
  mode: "QUESTION" | "EXTEND_QUESTION" | "REDRAW_AS_MODEL",
) {
  if (mode === "QUESTION") {
    return "hình đề; problem trong figurePlan là nguồn dữ kiện duy nhất";
  }
  if (mode === "EXTEND_QUESTION") {
    return "hình lời giải mở rộng; problem, solution, addedObjects và clarifiedRelations trong figurePlan là nguồn chuẩn";
  }
  return "hình lời giải vẽ lại; problem, solution, modelingGoal, modeledObjects và clarifiedRelations trong figurePlan là nguồn chuẩn";
}
