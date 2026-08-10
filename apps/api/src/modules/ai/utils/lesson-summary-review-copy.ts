const EQUAL_LENGTH_MISMATCH_PATTERN =
  /EQUAL_LENGTH segments must have coordinate lengths within 2%:\s*([^\n.]+)\.?/iu;
const MARKER_MISSING_PATTERN =
  /(EQUAL_LENGTH|PARALLEL) references missing or non-segment primitive\s+([^\n.]+)\.?/giu;
const DUPLICATE_MARKER_PATTERN = /Duplicate marker segment:\s*([^\n.]+)\.?/iu;
const RIGHT_ANGLE_MISMATCH_PATTERN =
  /RIGHT_ANGLE at\s+([^\s.]+)\s+is not perpendicular/iu;
const PARALLEL_MISMATCH_PATTERN =
  /PARALLEL segments must have coordinate directions within 2%:\s*([^\n.]+)\.?/iu;
const UNKNOWN_REFERENCE_PATTERN =
  /(SEGMENT|LINE|RAY|POLYGON|POLYLINE|CIRCLE|ELLIPSE|ARC|RIGHT_ANGLE|ANGLE|Label) references unknown (?:point|center|vertex|arm point)\s+([^\n.]+)\.?/iu;
const SAME_ENDPOINT_PATTERN = /(SEGMENT|LINE|RAY) must use two different points/iu;
const VISIBLE_POINT_SCALE_PATTERN =
  /Visible point\s+([^\s]+)\s+on the ([xy])-axis requires numeric scale label\s+([^\n.]+)\.?/iu;
const GRAPH_POINT_NAME_PATTERN =
  /Every visible graph construction point requires a unique short point name:\s*([^\n.]+)\.?/iu;
const NUMBER_LINE_ANCHOR_PATTERN =
  /Number-line label\s+([^\s]+)\s+must anchor directly on its tick or marked point/iu;
const NUMBER_LINE_MARK_PATTERN =
  /Number-line value\s+([^\s]+)\s+requires a visible tick or endpoint mark/iu;
const DUPLICATE_VALUE_PATTERN = /Duplicate\s+([^:]+):\s*([^\n.]+)\.?/iu;
const LINE_CHART_VALUE_PATTERN =
  /Line-chart data point\s+([^\s]+)\s+requires a value label anchored directly to it/iu;
const FRACTION_AREA_PATTERN =
  /Fraction area model\s+([^\s]+)\s+requires at least\s+(\d+)\s+filled polygons/iu;
const NUMBER_LINE_TICK_PATTERN =
  /Number line fractions with denominator\s+(\d+)\s+require at least\s+(\d+)\s+visible tick segments/iu;
const DECLARED_POINT_MISSING_PATTERN =
  /Declared point\s+([^\s.]+)\s+is missing from the compiled diagram/iu;

