import { AI_REASONING_EFFORT_LEVELS } from "@learning-path/shared";
import { Difficulty, QuestionType } from "@prisma/client";
import { z } from "zod";

export const QUIZ_PROMPT_VERSIONS = {
  MATH: "quiz-math-v85-independent-solution-figure",
  PHYSICS: "quiz-physics-v80-independent-solution-figure",
  CHEMISTRY: "quiz-chemistry-v80-independent-solution-figure",
  GENERAL: "quiz-general-v80-independent-solution-figure",
} as const;
export const QUIZ_SCHEMA_VERSION =
  "quiz-pdf-figure-schema-v37-independent-solution-figure";
export const QUIZ_MAX_OUTPUT_TOKENS = 12_000;
export const QUIZ_MIN_OUTPUT_TOKENS = 1_000;
export const QUIZ_MAX_CONFIGURED_OUTPUT_TOKENS = 32_000;
export const QUIZ_SUBQUESTION_IDS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const QUIZ_OUTPUT_TOKEN_OVERHEAD = 2_000;
const QUIZ_OUTPUT_TOKENS_BY_TYPE: Record<QuestionType, number> = {
  [QuestionType.MULTIPLE_CHOICE]: 500,
  [QuestionType.TRUE_FALSE]: 400,
  [QuestionType.MULTI_STATEMENT_TRUE_FALSE]: 900,
  [QuestionType.TEXT_INPUT]: 650,
};

export function resolveQuizOutputTokenFloor(input: {
  questionCount: number;
  questionTypes?: readonly QuestionType[];
}) {
  const types =
    input.questionTypes && input.questionTypes.length > 0
      ? input.questionTypes
      : Object.values(QuestionType);
  const longestSelectedQuestion = Math.max(
    ...types.map((type) => QUIZ_OUTPUT_TOKENS_BY_TYPE[type]),
  );
  return Math.min(
    QUIZ_MAX_CONFIGURED_OUTPUT_TOKENS,
    Math.max(
      QUIZ_MAX_OUTPUT_TOKENS,
      QUIZ_OUTPUT_TOKEN_OVERHEAD + input.questionCount * longestSelectedQuestion,
    ),
  );
}

export const QUIZ_EQUALITY_CHAIN_LAYOUT_POLICY = [
  "QUY TẮC CỨNG VỀ CHUỖI DẤU BẰNG: trước khi trả kết quả JSON, phải rà soát mọi trường hiển thị có nội dung toán học, đặc biệt là `problem`, `solution`, `statementSolutions[].solution`, `hint`, `options[].text` và `statements[].text`.",
  "Bất kỳ chuỗi tính hoặc biến đổi duy nhất nào có từ hai dấu `=` cấp ngoài cùng trở lên đều bắt buộc được xuất thành một khối display `$$...$$` dùng `aligned`/`split`, bất kể chuỗi ngắn, vừa một dòng, không tràn ngang hoặc ban đầu có thể viết inline. Tuyệt đối không đặt chuỗi đó trong `$...$` và không giữ toàn bộ chuỗi trên một dòng.",
  "Trong `aligned`/`split`, mỗi dòng chỉ chứa một dấu `=` cấp ngoài cùng và một bước biến đổi tương ứng. Dòng đầu có dạng `A &= B`, các dòng sau có dạng `&= C`.",
  "Ví dụ tổng quát SAI: `$A=B=C$`. Ví dụ tổng quát SAI: `$$A=B=C.$$` Ví dụ tổng quát ĐÚNG: `$$\\begin{aligned}A&=B\\\\&=C.\\end{aligned}$$`.",
  "Không áp dụng quy tắc tách chuỗi cho các phương trình độc lập, hệ phương trình, phép gán nhiều đại lượng hoặc dấu `=` nằm trong cấu trúc lồng nhau.",
  "Nếu phát hiện chuỗi vi phạm khi tự kiểm tra, phải chuyển chuỗi inline hoặc display một dòng đó thành display nhiều dòng trước khi trả kết quả.",
].join(" ");

export const QUIZ_LOGICAL_DERIVATION_POLICY = [
  "QUY TẮC CỨNG VỀ MẠCH BIẾN ĐỔI: nhận diện chuỗi theo quan hệ logic, không theo cách đã chia delimiter. Từ hai công thức liên tiếp trở lên cùng biến đổi một biểu thức/phương trình, cùng cô lập một đại lượng hoặc cùng duy trì tập nghiệm vẫn là một chuỗi duy nhất, dù mỗi công thức đang nằm trong display riêng và chỉ có một dấu `=`.",
  "Phải gom chuỗi đó vào một khối `aligned`/`split`, giữ đại lượng cần tìm ở vế trái sau khi đã cô lập và cho thấy tường minh phép chuyển vế, thế, rút gọn, khai căn, chia hoặc biến đổi chính làm thay đổi biểu thức. Được gộp số học hiển nhiên, nhưng không được nhảy qua bước đại số hay suy luận quyết định.",
  "Nếu một phép biến đổi có thể sinh nhiều nhánh, làm mất nghiệm hoặc đòi hỏi điều kiện — như khai căn, bình phương, chia cho biểu thức chứa biến, logarit hay rút gọn mẫu — phải nêu điều kiện, giữ đủ nhánh hợp lệ rồi mới loại theo ngữ cảnh. Với đại lượng hình học là độ dài, phải nêu tính dương trước khi chọn căn dương.",
  "Ví dụ tổng quát SAI: viết ba display rời `u^2=p^2-q^2`, `u^2=r`, `u=\\sqrt{r}` mà không nêu phép biến đổi hay điều kiện. Dạng ĐÚNG: gom phần tính `u^2 &= p^2-q^2` rồi `&=r` trong một `aligned`; sau đó nêu điều kiện phù hợp trước khi kết luận `u=\\sqrt{r}`.",
  "Counterexample hợp lệ: hai phương trình độc lập của một hệ, hai phép gán cho hai đại lượng khác nhau hoặc một phép tính một bước không phải bị ép thành chuỗi. Trước khi trả output, kiểm tra từng cặp bước liên tiếp: phải xác định được phép biến đổi, quan hệ tương đương/suy ra và điều kiện bảo toàn tập nghiệm; nếu không, phải viết lại mạch lời giải.",
].join(" ");

