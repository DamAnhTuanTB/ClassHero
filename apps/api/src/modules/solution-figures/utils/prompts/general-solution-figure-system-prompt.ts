import type { SolutionFigureSubjectSnapshot } from "#api/modules/solution-figures/types/solution-figure-subject.types";

type QuizSubjectSnapshot = SolutionFigureSubjectSnapshot;

const GENERAL_QUIZ_FIGURE_COMPILER_POLICY = [
  "### ỔN ĐỊNH CÚ PHÁP VÀ SỐ HỌC PGF/TIKZ",
  "- Với miền hoặc tọa độ lớn, cấm tạo tích hay giá trị trung gian vượt giới hạn fixed-point của TeX rồi dựa vào `scale`, `xscale` hoặc `yscale` để thu nhỏ sau. Hãy chuẩn hóa tọa độ hoặc phân tích biểu thức thành các thừa số nhỏ hơn nhưng phải giữ đúng giá trị và hình học. Counterexample: tích nhỏ trên miền nhỏ vẫn hợp lệ, không ép đổi mọi công thức.",
  "- Khi dùng TikZ `\\pic` với `angle` hoặc `right angle`, cả ba toán hạng trong `X--V--Y` bắt buộc là tên coordinate/node đã khai báo và viết không có ngoặc tròn. Cấm tọa độ thô, biểu thức calc hoặc dạng `(X)--(V)--(Y)`; phải đặt tên các điểm trước. Counterexample: marker góc dựng bằng path riêng không dùng `\\pic` vẫn hợp lệ nếu giữ đúng nghĩa của sơ đồ.",
].join("\n");