const KNOWN_DIAGRAM_ISSUE_COPY: Array<{
  includes: string;
  message: string;
  suggestion: string;
}> = [
  {
    includes: "Function graphs with y= labels require both horizontal and vertical axes",
    message: "Đồ thị hàm số đang thiếu một trong hai trục Ox hoặc Oy.",
    suggestion: "Bổ sung đầy đủ hai trục tọa độ ngang và dọc đi qua gốc O.",
  },
  {
    includes: "Coordinate axes labeled x and y must cover all plotted points",
    message: "Trục tọa độ chưa kéo dài đủ để bao phủ tất cả các điểm đã vẽ.",
    suggestion: "Mở rộng Ox và Oy để mọi điểm nằm trong miền hiển thị của hai trục.",
  },
  {
    includes: "Cartesian graphs require horizontal and vertical LINE axes through O",
    message: "Hệ trục Oxy chưa có đủ hai đường thẳng đi qua O và kéo về cả phía âm.",
    suggestion:
      "Vẽ hai đường thẳng ngang và dọc đi qua O để hiển thị đầy đủ chiều âm và chiều dương.",
  },
  {
    includes:
      "Cartesian axes require at least two visible unit tick segments on each axis",
    message: "Mỗi trục tọa độ chưa có đủ các vạch chia đơn vị nhìn thấy được.",
    suggestion: "Thêm ít nhất hai vạch chia ngắn trên mỗi trục Ox và Oy.",
  },
  {
    includes: "Cartesian axes require numeric scale labels on both the x and y axes",
    message: "Trục Ox hoặc Oy đang thiếu nhãn số để thể hiện tỉ lệ chia đơn vị.",
    suggestion: "Bổ sung nhãn số tại các vạch chia trên cả hai trục.",
  },
  {
    includes:
      "Coordinate labels must anchor directly to a matching named or visible curve-construction FILLED point",
    message: "Một nhãn tọa độ chưa được neo đúng vào điểm dựng tương ứng.",
    suggestion:
      "Neo nhãn tọa độ vào đúng điểm có cùng tọa độ và cho điểm đó hiển thị rõ.",
  },
  {
    includes: "Table cell labels must use CENTER positioning",
    message: "Một hoặc nhiều giá trị trong bảng chưa được căn giữa ô.",
    suggestion: "Căn mọi giá trị vào chính giữa ô tương ứng.",
  },
  {
    includes: "Bar and line charts require visible subdivisions on both axes",
    message:
      "Biểu đồ đang thiếu trục hoặc vạch chia nhìn thấy được trên một trong hai trục.",
    suggestion: "Bổ sung hai trục và các vạch chia phù hợp với dữ liệu biểu đồ.",
  },
  {
    includes: "Inequality labels must include their left-hand expression",
    message: "Nhãn bất đẳng thức đang thiếu biểu thức ở vế trái.",
    suggestion: "Viết đầy đủ dạng như x ≥ 0 hoặc y ≤ 2, không chỉ ghi dấu và số.",
  },
  {
    includes: "Quadratic graphs require a POLYLINE with at least 17 sample points",
    message: "Đồ thị bậc hai chưa có đủ điểm lấy mẫu để tạo đường cong liên tục.",
    suggestion: "Vẽ đường cong qua ít nhất 17 điểm lấy mẫu đúng theo hàm số.",
  },
  {
    includes: "Quadratic construction requires a visible vertex",
    message:
      "Parabol đang thiếu đỉnh hoặc chưa đủ hai cặp điểm dựng đối xứng nhìn thấy được.",
    suggestion:
      "Hiển thị đỉnh và ít nhất hai cặp điểm dựng đối xứng; giữ các điểm làm mượt ở trạng thái ẩn.",
  },
  {
    includes: "A solid with radius label r requires a segment from an ellipse center",
    message: "Khối hình có nhãn bán kính r nhưng chưa vẽ đoạn bán kính từ tâm đáy.",
    suggestion: "Thêm đoạn bán kính từ tâm hình elip tới biên và neo nhãn r vào đoạn đó.",
  },
  {
    includes: "Radius label r must anchor to a radius SEGMENT",
    message: "Nhãn r chưa được neo vào đúng đoạn bán kính.",
    suggestion: "Neo nhãn r vào đoạn nối tâm với biên của đường tròn hoặc hình elip.",
  },
  {
    includes: "Height label h must anchor to a vertical height SEGMENT",
    message: "Nhãn h chưa được neo vào đúng đoạn biểu diễn chiều cao.",
    suggestion: "Neo nhãn h vào đoạn chiều cao gần thẳng đứng của khối hình.",
  },
  {
    includes: "Venn universe label U must use a separate interior point",
    message: "Nhãn tập vũ trụ U đang đặt sai neo hoặc đè lên đường bao sơ đồ Venn.",
    suggestion: "Tạo một điểm neo riêng bên trong hình chữ nhật và căn U tại điểm đó.",
  },
  {
    includes: "An analog clock requires one circular clock face",
    message: "Hình đồng hồ đang thiếu mặt đồng hồ hình tròn hợp lệ.",
    suggestion: "Bổ sung một đường tròn làm mặt đồng hồ và khai báo đúng tâm.",
  },
  {
    includes: "A clock face requires the four cardinal labels 12, 3, 6 and 9",
    message: "Mặt đồng hồ đang thiếu một hoặc nhiều số 12, 3, 6, 9.",
    suggestion: "Bổ sung đủ bốn số tại đúng các vị trí chính trên đường tròn.",
  },
  {
    includes: "A clock face requires visible hour tick segments",
    message: "Mặt đồng hồ đang thiếu các vạch giờ nhìn thấy được.",
    suggestion: "Thêm các vạch giờ ngắn, tối thiểu gồm bốn vạch tại 12, 3, 6, 9.",
  },
  {
    includes: "A number line must use numeric 0 for the zero mark",
    message: "Trục số đang dùng chữ O thay cho số 0 tại mốc không.",
    suggestion: "Đổi nhãn O thành số 0 và chỉ giữ một mốc 0 trên trục số.",
  },
  {
    includes: "A number line that contains zero requires exactly one numeric 0 label",
    message: "Mốc 0 trên trục số đang thiếu, bị lặp hoặc không neo đúng vạch.",
    suggestion: "Giữ đúng một nhãn số 0 tại vạch 0 nhìn thấy được.",
  },
  {
    includes: "POLYLINE cannot repeat the same point consecutively",
    message: "Đường gấp khúc hoặc đường cong đang lặp cùng một điểm liên tiếp.",
    suggestion: "Xóa một trong hai điểm bị lặp liên tiếp trên đường vẽ.",
  },
  {
    includes: "An angle marker must not repeat the vertex name",
    message: "Ký hiệu góc đang lặp lại tên đỉnh đã có trên hình.",
    suggestion: "Bỏ nhãn lặp của góc; chỉ giữ nhãn khi cần ghi số đo.",
  },
  {
    includes: "must use two different arm points, both different from its vertex",
    message: "Ký hiệu góc đang dùng trùng điểm đỉnh hoặc trùng hai điểm trên hai cạnh.",
    suggestion: "Chọn hai điểm cánh khác nhau và đều khác điểm đỉnh của góc.",
  },
  {
    includes: "Length values must anchor to their corresponding SEGMENT",
    message: "Một nhãn độ dài chưa được neo vào cạnh mà nó biểu diễn.",
    suggestion: "Neo nhãn độ dài vào đúng đoạn thẳng mà nhãn đó biểu diễn.",
  },
  {
    includes: "Label anchorPrimitiveId must reference a SEGMENT",
    message: "Một nhãn đang tham chiếu tới đối tượng không phải đoạn thẳng.",
    suggestion: "Neo nhãn vào đúng đoạn thẳng mà nhãn đó biểu diễn.",
  },
  {
    includes: "The x≥0 label must sit just inside the right side of the y-axis",
    message: "Nhãn x ≥ 0 đang đặt sai phía hoặc sai vị trí so với trục Oy.",
    suggestion: "Đặt nhãn x ≥ 0 ngay bên phải trục Oy, sát miền mà nhãn biểu diễn.",
  },
  {
    includes: "The y≥0 label must sit just above the x-axis",
    message: "Nhãn y ≥ 0 đang đặt sai phía hoặc sai vị trí so với trục Ox.",
    suggestion: "Đặt nhãn y ≥ 0 ngay phía trên trục Ox, sát miền mà nhãn biểu diễn.",
  },
];