export const QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY = [
  "QUY TẮC CỨNG VỀ MÔI TRƯỜNG LATEX: trong mọi khối công thức display `$$...$$`, mỗi lệnh `\\begin{X}` bắt buộc có đúng lệnh `\\end{X}` tương ứng, đóng theo thứ tự lồng ngược và nằm trước dấu `$$` kết thúc khối.",
  "Tuyệt đối không kết thúc khối ngay sau nội dung của `aligned`, `split`, `cases`, `array`, `matrix` hoặc môi trường khác khi chưa viết lệnh `\\end{...}` tương ứng. Ví dụ SAI: `$$\\begin{aligned}A&=B\\\\&=C.$$`; ví dụ ĐÚNG: `$$\\begin{aligned}A&=B\\\\&=C.\\end{aligned}$$`.",
  "Trước khi trả JSON, phải tự quét từng field có LaTeX và sửa mọi cặp `\\begin{...}`/`\\end{...}` bị thiếu, thừa hoặc sai thứ tự; đồng thời bảo đảm mỗi dấu mở `$$` có đúng một dấu đóng `$$`.",
  "Với công thức inline, bắt buộc mở và đóng bằng cùng dấu `$`; không dùng backtick thay cho dấu `$` đóng. Ví dụ SAI: `$E``, ví dụ ĐÚNG: `$E$`.",
].join(" ");

export const QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY = [
  "Bảo toàn dấu câu và ký hiệu có chức năng của nguồn; tự bổ sung dấu câu còn thiếu khi ngữ pháp và quan hệ trình bày xác định rõ. Câu dẫn mở danh sách, hệ, bảng hoặc công thức display ở dòng sau phải kết thúc bằng dấu `:`; dùng dấu `,`, `;` và `.` đúng quan hệ câu, không để chuỗi `..` mà phải chọn `.` hoặc `...` theo nghĩa.",
  "Các cụm `Ta có`, `Do đó`, `Suy ra`, `Vì vậy` khi làm câu dẫn trực tiếp cho công thức display hoặc danh sách ở dòng sau phải có dấu `:`; khi nội dung tiếp tục cùng dòng thì dùng dấu câu theo đúng ngữ pháp, không máy móc thêm dấu hai chấm.",
  "Trong `aligned`/`split`, đặt dấu `&` tại quan hệ chính cần căn như `=`. Không đặt `&` ngay trước toán tử suy luận hoặc tương đương đứng đầu dòng như `\\Rightarrow`, `\\Leftrightarrow`, `\\Longrightarrow`, `\\Longleftrightarrow`, `\\implies`, `\\impliedby`, `\\iff` và các biến thể chiều ngược, vì toán tử sẽ bị đẩy vào cột dấu bằng. Khi dòng suy ra còn có dấu bằng, viết toán tử và vế trái trước dấu căn, ví dụ `\\Rightarrow\\quad a &= 2x`.",
].join(" ");

export const QUIZ_TRUE_FALSE_PROBLEM_POLICY =
  "`explanation.problem` phải bắt đầu trực tiếp bằng đúng một mệnh đề cần xét. Không thêm nhãn hoặc câu dẫn chỉ nhắc lại thao tác đúng/sai, như `Mệnh đề:`, `Mệnh đề sau đúng hay sai?`, `Đánh giá mệnh đề sau` hoặc cách diễn đạt tương đương. Ví dụ SAI: `Mệnh đề: P`; ví dụ ĐÚNG: `P`.";

export const QUIZ_TRUE_FALSE_SOLUTION_POLICY =
  "Với TRUE_FALSE, `explanation.solution` phải giải thích vì sao mệnh đề đúng hoặc sai rồi kết thúc bằng một câu liên kết tự nhiên với lập luận, như `Vì vậy, mệnh đề đã cho là đúng.` hoặc `Do đó, mệnh đề đã cho là sai.`. Câu kết luận này phải tuân thủ quy tắc đoạn kết luận chung của mọi lời giải. Không dùng câu cụt, tách rời ngữ cảnh như `Mệnh đề đúng.` hoặc `Mệnh đề sai.`.";

export const QUIZ_SUBPART_LINEBREAK_POLICY =
  "Trong một câu Quiz có nhiều ý, mỗi ý mang nhãn a), b), c), ... phải bắt đầu ở dòng riêng trong `problem` và `solution`; không đặt hai ý trên cùng một dòng. Riêng MULTI_STATEMENT_TRUE_FALSE, mỗi lời giải nằm trong một phần tử `statementSolutions` riêng, còn mapper dựng mỗi đáp án a), b), c), ... thành một dòng độc lập từ `statements[].value`.";

export const QUIZ_CONCLUSION_PARAGRAPH_POLICY =
  "Câu kết luận cuối phải nằm trong một đoạn riêng, dù bắt đầu bằng `Vậy`, `Vì vậy`, `Do đó`, `Suy ra` hay không có từ nối: chèn đúng một dòng trống trước câu kết luận, không nối câu này vào cùng đoạn văn hoặc cùng dòng với phép tính, công thức hay lập luận ngay trước đó.";

export const QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY =
  "Với MULTIPLE_CHOICE, câu kết luận cuối phải trả lời trực tiếp đúng đại lượng, đối tượng hoặc yêu cầu mà `problem` hỏi, chẳng hạn `Vậy thể tích cần tìm là $V$.`; không được kết luận bằng thao tác làm bài hoặc ID phương án như `Vậy chọn phương án C.`, `Vậy đáp án là C.` hay cách diễn đạt tương đương. ID phương án chỉ thuộc dữ liệu chấm điểm `correctOptionId`.";