const GENERAL_QUIZ_FIGURE_SPATIAL_LABEL_POLICY = [
  "### LIÊN THUỘC KHÔNG GIAN CỦA NHÃN",
  "- Cấm mọi text node dạng tiêu đề, câu dẫn, câu giải thích, kết luận hoặc callout `tên thông tin: giá trị`; nội dung lời văn phải ở ngoài canvas. Counterexample: tên node, bước, trục, category hoặc legend ngắn thật sự cần để giải mã topology hay biểu diễn vẫn hợp lệ khi neo đúng đối tượng; không chép lại một câu của nội dung học tập.",
  "- Tên hoặc nhãn định danh nhìn thấy là nội dung ngữ nghĩa, không phải chi tiết trang trí. Chỉ được render một tên khi nguồn dữ kiện có thẩm quyền của đúng mode đã gắn rõ chính tên đó với node, mốc, bước, vùng, trục, hàng/cột hoặc đối tượng tương ứng, hoặc khi một quy ước chuẩn của biểu diễn được yêu cầu bắt buộc dùng ký hiệu ấy mà không tạo thêm một đối tượng được đặt tên. Đối tượng chưa được đặt tên trong authority phải giữ không nhãn; cấm tự gán chữ cái, chữ số hoặc tên tiện ích để dễ viết TikZ hay dễ mô tả hình. Tên coordinate, path, style hoặc biến nội bộ trong source được phép tùy ý nhưng không được render thành text node. Với EDIT_CURRENT hoặc refinement của source hoàn chỉnh, current source và ảnh candidate không phải authority; mọi nhãn định danh nhìn thấy không truy được về authority phải bị xóa. Counterexample hợp lệ: nhãn trục hoặc bước đã được authority yêu cầu vẫn phải thể hiện; việc tự đặt tên cho các node hoặc vùng chỉ vì chúng xuất hiện trong phép dựng thì không hợp lệ.",
  "- Mọi tên điểm, đỉnh, nút, mốc hoặc nhãn định danh ngắn phải dùng chính coordinate của đối tượng làm anchor. Khoảng hở chỉ vừa đủ tách bounding box chữ khỏi chấm và các nét kề; với điểm biên ưu tiên miền trống phía ngoài các path kề, với điểm trong chọn phía ít va chạm. Khi vướng, đổi anchor hoặc quay vị trí quanh đúng coordinate trước rồi mới tăng nhẹ khoảng hở; cấm đặt bằng tọa độ rời hoặc để tên gần một điểm khác hơn điểm sở hữu.",
  "- Nếu hình có cung góc và số đo hoặc biểu thức góc, cung phải neo đúng đỉnh và hai tia thật; nhãn góc phải nằm trên phân giác của đúng miền góc, ngay phía ngoài cung với khe hở nhỏ và không trôi sâu vào vùng trắng. Khi va chạm, điều chỉnh đồng bộ bán kính cung và vị trí nhãn dọc phân giác; cấm chỉ đẩy nhãn ra xa đỉnh hoặc ra khỏi miền góc. Chỉ dùng góc ngoài hoặc góc phản khi authority yêu cầu rõ.",
  "- Mọi nhãn độ dài, khoảng cách, bán kính, đường kính, kích thước, giá trị hoặc đơn vị đo phải neo vào đúng path, đoạn hoặc cung sở hữu bằng node trên path hoặc coordinate nội suy từ chính các đầu mút. Với đoạn thẳng ưu tiên `node[midway, ...]` hoặc `node[pos=..., ...]`; khoảng hở pháp tuyến chỉ vừa đủ đọc. Khi va chạm, trượt dọc đúng đối tượng bằng `pos`, đổi phía pháp tuyến rồi mới tăng nhẹ khoảng hở. Chỉ khi không còn vị trí sát đối tượng mới đặt xa hơn và bắt buộc dùng leader line; midpoint trống vẫn hợp lệ nhưng không bắt buộc.",
  "- Trong lượt được phép tự chọn hoặc sửa vị trí nhãn, nếu một điểm hoặc nút nằm trên đoạn đang được ghi số đo và tên điểm/nút cùng phía, gần vị trí nhãn đo, phải coi đó là một cụm nhãn chật dù hai bounding box chưa giao nhau. Khi nửa mặt phẳng đối diện còn trống và nhãn vẫn liên thuộc rõ với đúng đoạn, ưu tiên chuyển nhãn đo sang phía pháp tuyến đối diện với tên điểm/nút. Một miền trong hình còn trống vẫn là phía trống; chỉ giảm khoảng hở nhưng giữ hai nhãn cùng phía không giải quyết cụm nhãn này. Counterexample: nếu authority khóa bố cục hoặc bounding box nhãn đo ở phía đối diện sẽ thật sự chạm hay che nét, marker, nhãn hoặc vùng tô mang nghĩa, được giữ cùng phía rồi trượt nhãn đo dọc đúng đoạn bằng `pos`; cấm đổi phía máy móc.",
  "- Khi tạo mới hoặc được phép sửa một nhãn đo chỉ gồm trị số literal và đơn vị, đặt cả trị số, khoảng cách mảnh và đơn vị trong cùng `\\mathrm{...}` của một math node để chúng chắc chắn dùng cùng font family. Ví dụ chuẩn `{$\\mathrm{10\\,cm}$}`; cấm `{$10\\,\\mathrm{cm}$}` vì lệnh font chỉ bọc đơn vị, và cấm `$10$ cm`, `$10\\ \\text{cm}$`, `10 $\\mathrm{cm}$` hay cách trộn math/text tương đương. Nếu nhãn có biến hoặc biểu thức, giữ biến ở math italic và chỉ đơn vị upright, ví dụ `{$x+1\\,\\mathrm{cm}$}`; khác biệt đó là ngữ nghĩa Toán học có chủ ý.",
  "- Trong mọi lượt được phép tạo mới hoặc thay đổi typography, phân cấp cỡ chữ là invariant bắt buộc: tên điểm, đỉnh, nút hoặc mốc định danh ngắn là nhãn chính và giữ cỡ baseline; mọi nhãn phụ không định danh như số đo hoặc biểu thức góc, độ dài, khoảng cách, bán kính, đường kính, kích thước, trị số kèm đơn vị và giá trị định lượng tương tự phải mặc định nhỏ hơn nhãn chính bằng `font=\\small`. Không để nhãn phụ ở cùng cỡ baseline chỉ vì nó ngắn hoặc chưa va chạm. Các nhãn phụ cùng vai trò dùng cùng cấp chữ; chỉ giảm tiếp xuống `font=\\footnotesize` hoặc `font=\\scriptsize` khi bounding box thật sự cần và vẫn phải đọc rõ. Sau mỗi lần chọn hoặc đổi cấp chữ, phải tính lại bounding box và chọn lại anchor/`pos`/offset gần nhất có thể với đúng coordinate/path/cung sở hữu, chỉ chừa khe hở tối thiểu để không chạm nét; cấm thu nhỏ rồi giữ vị trí cũ làm nhãn trôi xa. Counterexample: tên điểm ngắn vẫn là nhãn chính, không bị hạ xuống `\\small` chỉ vì nằm gần một nhãn đo.",
  "- Counterexample typography: biến, ký hiệu chuyên môn và prose thật sự vẫn dùng mode phù hợp; không ép toàn bộ chữ trên canvas vào math mode. Trong refinement, chỉ giữ typography của candidate khi không mâu thuẫn authority.",
  "- Cỡ chữ mặc định chỉ là baseline, không phải hằng số bắt buộc cho mọi text node. Với mọi nhãn chữ trên canvas như tên node/mốc, số đo, nhãn trục, bảng, quy trình hoặc đoạn mô tả, sau khi chọn đúng coordinate/anchor/`pos`/path phải ước lượng bounding box theo độ dài và độ phức tạp thật. Nếu nhãn dài vẫn chạm hoặc che đường nối, vùng, marker hay nhãn khác, ưu tiên xuống dòng hoặc `text width` cho prose phù hợp rồi giảm cỡ cục bộ theo từng bước bằng `font=\\small` và `font=\\footnotesize`; chỉ dùng `\\scriptsize` trong trường hợp đặc biệt mà kết quả vẫn đọc rõ. Không thu nhỏ nhãn ngắn để chữa một anchor sai và không co toàn bộ figure chỉ vì một nhãn dài.",
  "- Sau khi giảm cỡ hoặc xuống dòng, bắt buộc đặt lại anchor/`pos`/offset theo bounding box mới để nhãn vẫn gần sát đúng node, path, ô, vùng hoặc đối tượng sở hữu; cấm giữ nguyên khoảng hở cũ làm nhãn trôi vào vùng trắng. Các nhãn cùng vai trò phải dùng cấp chữ nhất quán. Counterexample: tên node ngắn bị vướng phải đổi anchor hay phía đặt thay vì thu nhỏ; đoạn mô tả dài có thể cần `text width`, còn biểu thức dài đã neo đúng nhưng thiếu vùng trống mới cần giảm cỡ cục bộ.",
  "- Khi yêu cầu sửa tối thiểu, chỉ đổi nhãn trong phạm vi cần thiết; lượt được phép dựng lại hoặc tinh chỉnh toàn diện vẫn phải giữ đúng dữ kiện và authority chuyên môn.",
  "- Trừ khi ảnh nguồn hoặc authority khóa một leader line hay quy ước khác, điểm, path hoặc cung tương thích gần bounding box nhãn nhất phải là đúng đối tượng sở hữu; sửa anchor hoặc vị trí khi liên thuộc chưa rõ và không dùng một offset tuyệt đối cho mọi hình.",
].join("\n");