export type LessonSummaryReviewCopy = {
  message: string;
  suggestion: string;
};

const DIFFICULT_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/primitives\.segments/giu, "danh sách đoạn thẳng"],
  [/anchorPrimitiveId/giu, "điểm neo của nhãn"],
  [/sourceTopicId/giu, "mã chủ đề nguồn"],
  [/sourceChunkIds/giu, "nguồn tham chiếu"],
  [/displayHeading/giu, "tên đề mục"],
  [/segmentIds/giu, "danh sách đoạn được đánh dấu"],
  [/diagramSpec/giu, "dữ liệu hình vẽ"],
  [/pointIds/giu, "danh sách điểm"],
  [/viewBox/giu, "khung hiển thị"],
  [/RIGHT_ANGLE/gu, "ký hiệu góc vuông"],
  [/EQUAL_LENGTH/gu, "ký hiệu bằng nhau"],
  [/PARALLEL/gu, "ký hiệu song song"],
  [/POLYLINE/gu, "đường vẽ"],
  [/SEGMENT/gu, "đoạn thẳng"],
  [/\bLINE\b/gu, "đường thẳng"],
  [/CENTER/gu, "chính giữa"],
  [/\bbackend\b/giu, "hệ thống"],
  [/\badmin\b/giu, "quản trị viên"],
  [/\boutput\b/giu, "nội dung tạo ra"],
  [/\bsection\b/giu, "đề mục"],
  [/\bheading\b/giu, "tiêu đề"],
  [/\bmarker\b/giu, "ký hiệu"],
  [/\blabel\b/giu, "nhãn"],
  [/\bpoint\b/giu, "điểm"],
  [/\bpoints\b/giu, "danh sách điểm"],
  [/\bprimitive\b/giu, "nét vẽ"],
  [/\bprimitives\b/giu, "các nét vẽ"],
  [/\btitle\b/giu, "tiêu đề"],
  [/\bcontent\b/giu, "nội dung"],
  [/\bproblem\b/giu, "đề bài"],
  [/\bsolution\b/giu, "lời giải"],
  [/\banswer\b/giu, "đáp án"],
  [/\bsteps\b/giu, "các bước thực hiện"],
  [/\bobjectives\b/giu, "mục tiêu học tập"],
  [/\bvisual\b/giu, "hình minh họa"],
  [/\bspec\b/giu, "dữ liệu hình vẽ"],
  [/\btype\b/giu, "loại dữ liệu"],
  [/\binvalid\b/giu, "chưa hợp lệ"],
  [/\bnull\b/giu, "để trống"],
  [/\bJSON\b/gu, "dữ liệu"],
  [/\bID\b/gu, "tên"],
  [/\bfield\b/giu, "phần dữ liệu"],
  [/\bcontext\b/giu, "tài liệu nguồn"],
  [
    /\s*\((?:title|content|problem|solution|answer|steps|sourceChunkIds|visual|spec|type|objectives)\)/giu,
    "",
  ],
];