export const QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY =
  "Trong `problem`, `hint`, `solution` và `statementSolutions`, chỉ được sử dụng khái niệm, định lý, công thức, ký hiệu và phương pháp được trình bày trong PDF nguồn hoặc các kiến thức học sinh đã được học trước đó ở cùng khối hoặc khối dưới. Việc dùng các kiến thức đã được học trước đó không thay thế yêu cầu mỗi câu phải liên quan trực tiếp đến nội dung lesson. Không được sử dụng kiến thức, thuật ngữ, định lý hoặc phương pháp thuộc khối lớp cao hơn để rút gọn lời giải, kể cả khi cách giải đó đúng về mặt chuyên môn. Khi PDF nguồn đã trình bày một phương pháp phù hợp, phải ưu tiên phương pháp đó; chỉ dùng cách khác khi cách đó vẫn nằm trong phạm vi kiến thức của nguồn và khối lớp mục tiêu. Khi chưa xác định khối lớp, không dùng phương pháp nâng cao không xuất hiện trong PDF nguồn.";

export const QUIZ_ORIGINAL_FORMULA_STEP_POLICY =
  "Khi lời giải dùng một định lý, tính chất, định luật hoặc công thức để tính toán, phải viết công thức gốc trước, sau đó biến đổi công thức, rồi mới thay số. Câu văn nêu nội dung định lý hoặc công thức không thay thế cho bước viết công thức. Dạng đúng theo mẫu tổng quát là `p+q=s`, tiếp theo `q=s-p`, rồi mới thay các giá trị đã biết. Nếu công thức gốc đã có sẵn đại lượng cần tìm ở một vế thì viết công thức đó rồi thay số, không thêm phép biến đổi thừa. Câu thuần lý thuyết không có phép tính không bị ép viết công thức.";

export const QUIZ_HINT_QUALITY_POLICY = [
  "Gợi ý ngắn nhưng phải tự đủ nghĩa và cung cấp ít nhất một cầu nối suy luận cụ thể từ dữ kiện hoặc yêu cầu của chính câu hỏi đến khái niệm, quan hệ, quy tắc hoặc thao tác đầu tiên cần dùng.",
  "Gợi ý phải giúp học sinh hiểu vì sao hướng đó phù hợp với cấu hình, điều kiện hoặc đại lượng đang hỏi; không chỉ nhắc lại một công thức, định nghĩa hay sự thật rời rạc mà không nối nó với bài cụ thể.",
  "Dùng thuật ngữ và tên quan hệ chuyên môn rõ ràng. Không dùng các động từ mơ hồ như `ghép`, `nối`, `kết hợp` thay cho việc nêu chính xác hai đối tượng có quan hệ gì và cần lập hay kiểm tra hệ thức nào; chỉ dùng các động từ này khi thao tác ghép/nối/kết hợp chính là thao tác chuyên môn đang được hỏi và đối tượng thao tác đã rõ.",
  "`hint` được phép và nên dùng công thức LaTeX khi công thức giúp thể hiện quan hệ rõ hơn văn xuôi. Dùng `$...$` cho công thức inline và `$$...$$` cho công thức trọng tâm ở dòng riêng; mọi lệnh LaTeX như `\\frac`, `\\sqrt`, `\\alpha` phải giữ đúng dấu `\\`. Được nêu quan hệ hay công thức cần dùng, nhưng không thay hết dữ kiện để tính ra kết quả cuối.",
  "Trình bày theo đơn vị suy luận, không dồn nhiều bước thành một khối văn xuôi. Nếu chỉ cần một cầu nối thì dùng một đoạn ngắn, có thể kèm công thức. Nếu cần từ hai bước trở lên, mỗi bước phải bắt đầu ở dòng riêng và có thể dùng danh sách đánh số; công thức display phải nằm trên dòng riêng với dòng trống phía trước và sau.",
  "Không dùng câu chung chung như `Dùng công thức phù hợp`, `Thực hiện phép tính`, `Xét định nghĩa`, `Làm tương tự` hoặc cách diễn đạt tương đương. Không tiết lộ kết quả cuối, ID phương án, giá trị đúng/sai hoặc trình bày trọn vẹn lời giải.",
  "Ví dụ không hợp lệ theo mẫu tổng quát: viết `Hãy ghép đại lượng này với đại lượng kia rồi tính`, hoặc chỉ nêu một hệ thức đúng mà không cho biết hệ thức đó liên quan thế nào đến yêu cầu của câu hỏi.",
  "Counterexample hợp lệ theo mẫu tổng quát: nêu rõ từ điều kiện của đề mà hai đối tượng có quan hệ chuyên môn nào; viết hệ thức LaTeX biểu diễn quan hệ đó ở dòng phù hợp; sau đó chỉ dẫn bước tiếp theo mà chưa tính ra đáp án.",
  "Không ép số câu hoặc số ký tự cố định; độ dài phải tương xứng với số mắt xích cần định hướng của câu hỏi.",
].join(" ");

export const QUIZ_FIGURE_SELECTION_POLICY = [
  "Quyết định hình theo policy chuyên môn của đúng môn trong system prompt hiện tại; không đặt quota cứng và không dùng riêng tên môn, tên bài hoặc một nhãn phân loại làm điều kiện máy móc.",
  "Ngoại lệ nghiệp vụ bắt buộc: câu TRUE_FALSE chỉ có đúng một mệnh đề luôn không tạo hình đề hoặc hình lời giải; phải trả `requiresQuestionFigure=false` và `solutionFigure=false`. Quy tắc này không áp dụng cho MULTI_STATEMENT_TRUE_FALSE.",
  "Đề bài và lời giải vẫn phải tự đủ nghĩa bằng chữ. Đây là nguyên tắc an toàn cho người học, không phải lý do tự động loại hình khi policy của môn xác định biểu diễn trực quan là cần thiết.",
  "Phase 1 chỉ trả hai boolean độc lập: `requiresQuestionFigure` cho hình đề và `solutionFigure` cho hình lời giải. Không trả mode hoặc figure plan.",
].join(" ");