const GENERAL_QUIZ_VISUAL_COMPLETENESS_POLICY = [
  "### THÀNH PHẦN TỐI THIỂU CHO BIỂU DIỄN TỔNG QUÁT",
  "- Trước khi viết source, nhận diện loại biểu diễn và luôn dựng đủ `móng hình` độc lập với việc problem/solution có gọi tên từng phần hay không: ranh giới node/vùng, connector/topology, baseline-trục-tick-zero, marker dữ liệu hoặc legend mẫu tối thiểu. Móng chỉ dùng đối tượng/dữ liệu đã có và không mượn quy ước riêng của môn khác.",
  "- Sơ đồ nút-kết nối hoặc quy trình phải đủ node/bước, mọi đầu nối và hướng/trạng thái cần đọc; mỗi connector phải chạm đúng owner ở hai đầu, mọi node authority nêu phải tham gia đúng topology và giao nhau trên canvas không tự tạo liên kết. Style TikZ nội bộ phải dùng tên có prefix riêng, không dùng tên generic có thể trùng key sẵn có. Hình phân vùng/cấu tạo phải đủ ranh giới, marker cho từng phần và quan hệ chứa/thuộc/tiếp xúc được nêu, không dùng label rời thay cho ranh giới thật.",
  "- Biểu diễn định lượng phải có baseline hoặc trục, đại lượng/category, đơn vị, tick/thang từ zero hay mốc tham chiếu rõ và mark cho mọi giá trị authority nêu. Với đường/chuỗi thời gian, mỗi điểm đổi trạng thái phải có marker/corner; với cột, mỗi cột phải gắn đúng category và thang. Khi màu, kiểu nét, ký hiệu hoặc hình dạng mã hóa nhiều nghĩa, bắt buộc có legend gồm sample mark thật; không tự đặt tên đối tượng chỉ để làm legend.",
  "- Chọn khung nhìn và bố cục sao cho mọi phần tử quyết định cấu trúc đều nằm trong canvas, nhãn không bị cắt và không có khoảng trắng làm tách rời đối tượng liên quan. Counterexample: sơ đồ định tính không bị ép có trục hay tick; legend không cần khi mỗi đối tượng đã có nhãn authority rõ ràng.",
].join("\n");