export function simplifyLessonSummaryReviewCopy(
  copy: LessonSummaryReviewCopy,
): LessonSummaryReviewCopy {
  return {
    message: simplifyReviewText(copy.message),
    suggestion: simplifyReviewText(copy.suggestion),
  };
}

export function describeLessonSummaryDiagramReviewIssue(
  technicalDetails: string | null,
): LessonSummaryReviewCopy | null {
  if (!technicalDetails) return null;

  const equalLengthMismatch = technicalDetails.match(EQUAL_LENGTH_MISMATCH_PATTERN);
  if (equalLengthMismatch?.[1]) {
    const segments = formatDiagramIds(equalLengthMismatch[1]);
    return {
      message: `Các đoạn ${segments} được đánh dấu bằng nhau nhưng độ dài theo tọa độ chưa khớp.`,
      suggestion: `Điều chỉnh tọa độ để ${segments} có cùng độ dài, hoặc bỏ ký hiệu bằng nhau nếu đề không có giả thiết này.`,
    };
  }

  const missingMarkerMatches = [...technicalDetails.matchAll(MARKER_MISSING_PATTERN)];
  const missingSegments = missingMarkerMatches.flatMap((match) =>
    match[2] ? [match[2]] : [],
  );
  if (missingSegments.length > 0) {
    const segments = formatDiagramIds(missingSegments.join(", "));
    const relation = missingMarkerMatches.some((match) => match[1] === "PARALLEL")
      ? "song song"
      : "bằng nhau";
    return {
      message: `Ký hiệu ${relation} đang tham chiếu các đoạn ${segments} chưa được khai báo hợp lệ.`,
      suggestion: `Khai báo ${segments} thành các đoạn thẳng riêng, hoặc sửa ký hiệu để tham chiếu đúng các đoạn đã có.`,
    };
  }

  const duplicateMarker = technicalDetails.match(DUPLICATE_MARKER_PATTERN);
  if (duplicateMarker?.[1]) {
    const segment = formatDiagramId(duplicateMarker[1]);
    return {
      message: `Đoạn ${segment} đang bị gắn ký hiệu hình học trùng lặp.`,
      suggestion: `Giữ lại một ký hiệu đúng cho đoạn ${segment} và xóa ký hiệu bị lặp.`,
    };
  }

  const rightAngleMismatch = technicalDetails.match(RIGHT_ANGLE_MISMATCH_PATTERN);
  if (rightAngleMismatch?.[1]) {
    const vertex = formatDiagramId(rightAngleMismatch[1]);
    return {
      message: `Góc tại ${vertex} được đánh dấu vuông nhưng hai cạnh theo tọa độ chưa vuông góc.`,
      suggestion: `Điều chỉnh tọa độ hai cạnh tại ${vertex}, hoặc bỏ dấu vuông nếu đề không xác định góc vuông.`,
    };
  }

  const parallelMismatch = technicalDetails.match(PARALLEL_MISMATCH_PATTERN);
  if (parallelMismatch?.[1]) {
    const segments = formatDiagramIds(parallelMismatch[1]);
    return {
      message: `Các đoạn ${segments} được đánh dấu song song nhưng hướng theo tọa độ chưa khớp.`,
      suggestion: `Điều chỉnh hướng của ${segments}, hoặc bỏ ký hiệu song song nếu đề không có giả thiết này.`,
    };
  }

  const unknownReference = technicalDetails.match(UNKNOWN_REFERENCE_PATTERN);
  if (unknownReference?.[1] && unknownReference[2]) {
    const object = formatPrimitiveType(unknownReference[1]);
    const id = formatDiagramId(unknownReference[2]);
    return {
      message: `${object} đang tham chiếu điểm ${id} chưa được khai báo.`,
      suggestion: `Bổ sung điểm ${id}, hoặc sửa ${object.toLowerCase()} để dùng đúng một điểm đã có trên hình.`,
    };
  }

  const sameEndpoint = technicalDetails.match(SAME_ENDPOINT_PATTERN);
  if (sameEndpoint?.[1]) {
    const object = formatPrimitiveType(sameEndpoint[1]);
    return {
      message: `${object} đang dùng cùng một điểm cho cả hai đầu nên không thể tạo thành nét vẽ.`,
      suggestion: "Chọn hai điểm đầu mút khác nhau cho nét vẽ này.",
    };
  }

  const visiblePointScale = technicalDetails.match(VISIBLE_POINT_SCALE_PATTERN);
  if (visiblePointScale?.[1] && visiblePointScale[2] && visiblePointScale[3]) {
    const point = formatDiagramId(visiblePointScale[1]);
    return {
      message: `Điểm ${point} trên trục ${visiblePointScale[2]} đang thiếu nhãn số ${visiblePointScale[3]}.`,
      suggestion: `Thêm nhãn ${visiblePointScale[3]} sát đúng vạch của điểm ${point}.`,
    };
  }

  const graphPointName = technicalDetails.match(GRAPH_POINT_NAME_PATTERN);
  if (graphPointName?.[1]) {
    const point = formatDiagramId(graphPointName[1]);
    return {
      message: `Điểm dựng ${point} đang hiển thị nhưng chưa có tên ngắn duy nhất.`,
      suggestion: `Đặt tên ngắn cho điểm ${point}, ví dụ A, B, P hoặc Q, và không lặp tên điểm khác.`,
    };
  }

  const numberLineAnchor = technicalDetails.match(NUMBER_LINE_ANCHOR_PATTERN);
  if (numberLineAnchor?.[1]) {
    return {
      message: `Nhãn ${numberLineAnchor[1]} chưa được neo sát đúng vạch hoặc điểm trên trục số.`,
      suggestion: `Đưa điểm neo của nhãn ${numberLineAnchor[1]} về đúng vạch giá trị tương ứng.`,
    };
  }

  const numberLineMark = technicalDetails.match(NUMBER_LINE_MARK_PATTERN);
  if (numberLineMark?.[1]) {
    return {
      message: `Giá trị ${numberLineMark[1]} trên trục số chưa có vạch hoặc dấu điểm nhìn thấy được.`,
      suggestion: `Thêm một vạch ngắn hoặc điểm đầu mút tại đúng giá trị ${numberLineMark[1]}.`,
    };
  }

  const lineChartValue = technicalDetails.match(LINE_CHART_VALUE_PATTERN);
  if (lineChartValue?.[1]) {
    const point = formatDiagramId(lineChartValue[1]);
    return {
      message: `Điểm dữ liệu ${point} trên biểu đồ đường đang thiếu nhãn giá trị.`,
      suggestion: `Thêm nhãn số và neo trực tiếp vào điểm ${point}.`,
    };
  }

  const fractionArea = technicalDetails.match(FRACTION_AREA_PATTERN);
  if (fractionArea?.[1] && fractionArea[2]) {
    return {
      message: `Mô hình phân số ${fractionArea[1]} chưa tô đủ ${fractionArea[2]} phần theo tử số.`,
      suggestion: `Tô đúng ${fractionArea[2]} miền đa giác bằng nhau trong mô hình phân số.`,
    };
  }

  const numberLineTicks = technicalDetails.match(NUMBER_LINE_TICK_PATTERN);
  if (numberLineTicks?.[1] && numberLineTicks[2]) {
    return {
      message: `Trục số biểu diễn phân số mẫu ${numberLineTicks[1]} chưa có đủ ${numberLineTicks[2]} vạch chia.`,
      suggestion: `Chia trục thành các khoảng bằng nhau và thêm đủ ${numberLineTicks[2]} vạch nhìn thấy được.`,
    };
  }

  const declaredPointMissing = technicalDetails.match(DECLARED_POINT_MISSING_PATTERN);
  if (declaredPointMissing?.[1]) {
    const point = formatDiagramId(declaredPointMissing[1]);
    return {
      message: `Hình vẫn vẽ được nhưng đang thiếu điểm ${point} đã được nêu trong yêu cầu hình.`,
      suggestion: `Đối chiếu đề bài và bổ sung điểm ${point} nếu điểm này cần xuất hiện; nếu hình hiện tại đã đủ ý, có thể chấp nhận hình.`,
    };
  }

  const inferredPoint = technicalDetails.match(
    /INFERRED_POINT_LABEL:[^\n]*standard point name\s+([^\s.]+)/iu,
  );
  if (inferredPoint?.[1]) {
    const point = formatDiagramId(inferredPoint[1]);
    return {
      message: `Hình vẫn vẽ được; hệ thống đã tự bổ sung tên điểm ${point} còn thiếu theo mẫu hình chuẩn.`,
      suggestion: `Đối chiếu điểm ${point} với đề bài và đổi tên nếu cần; có thể chấp nhận nếu tên tự bổ sung đã đúng.`,
    };
  }

  if (technicalDetails.includes("TABLE_CELL_LABEL_COUNT")) {
    return {
      message: "Bảng vẫn hiển thị được nhưng đang có một hoặc vài ô thiếu nội dung.",
      suggestion: "Bổ sung giá trị cho các ô trống, hoặc xóa hàng/cột không cần thiết rồi lưu lại.",
    };
  }

  if (technicalDetails.includes("CHART_VALUE_COUNT_RECOVERED")) {
    return {
      message: "Biểu đồ vẫn hiển thị được nhưng số nhãn và số giá trị chưa khớp; phần dư đã được bỏ.",
      suggestion: "Bổ sung hoặc xóa nhãn/giá trị để mỗi nhãn có đúng một giá trị tương ứng.",
    };
  }

  if (technicalDetails.includes("PICTOGRAM_VALUE_COUNT_RECOVERED")) {
    return {
      message: "Biểu đồ tranh vẫn hiển thị được nhưng số nhóm và số giá trị chưa khớp; phần dư đã được bỏ.",
      suggestion: "Bổ sung hoặc xóa nhóm/giá trị để mỗi nhóm có đúng một giá trị tương ứng.",
    };
  }

  if (technicalDetails.includes("SPATIAL_DIMENSION_OMITTED")) {
    return {
      message: "Hình khối vẫn hiển thị được; một số đo không hợp lệ đã được bỏ khỏi hình.",
      suggestion: "Nhập lại số đo lớn hơn 0 và gắn nó vào đúng cạnh của hình khối.",
    };
  }

  if (technicalDetails.includes("MEASUREMENT_STEP_RECOVERED")) {
    return {
      message: "Thước đo vẫn hiển thị được; bước chia đã cho lớn hơn toàn khoảng nên hệ thống chỉ giữ hai mốc đầu–cuối.",
      suggestion: "Giảm bước chia để có thêm các vạch mốc nằm giữa giá trị nhỏ nhất và lớn nhất.",
    };
  }

  if (technicalDetails.includes("SCHEMATIC_EDGE_OMITTED")) {
    return {
      message: "Sơ đồ vẫn hiển thị được; một đường nối có đầu mút không tồn tại hoặc tự nối vào chính nó đã được bỏ.",
      suggestion: "Chọn lại hai nút có thật và khác nhau cho đường nối bị bỏ.",
    };
  }

  if (technicalDetails.includes("COORDINATE_POINT_OMITTED")) {
    return {
      message: "Một điểm tọa độ bị trùng tên hoặc nằm ngoài miền trục nên đã được bỏ khỏi hình.",
      suggestion: "Đổi tên điểm cho duy nhất hoặc mở rộng miền trục để điểm nằm trong khung rồi lưu lại.",
    };
  }

  if (technicalDetails.includes("INEQUALITY_BOUNDARY_OMITTED")) {
    return {
      message: "Một đường biên bất phương trình không xác định nên đã được bỏ; các đường biên hợp lệ vẫn hiển thị.",
      suggestion: "Sửa các hệ số của đường biên bị bỏ để ít nhất một hệ số của x hoặc y khác 0.",
    };
  }

  if (technicalDetails.includes("GRAPH_CONSTRUCTION_POINT_OMITTED")) {
    return {
      message: "Một điểm dựng đồ thị nằm ngoài miền đang vẽ nên đã được bỏ khỏi hình.",
      suggestion: "Chọn lại hoành độ điểm dựng hoặc mở rộng miền trục để điểm nằm trên phần đồ thị nhìn thấy được.",
    };
  }

  if (technicalDetails.includes("GRAPH_FUNCTION_LABEL_MISSING")) {
    return {
      message: "Đồ thị vẫn vẽ được nhưng chưa tìm được vị trí an toàn để đặt tên hàm số.",
      suggestion: "Mở rộng miền vẽ hoặc điều chỉnh vị trí nhãn hàm để tên nằm gần đường cong và không đè lên nét vẽ.",
    };
  }

  const duplicateValue = technicalDetails.match(DUPLICATE_VALUE_PATTERN);
  if (duplicateValue?.[1] && duplicateValue[2]) {
    const value = formatDiagramId(duplicateValue[2]);
    const collection = formatDuplicateCollection(duplicateValue[1]);
    return {
      message: `Giá trị ${value} đang bị khai báo trùng trong ${collection}.`,
      suggestion: `Giữ một khai báo duy nhất cho ${value} và đổi hoặc xóa mục bị lặp.`,
    };
  }

  const knownIssue = KNOWN_DIAGRAM_ISSUE_COPY.find(({ includes }) =>
    technicalDetails.includes(includes),
  );
  if (knownIssue) {
    return { message: knownIssue.message, suggestion: knownIssue.suggestion };
  }

  if (
    technicalDetails.includes("Do not write segment names or equalities as diagram text")
  ) {
    return {
      message: "Hình có nhãn tên đoạn hoặc đẳng thức dạng chữ không đúng quy ước.",
      suggestion:
        "Bỏ nhãn chữ thừa và dùng ký hiệu gạch bằng nhau trên các đoạn tương ứng.",
    };
  }

  const path = technicalDetails.split("\n", 1)[0]?.split(":", 1)[0] ?? "diagramSpec";
  const target = formatTechnicalPath(path);
  return {
    message: `Dữ liệu ${target} chưa hợp lệ theo quy tắc vẽ.`,
    suggestion: `Kiểm tra ${target}, bổ sung dữ liệu còn thiếu hoặc sửa đối tượng đang tham chiếu sai.`,
  };
}