export const QUIZ_SCHOOLBOOK_SOLUTION_STYLE_POLICY = [
  "Lời giải Quiz bắt đầu trực tiếp và thực hiện đủ các bước cần cho chính câu đang giải: nêu công thức hoặc căn cứ, thay dữ kiện, viết phép biến đổi hay suy luận trung gian, rồi kết luận. Không viết kiểu gợi ý `thay vào công thức`, `làm tương tự`, `suy ra ngay` mà bỏ qua thao tác.",
  "Nếu PDF nguồn có phương pháp hoặc cách ký hiệu phù hợp với dạng bài mới, dùng đó làm chuẩn về thứ tự lập luận, cấu trúc công thức và mức xuống dòng; không chép lại bài/lời giải nguồn, không đổi sang phương pháp xa lạ và không chuyển biểu thức thành đoạn văn dài.",
  "Với câu cần tính toán hoặc biến đổi, công thức, chuỗi biến đổi và ký hiệu toán học phải là phần trình bày chính; văn xuôi chỉ nêu căn cứ hoặc nối các bước. Với câu nhận định lý thuyết không cần phép tính, dùng lập luận ngắn, trực tiếp theo đúng khái niệm hoặc quy tắc liên quan nhưng vẫn phải tách đoạn theo từng đơn vị lập luận.",
  "Trong mọi `solution` và `statementSolutions[].solution`, phải tách tường minh theo đơn vị lập luận, không phụ thuộc lời giải có tính toán, biến đổi hay chỉ dùng văn xuôi, chứng minh hoặc giải thích. Khi có từ hai đơn vị lập luận trở lên, mỗi đơn vị — như nêu căn cứ, rút ra hệ quả trung gian, thực hiện phép tính/biến đổi hoặc kết luận — phải bắt đầu trong một đoạn riêng, giữa hai đoạn có đúng một dòng trống. Nếu câu dẫn đứng ngay trước khối display thì kết thúc bằng dấu `:`. Không nhét nhiều mắt xích suy luận hoặc toàn bộ phép tính nhiều bước vào một đoạn văn; yêu cầu gọn chỉ cho phép bỏ diễn giải lặp lại, không cho phép gộp hoặc văn xuôi hóa các bước.",
  "Không nhét toàn bộ phép tính nhiều bước vào giữa một đoạn văn.",
  "Counterexample hợp lệ: nếu lời giải chỉ có đúng một đơn vị lập luận ngắn thì giữ trong một đoạn; không bẻ từng câu, từng công thức ngắn hoặc chỉ riêng từ nối thành các đoạn vụn. Khi `Vì`, `Nên`, `Do đó` hoặc `Suy ra` mở đầu một đoạn mới, từ nối phải đi cùng nội dung của đoạn đó. Các giả thiết liên tiếp cùng phục vụ một suy luận được giữ trong cùng một đoạn.",
  "Ranh giới đoạn phải hợp lý về logic và trình bày: chỉ bắt đầu đoạn mới khi vai trò suy luận chuyển từ căn cứ sang hệ quả trung gian, phép tính/biến đổi tiếp theo hoặc kết luận. Không xuống đoạn chỉ vì câu dài, sau mỗi câu, sau mỗi công thức inline hay ngay trước mỗi từ nối. Hai đơn vị lập luận tách biệt phải được phân cách trong giá trị chuỗi bằng `\\n\\n`.",
  QUIZ_CONCLUSION_PARAGRAPH_POLICY,
  QUIZ_SUBPART_LINEBREAK_POLICY,
].join(" ");

export const QUIZ_MULTI_STATEMENT_PROBLEM_POLICY =
  "`explanation.problem` chỉ chứa bối cảnh hoặc dữ kiện dùng chung thực sự cần cho các phần tử trong `statements`; phải dừng ngay sau bối cảnh đó. Không thêm câu dẫn chỉ nhắc lại thao tác đúng/sai, như `Hãy đánh giá độc lập các mệnh đề sau`, `Đánh giá các mệnh đề sau` hoặc cách diễn đạt tương đương. Ví dụ SAI: `Cho dữ kiện X. Hãy đánh giá các mệnh đề sau`; ví dụ ĐÚNG: `Cho dữ kiện X`.";

export const QUIZ_MULTI_STATEMENT_SOLUTION_POLICY =
  "Với MULTI_STATEMENT_TRUE_FALSE, `statements[].id` và `explanation.statementSolutions[].statementId` bắt buộc dùng lần lượt đúng các chữ thường `a`, `b`, `c`, `d`, ... theo thứ tự mảng và luôn bắt đầu từ `a`; tuyệt đối không dùng `S1`, `S2`, số thứ tự, chữ hoa hoặc ID tùy ý. `explanation.statementSolutions` phải có đúng một phần tử cho mỗi câu con, cùng `statementId`, cùng thứ tự và không thêm ID khác. Mỗi `solution` phải giải riêng câu tương ứng bằng dữ kiện, phép tính hoặc lập luận đầy đủ theo phong cách SGK; không viết một lời giải chung, không văn xuôi hóa biểu thức rồi chỉ liệt kê kết quả. Không lặp nhãn `a)`, `b)` ở đầu `solution` vì lớp trình bày tự thêm nhãn. Mỗi phần kết thúc tự nhiên theo dạng `Vậy câu a) đúng.` hoặc `Vậy câu b) sai.`; câu kết luận này bắt buộc là một đoạn riêng có đúng một dòng trống phía trước, không nằm cùng dòng với câu giải thích hoặc công thức trước đó. Trong nội dung hiển thị không gọi là `mệnh đề 1`, `mệnh đề 2`, `S1` hoặc `S2`. Đáp án cuối được dựng từ `statements[].value`, mỗi câu một dòng theo dạng `a) Đúng.`; provider không trả `explanation.answer` cho loại câu này.";

export const QUIZ_TEXT_INPUT_ANSWER_POLICY =
  "Dùng TEXT_INPUT cho bài tính có đúng một yêu cầu trực tiếp và một kết quả số. `correctAnswer` là nguồn đáp án duy nhất và phải là đúng một chuỗi đáp án chuẩn, không liệt kê nhiều cách viết tương đương, không có xuống dòng, đơn vị, câu văn hoặc LaTeX. Nếu kết quả chính xác là số hữu tỉ: trả số nguyên khi kết quả là số nguyên; nếu không, trả phân số tối giản `p/q` với mẫu dương. Nếu kết quả chính xác là số vô tỉ: `explanation.problem` bắt buộc kết thúc bằng đúng câu `Làm tròn kết quả đến 1 chữ số thập phân.`; `solution` nêu kết quả chính xác rồi thực hiện làm tròn; `correctAnswer` là số thập phân đã làm tròn, dùng dấu `.` và đúng một chữ số sau dấu thập phân. Không trả ký hiệu vô tỉ như `π`, `\\sqrt{...}` trong `correctAnswer`. Không thêm yêu cầu làm tròn khi kết quả chính xác là số hữu tỉ. Ví dụ hữu tỉ: kết quả bằng một nửa thì SAI là `1/2; 0.5`, ĐÚNG là `1/2`. Ví dụ vô tỉ: kết quả chính xác là `\\sqrt{2}` thì SAI là `correctAnswer=\\sqrt{2}`, ĐÚNG là problem có câu làm tròn nêu trên và `correctAnswer=1.4`.";