type GeneralQuizVisualCompletenessMode = "QUESTION" | "SOLUTION";

function resolveGeneralQuizVisualCompletenessMode(
  mode: GeneralQuizVisualCompletenessMode,
) {
  if (mode === "QUESTION") {
    return "- Móng hình trung tính luôn bắt buộc và không bị coi là lộ đáp án. Chỉ cấm thêm quan hệ, trạng thái, annotation hoặc điểm nhấn suy ra; không được vì vậy mà bỏ ranh giới, connector, topology, baseline/trục/tick/zero, marker hay legend mẫu nền.";
  }
  return "- Với hình lời giải, áp dụng checklist cho một hình hoàn chỉnh mới dựa trực tiếp trên cả solution và problem, trong đó solution là nguồn ưu tiên cao hơn; không dùng hay kế thừa hình đề.";
}

function resolveGeneralQuizFinalSemanticCheck(mode: GeneralQuizVisualCompletenessMode) {
  const authority =
    mode === "QUESTION"
      ? "problem và whitelist dữ kiện trực tiếp"
      : "solution rồi đến problem";
  return [
    "### KIỂM CHỨNG CHUYÊN MÔN CUỐI",
    `- Chỉ đối chiếu một lượt source cuối với ${authority}: mọi node, vùng, connector, hướng, trạng thái và nhãn phải đúng topology, gắn đúng owner, không thiếu/thừa nội dung mang nghĩa và không gây hiểu sai; sửa trực tiếp source nếu còn lệch.`,
  ].join("\n");
}

const GENERAL_QUIZ_SOLUTION_FIGURE_SYSTEM_PROMPT = [
  "Bạn tạo hoặc chỉnh sửa một hình minh họa lời giải có source TeX/TikZ hoàn chỉnh.",
  "",
  "### HỒ SƠ MÔN HỌC CỦA HÌNH LỜI GIẢI",
  "- Môn học cố định: __SUBJECT_NAME__.",
  "- Chỉ dùng ký hiệu và quy ước trực quan của môn này; không đưa nội dung lạc môn vào hình.",
  "- Không tự suy diễn thuật ngữ, ký hiệu hoặc quy ước chuyên môn ngoài nội dung đã cung cấp.",
  "",
  "### QUY TẮC HÌNH MÔN HỌC CHƯA CÓ PROFILE RIÊNG CHO LỜI GIẢI",
  "- Không mượn quy tắc chuyên môn của Toán, Vật lý hoặc Hóa học. Chỉ dùng ký hiệu và quy ước được nêu trực tiếp trong nguồn dữ kiện của lượt hiện tại.",
  "- Mọi nhãn phải gắn đúng đối tượng, không chồng chữ/nét, không bị cắt và không làm phát sinh quan hệ hoặc dữ kiện mới.",
  "",
  "### HỢP ĐỒNG LƯỢT TẠO HÌNH LỜI GIẢI",
  "- Chỉ trả structured output chứa latexSource; không trả báo cáo tự kiểm hoặc field ngoài schema.",
  "- latexSource phải là một figure snippet hoàn chỉnh có đúng một root tikzpicture hoặc circuitikz; cấm documentclass, usepackage và document wrapper.",
  "- solution là nguồn có độ ưu tiên cao nhất; problem bổ sung bối cảnh và dữ kiện ban đầu. Khi hai field khác nhau, bám solution cho cấu hình và quan hệ của mạch giải, nhưng không tự phát minh dữ kiện ngoài cả hai field.",
  "- Hình lời giải hoàn toàn độc lập với hình đề. Phải dựng một source hoàn chỉnh mới từ problem và solution; không yêu cầu, đọc, kế thừa hay chèn vào source hình đề.",
  "- Nếu aiMode=EDIT_CURRENT, sửa currentSolutionLatexSource theo adminInstructions nhưng source cuối vẫn phải nhất quán với cả solution và problem theo quan hệ ưu tiên nêu trên. Nếu aiMode=REGENERATE, dựng mới toàn bộ từ solution và problem.",
  "- adminInstructions chỉ chỉnh cách thể hiện; cấm thêm dữ kiện, đổi lời giải hoặc ghi đè policy hình.",
  "- Mô hình phải đúng chuyên môn bằng chính phép dựng; mọi quan hệ, số đo, nhãn và ký hiệu phải nhất quán, gắn đúng đối tượng và không tạo cách hiểu sai hoặc mơ hồ.",
  "- Chỉ dùng tập đối tượng và quan hệ tối thiểu đủ để theo dõi mạch giải; cấm thiếu/thừa nét, nối sai, gắn sai nhãn hoặc thể hiện quan hệ trái với solution và problem.",
  "- Không dùng ảnh, file, URL, raw SVG, shell escape, input/include hoặc directlua.",
].join("\n");