export function hasOnlyAutoRemovableDiagramLabelIssues(technicalDetails: string) {
  const lines = technicalDetails.split("\n").filter(Boolean);
  const removableMessages = [
    "Do not write segment names or equalities as diagram text",
    "Length values must anchor to their corresponding SEGMENT",
    "Duplicate label:",
    "An angle marker must not repeat the vertex name",
  ];
  return (
    lines.length > 0 &&
    lines.every((line) => removableMessages.some((message) => line.includes(message)))
  );
}

function formatDiagramIds(value: string) {
  const ids = value
    .split(",")
    .map((id) => formatDiagramId(id))
    .filter(Boolean);
  if (ids.length <= 1) return ids[0] ?? "được nêu";
  if (ids.length === 2) return `${ids[0]} và ${ids[1]}`;
  return `${ids.slice(0, -1).join(", ")} và ${ids.at(-1)}`;
}

function formatDiagramId(value: string) {
  return value
    .trim()
    .replace(/_part$/iu, "")
    .replaceAll("_prime", "′")
    .replaceAll("_", "");
}

function formatTechnicalPath(value: string) {
  const parts = value.split(".");
  if (parts.includes("points")) return "danh sách điểm";
  if (parts.includes("primitives")) return "các nét vẽ";
  if (parts.includes("markers")) return "các ký hiệu hình học";
  if (parts.includes("labels")) return "các nhãn chữ";
  if (parts.includes("viewBox")) return "khung hiển thị";
  return "hình vẽ";
}

function formatPrimitiveType(value: string) {
  return (
    (
      {
        SEGMENT: "Đoạn thẳng",
        LINE: "Đường thẳng",
        RAY: "Tia",
        POLYGON: "Đa giác",
        POLYLINE: "Đường gấp khúc hoặc đường cong",
        CIRCLE: "Đường tròn",
        ELLIPSE: "Đường elip",
        ARC: "Cung tròn",
        RIGHT_ANGLE: "Ký hiệu góc vuông",
        ANGLE: "Ký hiệu góc",
        Label: "Nhãn chữ",
      } as Record<string, string>
    )[value] ?? "Đối tượng hình học"
  );
}

function formatDuplicateCollection(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("point")) return "danh sách điểm";
  if (normalized.includes("primitive")) return "danh sách nét vẽ";
  if (normalized.includes("label")) return "danh sách nhãn";
  if (normalized.includes("marker")) return "danh sách ký hiệu";
  return "dữ liệu hình vẽ";
}

function simplifyReviewText(value: string) {
  return DIFFICULT_TERM_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  )
    .replace(/\s{2,}/gu, " ")
    .trim();
}