export const QUIZ_SUBJECT_KEYS = ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const;

export const quizSubjectKeySchema = z.enum(QUIZ_SUBJECT_KEYS);
export type QuizSubjectKey = z.infer<typeof quizSubjectKeySchema>;

export interface QuizSubjectSnapshot {
  key: QuizSubjectKey;
  name: string;
  slug: string;
}

const text = (max: number) => z.string().trim().min(1).max(max);
const learnerFacingText = (max: number, description: string) =>
  text(max).describe(description);
const difficultySchema = z
  .enum([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD])
  .describe("Mức độ của câu hỏi: EASY, MEDIUM hoặc HARD.");

const quizExplanationProblemField = learnerFacingText(
  4_000,
  "Phần nội dung chính của câu hỏi phải nêu đủ đối tượng, ký hiệu, dữ kiện và yêu cầu chuyên môn nếu dạng câu cần, để học sinh trả lời được mà không cần xem hình minh họa. Không thêm nhãn hoặc câu dẫn chỉ nhắc lại thao tác đã được `questionType` thể hiện.",
);
const quizExplanationBaseShape = {
  problem: quizExplanationProblemField,
};

const quizSolutionFieldSchema = text(10_000).describe(
  "Lời giải đầy đủ cho đúng câu hỏi hiện tại, tự hiểu được khi không xem hình và tuân thủ các quy tắc nội dung, lập luận, định dạng trong system prompt.",
);

const QUIZ_HINT_FIELD_DESCRIPTION =
  "Gợi ý cho đúng câu hỏi hiện tại: nêu cầu nối hoặc thao tác khởi đầu hữu ích nhưng không tiết lộ kết quả, dữ liệu chấm điểm hay toàn bộ lời giải; tuân thủ quy tắc gợi ý trong system prompt.";

const QUIZ_STATEMENT_SOLUTION_ITEM_POLICY =
  "Lời giải độc lập cho đúng một câu con: nêu đủ dữ kiện, công thức, phép tính, phép biến đổi hoặc lập luận cần thiết; không gộp câu khác và không lặp nhãn ở đầu field. Kết thúc bằng một đoạn riêng như `Vậy câu a) đúng.` hoặc `Vậy câu b) sai.`, có đúng một dòng trống phía trước; không viết `mệnh đề 1`/`mệnh đề 2` hay S1/S2.";

const standardQuizExplanationContentShape = {
  ...quizExplanationBaseShape,
  solution: quizSolutionFieldSchema,
};

const multipleChoiceQuizExplanationContentShape = {
  ...quizExplanationBaseShape,
  solution: quizSolutionFieldSchema,
};

const trueFalseQuizExplanationContentShape = {
  ...quizExplanationBaseShape,
  solution: quizSolutionFieldSchema,
};

const quizStatementSolutionSchema = z
  .object({
    statementId: z
      .enum(QUIZ_SUBQUESTION_IDS)
      .describe(
        "Nhãn chữ thường của đúng câu con được giải; phải khớp `statements[].id`, theo thứ tự liên tiếp a, b, c, d, ... và không dùng S1/S2 hoặc số thứ tự.",
      ),
    solution: quizSolutionFieldSchema,
  })
  .strict()
  .describe(QUIZ_STATEMENT_SOLUTION_ITEM_POLICY);

const multiStatementQuizExplanationContentShape = {
  problem: quizExplanationProblemField,
  statementSolutions: z
    .array(quizStatementSolutionSchema)
    .min(2)
    .max(8)
    .describe(
      "Một lời giải riêng cho mỗi phần tử trong `statements`, cùng ID và cùng thứ tự; nội dung và cách kết luận tuân thủ system prompt.",
    ),
};

function createMathQuizExplanationSchema<T extends z.ZodRawShape>(contentShape: T) {
  return z
    .object({
      ...contentShape,
      isGeometry: z
        .boolean()
        .describe("Đặt true nếu đây là câu Hình học; ngược lại đặt false."),
    })
    .strict();
}

function createNonMathQuizExplanationSchema<T extends z.ZodRawShape>(contentShape: T) {
  return z.object(contentShape).strict();
}

const nonMathQuizExplanationSchema = createNonMathQuizExplanationSchema(
  multipleChoiceQuizExplanationContentShape,
);

const nonMathTextInputQuizExplanationSchema = createNonMathQuizExplanationSchema(
  standardQuizExplanationContentShape,
);

const nonMathTrueFalseQuizExplanationSchema = createNonMathQuizExplanationSchema(
  trueFalseQuizExplanationContentShape,
);

const nonMathMultiStatementQuizExplanationSchema = createNonMathQuizExplanationSchema(
  multiStatementQuizExplanationContentShape,
);

export const quizExplanationBlockSchema = z
  .object({
    type: z.literal("quizExplanation"),
    problem: text(2_000),
    solution: text(10_000),
    isGeometry: z.boolean().optional(),
    origin: z.literal("AI_AUTHORED").optional(),
  })
  .strict();

const optionSchema = z
  .object({
    id: text(40).describe("ID duy nhất của phương án trong câu hỏi, ví dụ A, B, C, D."),
    text: learnerFacingText(
      1_000,
      "Nội dung phương án; phải rõ nghĩa và không chỉ dẫn học sinh xem hình minh họa.",
    ),
  })
  .strict();