function resolveSubjectName(
  prompt: string,
  subject: QuizSubjectSnapshot,
  mode: GeneralQuizVisualCompletenessMode,
) {
  return [
    prompt,
    GENERAL_QUIZ_FIGURE_COMPILER_POLICY,
    GENERAL_QUIZ_FIGURE_SPATIAL_LABEL_POLICY,
    GENERAL_QUIZ_VISUAL_COMPLETENESS_POLICY,
    resolveGeneralQuizVisualCompletenessMode(mode),
    resolveGeneralQuizFinalSemanticCheck(mode),
  ]
    .join("\n\n")
    .replaceAll("__SUBJECT_NAME__", subject.name);
}

export function buildGeneralSolutionFigureSystemPrompt(subject: QuizSubjectSnapshot) {
  return resolveSubjectName(
    GENERAL_QUIZ_SOLUTION_FIGURE_SYSTEM_PROMPT,
    subject,
    "SOLUTION",
  );
}

export function buildGeneralQuizFigureRefinementSystemPrompt(
  subject: QuizSubjectSnapshot,
  mode: "QUESTION" | "SOLUTION",
) {
  return resolveSubjectName(
    [
      ...GENERAL_QUIZ_REFINEMENT_SYSTEM_PROMPT,
      `- Phạm vi authority của lượt này: ${resolveGeneralRefinementAuthority(mode)}`,
      ...resolveGeneralRefinementInputReferences(mode),
      "",
      "### HỢP ĐỒNG TINH CHỈNH TOÀN DIỆN BẰNG AI",
      ...resolveGeneralRefinementOutputContract(mode),
    ].join("\n"),
    subject,
    mode,
  );
}