const generatedCanonicalNumericAnswerPattern = /^-?(?:0|[1-9]\d*)(?:\/[1-9]\d*|\.\d)?$/u;
const numericAnswerSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(generatedCanonicalNumericAnswerPattern)
  .describe(
    "Đúng một đáp án số chuẩn. Chỉ dùng một trong ba dạng: số nguyên; phân số tối giản `p/q` có mẫu dương cho kết quả hữu tỉ không nguyên; hoặc số thập phân dùng dấu `.` và đúng một chữ số sau dấu thập phân cho kết quả vô tỉ đã được yêu cầu làm tròn. Không dùng dấu `,`, ký hiệu khoa học, LaTeX, ký hiệu vô tỉ, đơn vị, câu văn, xuống dòng hoặc nhiều phương án.",
  );

const quizNoFigureDecisionSchema = z
  .object({
    requiresQuestionFigure: z
      .literal(false)
      .describe(
        "Không tạo hình đề. Với TRUE_FALSE một mệnh đề, đây là giá trị bắt buộc; với loại câu khác, chỉ dùng khi policy của đúng môn xác định không cần hình.",
      ),
    solutionFigure: z.literal(false).describe("Không tạo hình lời giải cho câu hỏi này."),
  })
  .strict();

export const quizFigureDecisionSchema = z
  .object({
    requiresQuestionFigure: z
      .boolean()
      .describe("Quyết định độc lập có tạo hình đề hay không theo policy của đúng môn."),
    solutionFigure: z
      .boolean()
      .describe(
        "Đặt true khi và chỉ khi solution thực sự dùng thêm ít nhất một đối tượng hoặc quan hệ có thể vẽ so với problem; đặt false nếu solution không thêm cấu trúc trực quan, kể cả khi có thay số, biến đổi đại số, tính toán, đáp số hoặc kết luận mới.",
      ),
  })
  .strict()
  .describe(
    "Phase 1 chỉ trả hai quyết định boolean độc lập cho hình đề và hình lời giải; không lập figure plan và không quyết định cách vẽ.",
  );

const ALL_GENERATED_QUESTION_TYPES = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.MULTI_STATEMENT_TRUE_FALSE,
  QuestionType.TEXT_INPUT,
] as const;

function createQuestionSchemas<
  T extends z.ZodRawShape,
  V extends z.ZodType,
  U extends z.ZodType,
  W extends z.ZodType,
>(
  commonFields: T,
  trueFalseExplanationSchema: V,
  multiStatementExplanationSchema: U,
  textInputExplanationSchema: W,
) {
  return {
    [QuestionType.MULTIPLE_CHOICE]: z
      .object({
        questionType: z.literal(QuestionType.MULTIPLE_CHOICE),
        ...commonFields,
        figure: quizFigureDecisionSchema,
        options: z
          .array(optionSchema)
          .min(2)
          .max(6)
          .describe(
            "Từ 2 đến 6 phương án; mỗi phương án có ID riêng, có đúng một đáp án đúng và các phương án nhiễu phải hợp lý, không chồng nghĩa hoặc làm lộ đáp án.",
          ),
        correctOptionId: text(40).describe(
          "ID của đúng một phương án trong `options`; đây là nguồn đáp án duy nhất cho câu trắc nghiệm và Quiz không có trắc nghiệm nhiều đáp án.",
        ),
      })
      .strict()
      .describe(
        "Câu trắc nghiệm có đúng một phương án đúng; lời giải phải kết luận trực tiếp yêu cầu của đề theo system prompt.",
      ),
    [QuestionType.TRUE_FALSE]: z
      .object({
        questionType: z.literal(QuestionType.TRUE_FALSE),
        ...commonFields,
        figure: quizNoFigureDecisionSchema.describe(
          "TRUE_FALSE chỉ có một mệnh đề nên không tạo hình đề hoặc hình lời giải. Bắt buộc trả đúng `requiresQuestionFigure=false`, `solutionFigure=false`.",
        ),
        explanation: trueFalseExplanationSchema,
        correctAnswer: z
          .boolean()
          .describe(
            "Giá trị true/false của duy nhất một mệnh đề trong `explanation.problem`.",
          ),
      })
      .strict()
      .describe(
        "Câu đúng/sai gồm đúng một mệnh đề, một giá trị chấm điểm và không có hình; cách viết đề và kết luận tuân thủ system prompt.",
      ),
    [QuestionType.MULTI_STATEMENT_TRUE_FALSE]: z
      .object({
        questionType: z.literal(QuestionType.MULTI_STATEMENT_TRUE_FALSE),
        ...commonFields,
        figure: quizFigureDecisionSchema,
        explanation: multiStatementExplanationSchema,
        statements: z
          .array(
            z
              .object({
                id: z
                  .enum(QUIZ_SUBQUESTION_IDS)
                  .describe(
                    "Nhãn hiển thị của câu con, bắt buộc theo thứ tự liên tiếp a, b, c, d, ... từ đầu mảng; không dùng S1/S2, số thứ tự, chữ hoa hoặc ID tùy ý.",
                  ),
                text: learnerFacingText(
                  1_000,
                  "Nội dung một câu con đủ rõ để đánh giá đúng/sai độc lập và không chỉ dẫn học sinh xem hình minh họa.",
                ),
                value: z.boolean().describe("Giá trị true/false của câu con này."),
              })
              .strict(),
          )
          .min(2)
          .max(8)
          .describe(
            "Từ 2 đến 8 câu con có thể đánh giá độc lập; ID phải lần lượt là a, b, c, d, ... theo đúng thứ tự mảng.",
          ),
      })
      .strict()
      .describe(
        "Câu đúng/sai nhiều mệnh đề; `problem` chỉ chứa bối cảnh chung, còn từng nội dung và giá trị chấm điểm nằm trong `statements`.",
      ),
    [QuestionType.TEXT_INPUT]: z
      .object({
        questionType: z.literal(QuestionType.TEXT_INPUT),
        ...commonFields,
        figure: quizFigureDecisionSchema,
        explanation: textInputExplanationSchema,
        correctAnswer: numericAnswerSchema,
      })
      .strict()
      .describe(
        "Câu nhập đáp án có đúng một kết quả số chuẩn trong `correctAnswer`; quy tắc biểu diễn số và làm tròn nằm trong system prompt.",
      ),
  };
}

function buildQuestionSchema<T extends z.ZodRawShape>(
  commonFields: T,
  requestedTypes: readonly QuestionType[],
  trueFalseExplanationSchema: z.ZodType,
  multiStatementExplanationSchema: z.ZodType,
  textInputExplanationSchema: z.ZodType,
) {
  const schemas = createQuestionSchemas(
    commonFields,
    trueFalseExplanationSchema,
    multiStatementExplanationSchema,
    textInputExplanationSchema,
  );
  const selected = requestedTypes.map((type) => schemas[type]);
  const [first, second, ...rest] = selected;
  if (!first) throw new Error("Quiz output schema requires at least one question type.");
  if (!second) return first;
  return z.union([first, second, ...rest]);
}

function createNonMathQuizQuestionFields(difficulty: z.ZodType<Difficulty>) {
  return {
    difficulty,
    hint: learnerFacingText(1_000, QUIZ_HINT_FIELD_DESCRIPTION),
    explanation: nonMathQuizExplanationSchema.describe(
      "Gồm đề bài và lời giải theo đúng môn hiện tại; `problem` và `solution` phải hiểu được mà không cần xem hình minh họa. Không trả field `answer`; đáp án nằm duy nhất trong dữ liệu chấm điểm của loại câu.",
    ),
  };
}

const _generatedNonMathQuizQuestionSchema = buildQuestionSchema(
  createNonMathQuizQuestionFields(difficultySchema),
  ALL_GENERATED_QUESTION_TYPES,
  nonMathTrueFalseQuizExplanationSchema,
  nonMathMultiStatementQuizExplanationSchema,
  nonMathTextInputQuizExplanationSchema,
);

const _generatedMathQuizQuestionSchema = buildQuestionSchema(
  {
    difficulty: difficultySchema,
    hint: learnerFacingText(1_000, QUIZ_HINT_FIELD_DESCRIPTION),
    explanation: createMathQuizExplanationSchema(
      multipleChoiceQuizExplanationContentShape,
    ),
  },
  ALL_GENERATED_QUESTION_TYPES,
  createMathQuizExplanationSchema(trueFalseQuizExplanationContentShape),
  createMathQuizExplanationSchema(multiStatementQuizExplanationContentShape),
  createMathQuizExplanationSchema(standardQuizExplanationContentShape),
);

export interface GeneratedQuizSchemaConfiguration {
  subjectKey: QuizSubjectKey;
  targetGrade?: number | null;
  questionCount?: number;
  questionTypes?: readonly QuestionType[];
  difficulty?: Difficulty;
  includeSourceCoverageAudit?: boolean;
}

export const generatedQuizSourceCoverageAuditSchema = z
  .object({
    sourceHasAssessableRealWorldApplication: z
      .boolean()
      .describe(
        "Đặt true chỉ khi PDF nguồn có ít nhất một họ bài ứng dụng thực tế mà cách giải ngắn nhất bắt buộc dùng ít nhất một trọng tâm của lesson hiện tại; đặt false nếu bài thực tế trong nguồn vẫn giải nguyên vẹn chỉ bằng kiến thức đã học trước đó. Không được đặt false chỉ vì cần sáng tạo bối cảnh mới hoặc tránh trùng bài nguồn.",
      ),
    sourceApplicationFamily: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .nullable()
      .describe(
        "Nếu nguồn có bài ứng dụng phù hợp, mô tả ngắn họ bài, trọng tâm của lesson hiện tại bắt buộc phải dùng và vai trò mô hình hóa nhận diện từ nguồn mà không chép đề; nếu không có thì null.",
      ),
    realWorldQuestions: z
      .array(
        z
          .object({
            questionNumber: z
              .number()
              .int()
              .min(1)
              .max(50)
              .describe(
                "Số thứ tự 1-based của câu ứng dụng thực tế mới trong questions.",
              ),
            newContext: z
              .string()
              .trim()
              .min(1)
              .max(500)
              .describe(
                "Bối cảnh hoạt động, nhu cầu hoặc quyết định thực tế mới của câu; không lặp bối cảnh đặc thù trong nguồn.",
              ),
            modelingRole: z
              .string()
              .trim()
              .min(1)
              .max(500)
              .describe(
                "Giải thích ngắn thông tin thực tế tham gia thế nào vào việc lập mô hình và vì sao phải dùng trọng tâm của lesson hiện tại để giải; một vật thể chỉ kèm số đo hoặc một công thức kiến thức cũ không đủ.",
              ),
          })
          .strict(),
      )
      .max(50)
      .describe(
        "Các câu thực tế mới trong output. Mảng phải có ít nhất một phần tử khi nguồn có họ bài ứng dụng phù hợp và phải rỗng khi nguồn không có.",
      ),
  })
  .strict();