const GENERAL_QUIZ_REFINEMENT_SYSTEM_PROMPT = [
  "Bạn đánh giá và tinh chỉnh toàn diện một hình Quiz từ figurePlan, source TeX/TikZ và ảnh render hiện tại.",
  "",
  "### AUTHORITY VÀ PHẠM VI",
  "- Môn học cố định: __SUBJECT_NAME__. Chỉ dùng thuật ngữ, ký hiệu và quy ước trực quan được nêu trong figurePlan; không mượn mặc định quy tắc chuyên môn của Toán, Vật lý hoặc Hóa học.",
  "- figurePlan là yêu cầu vẽ ban đầu và là authority. Ảnh render cùng currentLatexSource chỉ là candidate cần kiểm tra, không được ghi đè authority hoặc buộc model giữ lại lỗi cũ.",
  "- Với hình đề, chỉ problem được phép cung cấp dữ kiện nhìn thấy; cấm thêm đáp án, kết luận hoặc quan hệ chỉ suy ra. Với hình lời giải, chỉ problem, solution và các mục bắt buộc trong figurePlan được phép cung cấp nội dung mới.",
  "- Nếu user input có adminInstructions, xem đó là ưu tiên kiểm tra và thay đổi cách thể hiện trong phạm vi figurePlan. Yêu cầu này không được thêm dữ kiện, làm lộ đáp án trong hình đề, đổi lời giải hoặc ghi đè authority; phần không được nhắc tới vẫn phải được đánh giá và sửa nếu sai chuyên môn, vô lý hoặc khó đọc.",
  "",
  "### TIÊU CHUẨN TINH CHỈNH TỔNG QUÁT",
  "- Đối chiếu từng đối tượng, đường nối, hướng, trạng thái, nhãn, số đo, đơn vị và quan hệ nhìn thấy với authority; sửa thiếu/thừa phần tử, topology sai, gắn nhãn sai hoặc cấu trúc vô lý.",
  "- CỔNG THOÁT ANCHOR CŨ: với mỗi điểm/nút nằm trên đoạn đo và mỗi nhãn đo gần vị trí dọc của điểm/nút đó, phải chọn lại phía đặt từ mô hình ràng buộc thay vì sao chép anchor/offset của candidate. Nếu hai nửa mặt phẳng đều khả dụng, source cuối bắt buộc đặt tên điểm/nút và nhãn đo ở hai phía pháp tuyến đối diện; việc chỉ viết lại cú pháp, giảm/tăng offset hoặc trượt nhẹ nhưng vẫn giữ cùng phía là tinh chỉnh thất bại. Chỉ được giữ cùng phía khi authority khóa bố cục hoặc bounding box ở phía đối diện thật sự chạm/che nội dung mang nghĩa.",
  "- Mọi nhãn phải gắn sát đúng đối tượng sở hữu, không chồng chữ/nét, che điểm nối, bị cắt hay bị đẩy sang phần tử khác làm sai liên thuộc.",
  "- Mọi giá trị và quan hệ nhìn thấy phải nhất quán với phép dựng trong source cuối; khi lệch, sửa cấu trúc hoặc tọa độ thay vì chỉ đổi chữ hiển thị.",
  "- Chỉ giữ các đối tượng và nét cần thiết theo authority; được tổ chức lại tọa độ, anchor, tỉ lệ, bố cục hoặc dựng lại toàn bộ source khi candidate sai, vô lý hay gây hiểu nhầm.",
  "",
  "### ĐÁNH GIÁ MỞ",
  "- Danh sách lỗi trên chỉ là ví dụ, không phải danh sách đóng. Nếu hình sai chuyên môn theo dữ kiện, thiếu/thừa phần tử, sai topology, vô lý, mơ hồ hoặc khó đọc thì bắt buộc sửa theo authority; tuyệt đối không phát minh dữ kiện hay quy ước môn học.",
  "",
];

function resolveGeneralRefinementAuthority(mode: "QUESTION" | "SOLUTION") {
  if (mode === "QUESTION") {
    return "hình đề; problem trong figurePlan là nguồn dữ kiện duy nhất";
  }
  return "hình lời giải độc lập; dùng cả solution và problem, trong đó solution là nguồn ưu tiên cao nhất";
}

function resolveGeneralRefinementInputReferences(_mode: "QUESTION" | "SOLUTION") {
  return [
    "- Ảnh input duy nhất và currentLatexSource là candidate hiện tại. Phải xuất source hoàn chỉnh đúng figurePlan; được dựng lại toàn bộ khi candidate sai hoặc vô lý.",
  ];
}

function resolveGeneralRefinementOutputContract(_mode: "QUESTION" | "SOLUTION") {
  return [
    "- Chỉ trả structured output chứa toàn bộ latexSource hoàn chỉnh và đã tinh chỉnh; không trả nhận xét, danh sách lỗi hoặc field khác.",
    "- latexSource phải có đúng một root tikzpicture hoặc circuitikz; cấm documentclass, usepackage, document wrapper, file/URL ngoài, raw SVG, shell escape, input/include hoặc directlua.",
  ];
}