export function getGeneratedQuizOutputSchema(
  configuration: GeneratedQuizSchemaConfiguration,
) {
  const requestedTypes = configuration.questionTypes ?? ALL_GENERATED_QUESTION_TYPES;
  const requestedDifficulty =
    configuration.difficulty && configuration.difficulty !== Difficulty.MIXED
      ? z.literal(configuration.difficulty)
      : difficultySchema;
  const questionSchema =
    configuration.subjectKey === "MATH"
      ? buildQuestionSchema(
          {
            difficulty: requestedDifficulty,
            hint: learnerFacingText(1_000, QUIZ_HINT_FIELD_DESCRIPTION),
            explanation: createMathQuizExplanationSchema(
              multipleChoiceQuizExplanationContentShape,
            ).describe(
              "Gồm đề bài, lời giải và trường phân loại Hình học; không trả field `answer`; `problem` và `solution` phải hiểu được mà không cần xem hình minh họa.",
            ),
          },
          requestedTypes,
          createMathQuizExplanationSchema(trueFalseQuizExplanationContentShape).describe(
            "Gồm đúng một mệnh đề, lời giải có kết luận liên kết tự nhiên và trường phân loại Hình học; không trả field `answer`; mọi phần phải hiểu được mà không cần xem hình minh họa.",
          ),
          createMathQuizExplanationSchema(
            multiStatementQuizExplanationContentShape,
          ).describe(
            "Gồm đề bài, lời giải riêng trong `statementSolutions` cho từng mệnh đề và trường phân loại Hình học; đáp án nằm trong `statements[].value`; mọi phần phải hiểu được mà không cần xem hình minh họa.",
          ),
          createMathQuizExplanationSchema(standardQuizExplanationContentShape).describe(
            "Gồm đề bài và lời giải theo đúng môn hiện tại; không trả field `answer`; đáp án số nằm duy nhất trong `correctAnswer`.",
          ),
        )
      : buildQuestionSchema(
          createNonMathQuizQuestionFields(requestedDifficulty),
          requestedTypes,
          nonMathTrueFalseQuizExplanationSchema,
          nonMathMultiStatementQuizExplanationSchema,
          nonMathTextInputQuizExplanationSchema,
        );
  const questions = z.array(questionSchema);

  const resolvedQuestions =
    configuration.questionCount === undefined
      ? questions.min(1).max(50)
      : questions.length(configuration.questionCount);
  const description =
    "Danh sách câu Quiz theo đúng số lượng, loại câu và độ khó đã yêu cầu; mọi nội dung học sinh nhìn thấy phải tuân thủ system prompt.";
  if (!configuration.includeSourceCoverageAudit) {
    return z.object({ questions: resolvedQuestions }).strict().describe(description);
  }
  return z
    .object({
      sourceCoverageAudit: generatedQuizSourceCoverageAuditSchema,
      questions: resolvedQuestions,
    })
    .strict()
    .superRefine((output, context) => {
      const audit = output.sourceCoverageAudit;
      if (audit.sourceHasAssessableRealWorldApplication) {
        if (!audit.sourceApplicationFamily || audit.realWorldQuestions.length === 0) {
          context.addIssue({
            code: "custom",
            path: ["sourceCoverageAudit"],
            message:
              "Nguồn có họ bài ứng dụng thực tế thì phải mô tả họ bài và chỉ ra ít nhất một câu ứng dụng mới.",
          });
        }
      } else if (
        audit.sourceApplicationFamily !== null ||
        audit.realWorldQuestions.length > 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["sourceCoverageAudit"],
          message:
            "Nguồn không có họ bài ứng dụng thực tế thì sourceApplicationFamily phải null và realWorldQuestions phải rỗng.",
        });
      }
      const seen = new Set<number>();
      for (const [index, item] of audit.realWorldQuestions.entries()) {
        if (
          item.questionNumber > output.questions.length ||
          seen.has(item.questionNumber)
        ) {
          context.addIssue({
            code: "custom",
            path: ["sourceCoverageAudit", "realWorldQuestions", index, "questionNumber"],
            message: "Số thứ tự câu thực tế phải tồn tại và không được lặp.",
          });
        }
        seen.add(item.questionNumber);
      }
    })
    .describe(description);
}

const sourceSnapshotSchema = z
  .object({
    requestDraftId: z.uuid(),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    packetHash: z.string().regex(/^[a-f0-9]{64}$/),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    documentIds: z.array(z.uuid()).min(1).max(50),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    targetGrade: z.number().int().min(1).max(12).nullable().default(null),
    subjectKey: quizSubjectKeySchema,
    subjectName: z.string().trim().min(1).max(120),
    subjectSlug: z.string().trim().min(1).max(140),
  })
  .strict();

const difficultyCountsSchema = z
  .object({
    easy: z.number().int().min(0).max(50),
    medium: z.number().int().min(0).max(50),
    hard: z.number().int().min(0).max(50),
  })
  .strict();

export const quizGenerationJobInputSchema = sourceSnapshotSchema
  .extend({
    targetQuizSetId: z.uuid().nullable().default(null),
    questionCount: z.number().int().min(1).max(50),
    difficulty: z.nativeEnum(Difficulty),
    difficultyCounts: difficultyCountsSchema.nullable().default(null),
    questionTypes: z
      .array(z.nativeEnum(QuestionType))
      .min(1)
      .max(4)
      .refine((types) => new Set(types).size === types.length, {
        message: "questionTypes must not contain duplicates",
      }),
    style: z
      .enum(["student_friendly", "concise", "academic"])
      .default("student_friendly"),
    styleInstructions: z.string().trim().max(1_000).default(""),
    extraInstructions: z.string().trim().max(2_000).default(""),
    systemInstructions: z.string().trim().max(64_000).default(""),
    userPrompt: z.string().trim().max(16_000).default(""),
    imageRouteSnapshot: z.record(z.string(), z.unknown()).optional(),
    model: z.string().trim().max(200).optional(),
    temperature: z.number().min(0).max(1).optional(),
    reasoningEffort: z.enum(AI_REASONING_EFFORT_LEVELS).optional(),
    schemaReferenceStrategy: z
      .enum(["inline", "ref", "ref_v2", "auto"])
      .default("inline"),
    promptCacheKeyEnabled: z.boolean().default(false),
    promptCacheRetention: z.enum(["in_memory", "24h"]).default("in_memory"),
    maxOutputTokens: z
      .number()
      .int()
      .min(QUIZ_MIN_OUTPUT_TOKENS)
      .max(QUIZ_MAX_CONFIGURED_OUTPUT_TOKENS)
      .optional(),
  })
  .strict();

export type GeneratedQuizQuestion =
  | z.infer<typeof _generatedNonMathQuizQuestionSchema>
  | z.infer<typeof _generatedMathQuizQuestionSchema>;
export type GeneratedQuizStatementSolution = z.infer<typeof quizStatementSolutionSchema>;
export type GeneratedQuizSourceCoverageAudit = z.infer<
  typeof generatedQuizSourceCoverageAuditSchema
>;
export type QuizGenerationJobInput = z.infer<typeof quizGenerationJobInputSchema>;
export type QuizExplanationBlock = z.infer<typeof quizExplanationBlockSchema>;

export function getGeneratedQuizStatementSolutions(
  question: GeneratedQuizQuestion,
): GeneratedQuizStatementSolution[] | null {
  if (!("statementSolutions" in question.explanation)) return null;
  const parsed = z
    .array(quizStatementSolutionSchema)
    .safeParse(question.explanation.statementSolutions);
  return parsed.success ? parsed.data : null;
}
