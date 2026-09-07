import { removeStemFigureAngleMarkerGroup } from "@/lib/stem-figure-source-actions";

export type StemFigureQuickAngleInput = {
  angleName: string;
  autoConnect: boolean;
  degreesText: string;
};

export type StemFigureQuickAngleIssueCode =
  | "ANGLE_ALREADY_EXISTS"
  | "ANGLE_NAME_INVALID"
  | "DEGREES_INVALID"
  | "MISSING_POINT"
  | "MISSING_SEGMENT"
  | "POINT_NAME_AMBIGUOUS"
  | "POINTS_NOT_DISTINCT"
  | "SOURCE_UNSUPPORTED";

export type StemFigureQuickAngleIssue = {
  code: StemFigureQuickAngleIssueCode;
  message: string;
};

export type StemFigureQuickAngleResult = {
  addedSegments: string[];
  canonicalAngle: string | null;
  changedCount: number;
  degrees: number | null;
  issue: StemFigureQuickAngleIssue | null;
  markerCount: number | null;
  replacedExisting: boolean;
  source: string;
};

export type StemFigureQuickAngleRemovalInput = {
  angleName: string;
};

export type StemFigureQuickAngleRemovalIssue = {
  code:
    | "ANGLE_NAME_INVALID"
    | "ANGLE_NOT_FOUND"
    | "MISSING_POINT"
    | "POINT_NAME_AMBIGUOUS"
    | "POINTS_NOT_DISTINCT";
  message: string;
};

export type StemFigureQuickAngleRemovalResult = {
  canonicalAngle: string | null;
  changedCount: number;
  issue: StemFigureQuickAngleRemovalIssue | null;
  source: string;
};

export type StemFigureSegmentAction = "CONNECT" | "DISCONNECT";

export type StemFigureQuickSegmentInput = {
  segmentName: string;
};

export type StemFigureQuickSegmentIssue = {
  code:
    | "MISSING_POINT"
    | "MISSING_SEGMENT"
    | "POINT_NAME_AMBIGUOUS"
    | "POINTS_NOT_DISTINCT"
    | "SEGMENT_ALREADY_EXISTS"
    | "SEGMENT_NAME_INVALID"
    | "SOURCE_UNSUPPORTED";
  message: string;
};

export type StemFigureQuickSegmentResult = {
  action: StemFigureSegmentAction;
  canonicalSegment: string | null;
  changedCount: number;
  issue: StemFigureQuickSegmentIssue | null;
  source: string;
};

export type StemFigureMidpointAction = "ADD" | "REMOVE";

export type StemFigureQuickMidpointInput = {
  midpointName?: string;
  segmentName: string;
};

export type StemFigureQuickMidpointIssue = {
  code:
    | "MARKER_VARIANT_UNAVAILABLE"
    | "MIDPOINT_ALREADY_EXISTS"
    | "MIDPOINT_AMBIGUOUS"
    | "MIDPOINT_IN_USE"
    | "MIDPOINT_NAME_INVALID"
    | "MIDPOINT_NAME_REQUIRED"
    | "MIDPOINT_NOT_FOUND"
    | "MISSING_POINT"
    | "POINT_NAME_AMBIGUOUS"
    | "POINTS_NOT_DISTINCT"
    | "SEGMENT_NAME_INVALID"
    | "SOURCE_UNSUPPORTED";
  message: string;
};

export type StemFigureQuickMidpointResult = {
  action: StemFigureMidpointAction;
  addedSegment: boolean;
  canonicalSegment: string | null;
  changedCount: number;
  issue: StemFigureQuickMidpointIssue | null;
  markerVariant: number | null;
  midpointName: string | null;
  replacedMidpointName: string | null;
  source: string;
};

export type StemFigureQuickCircleCenterInput = {
  centerName: string;
};

export type StemFigureQuickCircleCenterIssue = {
  code:
    | "CENTER_NAME_AMBIGUOUS"
    | "CENTER_NAME_IN_USE"
    | "CENTER_NAME_INVALID"
    | "CENTER_NAME_REQUIRED"
    | "CIRCLE_CENTER_AMBIGUOUS"
    | "CIRCLE_CENTER_NAME_EXISTS"
    | "CIRCLE_NOT_FOUND"
    | "SOURCE_UNSUPPORTED";
  message: string;
};

export type StemFigureQuickCircleCenterResult = {
  centerName: string | null;
  changedCount: number;
  issue: StemFigureQuickCircleCenterIssue | null;
  replacedCenterName: string | null;
  source: string;
};

type NamedPoint = {
  name: string;
  x: number | null;
  y: number | null;
};

type CircleCenter = {
  reference: string;
  x: number | null;
  y: number | null;
};

type AnglePic = {
  degrees: number | null;
  points: [string, string, string];
};

const POINT_NAME_PATTERN = String.raw`[A-Za-z][A-Za-z0-9:_-]*`;
const NUMERIC_LITERAL_PATTERN = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)`;
const TIKZ_LENGTH_UNIT_PATTERN = String.raw`(?:pt|mm|cm|in|bp|pc|dd|cc|sp)`;
const ANGLE_RADIUS_START_CM = 0.5;
const ANGLE_RADIUS_STEP_CM = 0.05;
const CIRCLE_CENTER_BLOCK_PREFIX = "classhero-quick-circle-center";
const MIDPOINT_BLOCK_PREFIX = "classhero-quick-midpoint";
const MIDPOINT_MARK_ACTION_PALETTE = [
  String.raw`\draw[line width=0.55pt] (-2.7pt,-1.8pt) -- (2.7pt,1.8pt);`,
  String.raw`\draw[line width=0.55pt] (-3pt,-1.8pt) -- (0.4pt,1.8pt); \draw[line width=0.55pt] (-0.4pt,-1.8pt) -- (3pt,1.8pt);`,
  String.raw`\draw[line width=0.55pt] (-2.7pt,1.8pt) -- (2.7pt,-1.8pt);`,
  String.raw`\draw[line width=0.55pt] (-3pt,1.8pt) -- (0.4pt,-1.8pt); \draw[line width=0.55pt] (-0.4pt,1.8pt) -- (3pt,-1.8pt);`,
] as const;

export function createStemFigureQuickAngle(
  source: string,
  input: StemFigureQuickAngleInput,
): StemFigureQuickAngleResult {
  const base = createEmptyResult(source);
  const parsedDegrees = parseDegrees(input.degreesText);
  if (parsedDegrees === null) {
    return withIssue(
      base,
      "DEGREES_INVALID",
      "Số đo góc phải là số nguyên từ 1° đến 179°.",
    );
  }

  const points = extractNamedPoints(source);
  const parsedNames = parseAngleName(input.angleName);
  if (!parsedNames) {
    return withIssue(
      { ...base, degrees: parsedDegrees },
      "ANGLE_NAME_INVALID",
      "Nhập ba tên điểm như ABD hoặc A-B-D; chữ ở giữa là đỉnh góc.",
    );
  }

  const resolvedNames: string[] = [];
  for (const requestedName of parsedNames) {
    const matches = points.filter(
      (point) =>
        point.name.toLocaleLowerCase("en") === requestedName.toLocaleLowerCase("en"),
    );
    if (matches.length === 0) {
      return withIssue(
        { ...base, degrees: parsedDegrees },
        "MISSING_POINT",
        `Không tìm thấy điểm ${requestedName} trong mã hình.`,
      );
    }
    if (matches.length > 1) {
      return withIssue(
        { ...base, degrees: parsedDegrees },
        "POINT_NAME_AMBIGUOUS",
        `Tên điểm ${requestedName} xuất hiện không duy nhất trong mã hình.`,
      );
    }
    const matchedPoint = matches[0];
    if (!matchedPoint) continue;
    resolvedNames.push(matchedPoint.name);
  }

  const [first, vertex, third] = resolvedNames as [string, string, string];
  if (new Set(resolvedNames).size !== 3) {
    return withIssue(
      { ...base, canonicalAngle: `${first}${vertex}${third}`, degrees: parsedDegrees },
      "POINTS_NOT_DISTINCT",
      "Ba vị trí của tên góc phải là ba điểm khác nhau.",
    );
  }

  const canonicalAngle = `${first}${vertex}${third}`;
  const existingPics = extractAnglePics(source);
  const requestedGeometryKey = angleGeometryKey(first, vertex, third);
  const replacesExisting = existingPics.some(
    ({ points: picPoints }) => angleGeometryKey(...picPoints) === requestedGeometryKey,
  );
  const removedExisting = replacesExisting
    ? removeStemFigureAngleMarkerGroup(source, [first, vertex, third])
    : { changedCount: 0, source };
  if (replacesExisting && removedExisting.changedCount === 0) {
    return withIssue(
      { ...base, canonicalAngle, degrees: parsedDegrees },
      "SOURCE_UNSUPPORTED",
      `Chưa thể thay ký hiệu của góc ${canonicalAngle} an toàn; hãy sửa trực tiếp trong mã.`,
    );
  }
  const workingSource = removedExisting.source;

  const declaredSegments = extractDeclaredSegments(workingSource);
  const requiredSegments: Array<[string, string]> = [
    [first, vertex],
    [vertex, third],
  ];
  const missingSegments = requiredSegments.filter(
    ([start, end]) => !declaredSegments.has(segmentKey(start, end)),
  );
  if (!input.autoConnect && missingSegments.length > 0) {
    return withIssue(
      { ...base, canonicalAngle, degrees: parsedDegrees },
      "MISSING_SEGMENT",
      `Chưa có ${missingSegments.map(([start, end]) => `${start}${end}`).join(", ")}. Bật “Tự nối cạnh còn thiếu” để tiếp tục.`,
    );
  }

  const orientedPoints = orientAngleAsMinorSweep(points, first, vertex, third);
  if (!orientedPoints) {
    return withIssue(
      { ...base, canonicalAngle, degrees: parsedDegrees },
      "SOURCE_UNSUPPORTED",
      "Chưa xác định được tọa độ của ba điểm để vẽ đúng miền góc nhỏ. Hãy dùng tọa độ Descartes/cực dạng số hoặc sửa trực tiếp trong mã.",
    );
  }

  const markerCount = selectMarkerCount(extractAnglePics(workingSource), parsedDegrees);
  const addedSegments = input.autoConnect
    ? missingSegments.map(([start, end]) => `${start}${end}`)
    : [];
  const insertedLines = [
    ...missingSegments.map(([start, end]) =>
      createStyledSegmentLine(workingSource, start, end),
    ),
    ...createAnglePicLines(orientedPoints, parsedDegrees, markerCount),
  ];
  const nextSource = insertBeforePictureEnd(workingSource, insertedLines);
  if (!nextSource) {
    return withIssue(
      { ...base, canonicalAngle, degrees: parsedDegrees },
      "SOURCE_UNSUPPORTED",
      "Không tìm thấy phần kết thúc tikzpicture/circuitikz để thêm góc an toàn.",
    );
  }

  return {
    addedSegments,
    canonicalAngle,
    changedCount: removedExisting.changedCount + insertedLines.length,
    degrees: parsedDegrees,
    issue: null,
    markerCount,
    replacedExisting: replacesExisting,
    source: nextSource,
  };
}

export function removeStemFigureQuickAngle(
  source: string,
  input: StemFigureQuickAngleRemovalInput,
): StemFigureQuickAngleRemovalResult {
  const base: StemFigureQuickAngleRemovalResult = {
    canonicalAngle: null,
    changedCount: 0,
    issue: null,
    source,
  };
  const parsedNames = parseAngleName(input.angleName);
  if (!parsedNames) {
    return withAngleRemovalIssue(
      base,
      "ANGLE_NAME_INVALID",
      "Nhập ba tên điểm như ABD hoặc A-B-D; chữ ở giữa là đỉnh góc.",
    );
  }

  const points = extractNamedPoints(source);
  const resolvedNames: string[] = [];
  for (const requestedName of parsedNames) {
    const matches = points.filter(
      (point) =>
        point.name.toLocaleLowerCase("en") === requestedName.toLocaleLowerCase("en"),
    );
    if (matches.length === 0) {
      return withAngleRemovalIssue(
        base,
        "MISSING_POINT",
        `Không tìm thấy điểm ${requestedName} trong mã hình.`,
      );
    }
    if (matches.length > 1) {
      return withAngleRemovalIssue(
        base,
        "POINT_NAME_AMBIGUOUS",
        `Tên điểm ${requestedName} xuất hiện không duy nhất trong mã hình.`,
      );
    }
    const matchedPoint = matches[0];
    if (matchedPoint) resolvedNames.push(matchedPoint.name);
  }

  const [first, vertex, third] = resolvedNames as [string, string, string];
  const canonicalAngle = `${first}${vertex}${third}`;
  const resultBase = { ...base, canonicalAngle };
  if (new Set(resolvedNames).size !== 3) {
    return withAngleRemovalIssue(
      resultBase,
      "POINTS_NOT_DISTINCT",
      "Ba vị trí của tên góc phải là ba điểm khác nhau.",
    );
  }

  const requestedGeometryKey = angleGeometryKey(first, vertex, third);
  const existingPics = extractAnglePics(source).filter(
    ({ points: picPoints }) => angleGeometryKey(...picPoints) === requestedGeometryKey,
  );
  if (existingPics.length === 0) {
    return withAngleRemovalIssue(
      resultBase,
      "ANGLE_NOT_FOUND",
      `Góc ${canonicalAngle} chưa có số đo hoặc ký hiệu cung trong hình.`,
    );
  }

  const transformed = removeStemFigureAngleMarkerGroup(source, [first, vertex, third]);
  return transformed.changedCount > 0
    ? { ...resultBase, ...transformed }
    : withAngleRemovalIssue(
        resultBase,
        "ANGLE_NOT_FOUND",
        `Không tìm thấy nhóm ký hiệu của góc ${canonicalAngle} để xóa.`,
      );
}

export function updateStemFigureSegment(
  source: string,
  input: StemFigureQuickSegmentInput,
  action: StemFigureSegmentAction,
): StemFigureQuickSegmentResult {
  const base: StemFigureQuickSegmentResult = {
    action,
    canonicalSegment: null,
    changedCount: 0,
    issue: null,
    source,
  };
  const parsedNames = parseSegmentName(input.segmentName);
  if (!parsedNames) {
    return withSegmentIssue(
      base,
      "SEGMENT_NAME_INVALID",
      "Nhập hai tên điểm như BD hoặc B-D.",
    );
  }
  const points = extractNamedPoints(source);
  const resolvedNames: string[] = [];
  for (const requestedName of parsedNames) {
    const matches = points.filter(
      (point) =>
        point.name.toLocaleLowerCase("en") === requestedName.toLocaleLowerCase("en"),
    );
    if (matches.length === 0) {
      return withSegmentIssue(
        base,
        "MISSING_POINT",
        `Không tìm thấy điểm ${requestedName} trong mã hình.`,
      );
    }
    if (matches.length > 1) {
      return withSegmentIssue(
        base,
        "POINT_NAME_AMBIGUOUS",
        `Tên điểm ${requestedName} xuất hiện không duy nhất trong mã hình.`,
      );
    }
    const matchedPoint = matches[0];
    if (matchedPoint) resolvedNames.push(matchedPoint.name);
  }
  const [first, second] = resolvedNames as [string, string];
  const canonicalSegment = `${first}${second}`;
  const resultBase = { ...base, canonicalSegment };
  if (first === second) {
    return withSegmentIssue(
      resultBase,
      "POINTS_NOT_DISTINCT",
      "Hai đầu đoạn thẳng phải là hai điểm khác nhau.",
    );
  }

  const requestedKey = segmentKey(first, second);
  const exists = extractDeclaredSegments(source).has(requestedKey);
  if (action === "CONNECT") {
    if (exists) {
      return withSegmentIssue(
        resultBase,
        "SEGMENT_ALREADY_EXISTS",
        `Đoạn ${canonicalSegment} đã được nối trong hình.`,
      );
    }
    const nextSource = insertBeforePictureEnd(source, [
      createStyledSegmentLine(source, first, second),
    ]);
    return nextSource
      ? { ...resultBase, changedCount: 1, source: nextSource }
      : withSegmentIssue(
          resultBase,
          "SOURCE_UNSUPPORTED",
          "Không tìm thấy phần kết thúc tikzpicture/circuitikz để nối đoạn an toàn.",
        );
  }

  if (!exists) {
    return withSegmentIssue(
      resultBase,
      "MISSING_SEGMENT",
      `Đoạn ${canonicalSegment} hiện chưa được nối trong hình.`,
    );
  }
  const removal = removeStraightSegment(source, first, second);
  return removal.changedCount > 0
    ? { ...resultBase, changedCount: removal.changedCount, source: removal.source }
    : withSegmentIssue(
        resultBase,
        "SOURCE_UNSUPPORTED",
        `Đoạn ${canonicalSegment} đang nằm trong lệnh vẽ phức tạp; hãy bỏ nối trực tiếp trong mã.`,
      );
}

export function updateStemFigureMidpoint(
  source: string,
  input: StemFigureQuickMidpointInput,
  action: StemFigureMidpointAction,
): StemFigureQuickMidpointResult {
  const base: StemFigureQuickMidpointResult = {
    action,
    addedSegment: false,
    canonicalSegment: null,
    changedCount: 0,
    issue: null,
    markerVariant: null,
    midpointName: null,
    replacedMidpointName: null,
    source,
  };
  const parsedSegment = parseSegmentName(input.segmentName);
  if (!parsedSegment) {
    return withMidpointIssue(
      base,
      "SEGMENT_NAME_INVALID",
      "Nhập hai tên điểm như AB hoặc A-B.",
    );
  }

  const points = extractNamedPoints(source);
  const resolvedNames: string[] = [];
  for (const requestedName of parsedSegment) {
    const matches = points.filter(
      (point) =>
        point.name.toLocaleLowerCase("en") === requestedName.toLocaleLowerCase("en"),
    );
    if (matches.length === 0) {
      return withMidpointIssue(
        base,
        "MISSING_POINT",
        `Không tìm thấy điểm ${requestedName} trong mã hình.`,
      );
    }
    if (matches.length > 1) {
      return withMidpointIssue(
        base,
        "POINT_NAME_AMBIGUOUS",
        `Tên điểm ${requestedName} xuất hiện không duy nhất trong mã hình.`,
      );
    }
    const matchedPoint = matches[0];
    if (matchedPoint) resolvedNames.push(matchedPoint.name);
  }

  const [first, second] = resolvedNames as [string, string];
  const canonicalSegment = `${first}${second}`;
  const resultBase = { ...base, canonicalSegment };
  if (first === second) {
    return withMidpointIssue(
      resultBase,
      "POINTS_NOT_DISTINCT",
      "Hai đầu đoạn thẳng phải là hai điểm khác nhau.",
    );
  }

  const ownedBlocks = extractOwnedMidpointBlocks(source).filter(
    (block) => segmentKey(block.first, block.second) === segmentKey(first, second),
  );
  if (action === "REMOVE") {
    if (ownedBlocks.length === 0) {
      return withMidpointIssue(
        resultBase,
        "MIDPOINT_NOT_FOUND",
        `Không tìm thấy trung điểm do Chỉnh nhanh tạo trên đoạn ${canonicalSegment}.`,
      );
    }
    if (ownedBlocks.length > 1) {
      return withMidpointIssue(
        resultBase,
        "MIDPOINT_AMBIGUOUS",
        `Đoạn ${canonicalSegment} có nhiều trung điểm được quản lý; hãy sửa trực tiếp trong mã để tránh xóa nhầm.`,
      );
    }
    const block = ownedBlocks[0];
    if (!block) return resultBase;
    if (hasExternalMidpointReferences(source, block)) {
      return withMidpointIssue(
        { ...resultBase, midpointName: block.midpoint, markerVariant: block.variant },
        "MIDPOINT_IN_USE",
        `Điểm ${block.midpoint} còn được dùng ngoài nhóm trung điểm ${canonicalSegment}; chưa xóa để tránh làm hỏng hình.`,
      );
    }
    return {
      ...resultBase,
      changedCount: 1,
      markerVariant: block.variant,
      midpointName: block.midpoint,
      source: `${source.slice(0, block.start)}${source.slice(block.end)}`.replace(
        /\n{3,}/gu,
        "\n\n",
      ),
    };
  }

  const requestedMidpoint = (input.midpointName?.trim() ?? "").toLocaleUpperCase("en");
  if (!requestedMidpoint) {
    return withMidpointIssue(
      resultBase,
      "MIDPOINT_NAME_REQUIRED",
      "Nhập tên trung điểm cần thêm, ví dụ M.",
    );
  }
  if (!isPointName(requestedMidpoint)) {
    return withMidpointIssue(
      resultBase,
      "MIDPOINT_NAME_INVALID",
      "Tên trung điểm phải bắt đầu bằng chữ và chỉ gồm chữ, số, dấu :, _ hoặc -.",
    );
  }
  if (
    [first, second].some(
      (name) =>
        name.toLocaleLowerCase("en") === requestedMidpoint.toLocaleLowerCase("en"),
    )
  ) {
    return withMidpointIssue(
      { ...resultBase, midpointName: requestedMidpoint },
      "POINTS_NOT_DISTINCT",
      "Tên trung điểm phải khác hai đầu đoạn thẳng.",
    );
  }
  if (
    points.some(
      (point) =>
        point.name.toLocaleLowerCase("en") === requestedMidpoint.toLocaleLowerCase("en"),
    )
  ) {
    return withMidpointIssue(
      { ...resultBase, midpointName: requestedMidpoint },
      "MIDPOINT_ALREADY_EXISTS",
      `Tên điểm ${requestedMidpoint} đã tồn tại trong hình.`,
    );
  }
  if (ownedBlocks.length > 1) {
    return withMidpointIssue(
      { ...resultBase, midpointName: requestedMidpoint },
      "MIDPOINT_AMBIGUOUS",
      `Đoạn ${canonicalSegment} có nhiều trung điểm được quản lý; hãy sửa trực tiếp trong mã để tránh ghi đè nhầm.`,
    );
  }
  const replacedBlock = ownedBlocks[0] ?? null;
  if (replacedBlock && hasExternalMidpointReferences(source, replacedBlock)) {
    return withMidpointIssue(
      {
        ...resultBase,
        markerVariant: replacedBlock.variant,
        midpointName: requestedMidpoint,
        replacedMidpointName: replacedBlock.midpoint,
      },
      "MIDPOINT_IN_USE",
      `Điểm ${replacedBlock.midpoint} còn được dùng ngoài nhóm trung điểm ${canonicalSegment}; chưa ghi đè để tránh làm hỏng hình.`,
    );
  }
  if (!replacedBlock && hasCalculatedMidpointForSegment(source, first, second)) {
    return withMidpointIssue(
      { ...resultBase, midpointName: requestedMidpoint },
      "MIDPOINT_ALREADY_EXISTS",
      `Đoạn ${canonicalSegment} đã có trung điểm không do Chỉnh nhanh quản lý; hãy sửa trực tiếp trong mã để tránh ghi đè nhầm.`,
    );
  }

  const markerVariant = replacedBlock?.variant ?? selectMidpointMarkerVariant(source);
  if (markerVariant === null) {
    return withMidpointIssue(
      { ...resultBase, midpointName: requestedMidpoint },
      "MARKER_VARIANT_UNAVAILABLE",
      "Hình đã dùng hết bốn kiểu marker trung điểm an toàn; hãy chỉnh marker trực tiếp trong mã.",
    );
  }
  const markerAction = MIDPOINT_MARK_ACTION_PALETTE[markerVariant - 1];
  if (!markerAction) return resultBase;

  const segmentExists = extractDeclaredSegments(source).has(segmentKey(first, second));
  const pointLabelFontOption = inferPointLabelFontOption(source);
  const midpointNodeOptions = ["midway", "auto", "inner sep=4pt", pointLabelFontOption]
    .filter((option): option is string => Boolean(option))
    .join(", ");
  const midpointLines = [
    `  % ${MIDPOINT_BLOCK_PREFIX}:start midpoint=${requestedMidpoint} first=${first} second=${second} variant=${markerVariant}`,
    `  \\coordinate (${requestedMidpoint}) at ($(${first})!0.5!(${second})$);`,
    `  \\fill[solid] (${requestedMidpoint}) circle (1.2pt);`,
    `  \\path (${first}) -- node[${midpointNodeOptions}] {$${requestedMidpoint}$} (${second});`,
    `  \\path[decoration={markings, mark=at position .25 with {${markerAction}}, mark=at position .75 with {${markerAction}}}, postaction={decorate}] (${first}) -- (${second});`,
    `  % ${MIDPOINT_BLOCK_PREFIX}:end`,
  ];
  const inserted = replacedBlock
    ? `${source.slice(0, replacedBlock.start)}${midpointLines.join("\n")}\n${source.slice(replacedBlock.end)}`
    : insertBeforePictureEnd(source, [
        ...(segmentExists ? [] : [createStyledSegmentLine(source, first, second)]),
        ...midpointLines,
      ]);
  if (!inserted) {
    return withMidpointIssue(
      { ...resultBase, midpointName: requestedMidpoint, markerVariant },
      "SOURCE_UNSUPPORTED",
      "Không tìm thấy phần kết thúc tikzpicture/circuitikz để thêm trung điểm an toàn.",
    );
  }
  const withLibraries = ensureTikzLibraries(inserted, ["calc", "decorations.markings"]);
  if (!withLibraries) {
    return withMidpointIssue(
      { ...resultBase, midpointName: requestedMidpoint, markerVariant },
      "SOURCE_UNSUPPORTED",
      "Không tìm thấy môi trường hình để bổ sung thư viện TikZ cần thiết.",
    );
  }
  return {
    ...resultBase,
    addedSegment: !segmentExists,
    changedCount: midpointLines.length + (segmentExists ? 0 : 1),
    markerVariant,
    midpointName: requestedMidpoint,
    replacedMidpointName: replacedBlock?.midpoint ?? null,
    source: withLibraries,
  };
}

export function addStemFigureCircleCenterLabel(
  source: string,
  input: StemFigureQuickCircleCenterInput,
): StemFigureQuickCircleCenterResult {
  const base: StemFigureQuickCircleCenterResult = {
    centerName: null,
    changedCount: 0,
    issue: null,
    replacedCenterName: null,
    source,
  };
  const centerName = input.centerName.trim().toLocaleUpperCase("en");
  if (!centerName) {
    return withCircleCenterIssue(
      base,
      "CENTER_NAME_REQUIRED",
      "Nhập tên cần đặt cho tâm đường tròn, ví dụ O.",
    );
  }
  if (!isPointName(centerName)) {
    return withCircleCenterIssue(
      { ...base, centerName },
      "CENTER_NAME_INVALID",
      "Tên tâm phải bắt đầu bằng chữ và chỉ gồm chữ, số, dấu :, _ hoặc -.",
    );
  }

  const ownedBlocks = extractOwnedCircleCenterBlocks(source);
  if (ownedBlocks.length > 1) {
    return withCircleCenterIssue(
      { ...base, centerName },
      "CENTER_NAME_AMBIGUOUS",
      "Hình có nhiều nhãn tâm do Chỉnh nhanh quản lý; hãy sửa trực tiếp trong mã.",
    );
  }
  const replacedBlock = ownedBlocks[0] ?? null;
  if (replacedBlock && hasExternalCircleCenterReferences(source, replacedBlock)) {
    return withCircleCenterIssue(
      {
        ...base,
        centerName,
        replacedCenterName: replacedBlock.centerName,
      },
      "CENTER_NAME_IN_USE",
      `Điểm ${replacedBlock.centerName} đang được hình học khác sử dụng nên chưa thể đổi tên an toàn.`,
    );
  }
  const sourceWithoutManagedLabel = replacedBlock
    ? `${source.slice(0, replacedBlock.start)}${source.slice(replacedBlock.end)}`.replace(
        /\n{3,}/gu,
        "\n\n",
      )
    : source;
  const circleCenters = extractSimpleCircleCenters(sourceWithoutManagedLabel);
  if (circleCenters.length === 0) {
    return withCircleCenterIssue(
      { ...base, centerName },
      "CIRCLE_NOT_FOUND",
      "Không tìm thấy một đường tròn đơn có tâm xác định trong mã hình.",
    );
  }
  if (circleCenters.length > 1) {
    return withCircleCenterIssue(
      { ...base, centerName },
      "CIRCLE_CENTER_AMBIGUOUS",
      "Hình có nhiều tâm đường tròn khác nhau; hãy đặt tên tâm trực tiếp trong mã để tránh chọn nhầm.",
    );
  }

  const circleCenter = circleCenters[0];
  if (!circleCenter) return base;
  const matchingPoints = extractNamedPoints(sourceWithoutManagedLabel).filter(
    (point) => point.name.toLocaleLowerCase("en") === centerName.toLocaleLowerCase("en"),
  );
  if (matchingPoints.length > 1) {
    return withCircleCenterIssue(
      { ...base, centerName },
      "CENTER_NAME_AMBIGUOUS",
      `Tên điểm ${centerName} xuất hiện không duy nhất trong mã hình.`,
    );
  }
  const existingPoint = matchingPoints[0] ?? null;
  if (existingPoint && !pointsSharePosition(existingPoint, circleCenter)) {
    return withCircleCenterIssue(
      { ...base, centerName },
      "CIRCLE_CENTER_NAME_EXISTS",
      `Tên điểm ${centerName} đã được dùng cho một vị trí khác trong hình.`,
    );
  }

  const pointLabelFontOption = inferPointLabelFontOption(sourceWithoutManagedLabel);
  const labelOptions = ["above right=4pt", "inner sep=2pt", pointLabelFontOption]
    .filter((option): option is string => Boolean(option))
    .join(", ");
  const needsCoordinate = !existingPoint;
  const centerTarget = existingPoint?.name ?? centerName;
  const lines = [
    `  % ${CIRCLE_CENTER_BLOCK_PREFIX}:start name=${centerName}`,
    ...(needsCoordinate
      ? [`  \\coordinate (${centerName}) at ${circleCenter.reference};`]
      : []),
    `  \\node[${labelOptions}] at (${centerTarget}) {$${centerName}$};`,
    `  % ${CIRCLE_CENTER_BLOCK_PREFIX}:end`,
  ];
  const nextSource = insertBeforePictureEnd(sourceWithoutManagedLabel, lines);
  if (!nextSource) {
    return withCircleCenterIssue(
      { ...base, centerName },
      "SOURCE_UNSUPPORTED",
      "Không tìm thấy phần kết thúc tikzpicture/circuitikz để thêm tên tâm an toàn.",
    );
  }
  return {
    centerName,
    changedCount: lines.length + (replacedBlock ? 1 : 0),
    issue: null,
    replacedCenterName: replacedBlock?.centerName ?? null,
    source: nextSource,
  };
}

function createEmptyResult(source: string): StemFigureQuickAngleResult {
  return {
    addedSegments: [],
    canonicalAngle: null,
    changedCount: 0,
    degrees: null,
    issue: null,
    markerCount: null,
    replacedExisting: false,
    source,
  };
}

function withIssue(
  result: StemFigureQuickAngleResult,
  code: StemFigureQuickAngleIssueCode,
  message: string,
): StemFigureQuickAngleResult {
  return { ...result, issue: { code, message } };
}

function withSegmentIssue(
  result: StemFigureQuickSegmentResult,
  code: StemFigureQuickSegmentIssue["code"],
  message: string,
): StemFigureQuickSegmentResult {
  return { ...result, issue: { code, message } };
}

function withAngleRemovalIssue(
  result: StemFigureQuickAngleRemovalResult,
  code: StemFigureQuickAngleRemovalIssue["code"],
  message: string,
): StemFigureQuickAngleRemovalResult {
  return { ...result, issue: { code, message } };
}

function withMidpointIssue(
  result: StemFigureQuickMidpointResult,
  code: StemFigureQuickMidpointIssue["code"],
  message: string,
): StemFigureQuickMidpointResult {
  return { ...result, issue: { code, message } };
}

function withCircleCenterIssue(
  result: StemFigureQuickCircleCenterResult,
  code: StemFigureQuickCircleCenterIssue["code"],
  message: string,
): StemFigureQuickCircleCenterResult {
  return { ...result, issue: { code, message } };
}

function parseDegrees(value: string) {
  const normalized = value
    .trim()
    .replace(/\$/gu, "")
    .replace(/\^?\s*\{?\\circ\}?/giu, "")
    .replace(/°/gu, "")
    .trim();
  if (!/^\d{1,3}$/u.test(normalized)) return null;
  const degrees = Number(normalized);
  return Number.isInteger(degrees) && degrees >= 1 && degrees <= 179 ? degrees : null;
}

function parseAngleName(value: string): [string, string, string] | null {
  const normalized = value.trim().replace(/^∠\s*/u, "");
  const delimited = normalized.split(/\s*[-–—,]\s*/u).filter(Boolean);
  if (delimited.length === 3 && delimited.every(isPointName)) {
    return delimited as [string, string, string];
  }
  const compact = normalized.replace(/\s+/gu, "");
  if (/^[A-Za-z]{3}$/u.test(compact)) {
    return compact.split("") as [string, string, string];
  }
  return null;
}

function parseSegmentName(value: string): [string, string] | null {
  const normalized = value.trim();
  const delimited = normalized.split(/\s*[-–—,]\s*/u).filter(Boolean);
  if (delimited.length === 2 && delimited.every(isPointName)) {
    return delimited as [string, string];
  }
  const compact = normalized.replace(/\s+/gu, "");
  return /^[A-Za-z]{2}$/u.test(compact) ? (compact.split("") as [string, string]) : null;
}

function isPointName(value: string) {
  return new RegExp(`^${POINT_NAME_PATTERN}$`, "u").test(value);
}

function extractNamedPoints(source: string): NamedPoint[] {
  const masked = maskComments(source);
  const found = new Map<string, NamedPoint>();
  const declarationPattern = new RegExp(
    String.raw`(?:\\coordinate\b|\\node\b)[^;\n]*?\(\s*(${POINT_NAME_PATTERN})\s*\)[^;\n]*?\bat\s*\(\s*(${NUMERIC_LITERAL_PATTERN})\s*(${TIKZ_LENGTH_UNIT_PATTERN})?\s*,\s*(${NUMERIC_LITERAL_PATTERN})\s*(${TIKZ_LENGTH_UNIT_PATTERN})?\s*\)`,
    "gu",
  );
  for (const match of masked.matchAll(declarationPattern)) {
    const [, name, x, xUnit, y, yUnit] = match;
    if (!name || x === undefined || y === undefined) continue;
    found.set(name, {
      name,
      x: parseTikzLiteralLength(x, xUnit),
      y: parseTikzLiteralLength(y, yUnit),
    });
  }

  const polarDeclarationPattern = new RegExp(
    String.raw`(?:\\coordinate\b|\\node\b)[^;\n]*?\(\s*(${POINT_NAME_PATTERN})\s*\)[^;\n]*?\bat\s*\(\s*(${NUMERIC_LITERAL_PATTERN})\s*:\s*(${NUMERIC_LITERAL_PATTERN})\s*(${TIKZ_LENGTH_UNIT_PATTERN})?\s*\)`,
    "gu",
  );
  for (const match of masked.matchAll(polarDeclarationPattern)) {
    const [, name, degreesText, radiusText, radiusUnit] = match;
    if (!name || degreesText === undefined || radiusText === undefined) continue;
    const radians = (Number(degreesText) * Math.PI) / 180;
    const radius = parseTikzLiteralLength(radiusText, radiusUnit);
    found.set(name, {
      name,
      x: radius * Math.cos(radians),
      y: radius * Math.sin(radians),
    });
  }

  const relativePolarDeclarations = [
    ...masked.matchAll(
      new RegExp(
        String.raw`(?:\\coordinate\b|\\node\b)[^;\n]*?\(\s*(${POINT_NAME_PATTERN})\s*\)[^;\n]*?\bat\s*\(\s*\$\s*\(\s*(${POINT_NAME_PATTERN})\s*\)\s*\+\s*\(\s*(${NUMERIC_LITERAL_PATTERN})\s*:\s*(${NUMERIC_LITERAL_PATTERN})\s*(${TIKZ_LENGTH_UNIT_PATTERN})?\s*\)\s*\$\s*\)`,
        "gu",
      ),
    ),
  ];
  for (let pass = 0; pass < relativePolarDeclarations.length; pass += 1) {
    let resolvedInPass = false;
    for (const match of relativePolarDeclarations) {
      const [, name, originName, degreesText, radiusText, radiusUnit] = match;
      if (
        !name ||
        !originName ||
        degreesText === undefined ||
        radiusText === undefined ||
        found.has(name)
      ) {
        continue;
      }
      const origin = found.get(originName);
      if (!origin || origin.x === null || origin.y === null) continue;
      const radians = (Number(degreesText) * Math.PI) / 180;
      const radius = parseTikzLiteralLength(radiusText, radiusUnit);
      found.set(name, {
        name,
        x: origin.x + radius * Math.cos(radians),
        y: origin.y + radius * Math.sin(radians),
      });
      resolvedInPass = true;
    }
    if (!resolvedInPass) break;
  }

  const coordinateNamePattern = new RegExp(
    String.raw`\\coordinate\b[^;\n]*?\(\s*(${POINT_NAME_PATTERN})\s*\)`,
    "gu",
  );
  for (const match of masked.matchAll(coordinateNamePattern)) {
    const name = match[1];
    if (name && !found.has(name)) found.set(name, { name, x: null, y: null });
  }

  const namedNodePattern = new RegExp(
    String.raw`\\node\b[^;\n]*?\(\s*(${POINT_NAME_PATTERN})\s*\)[^;\n]*?\bat\b`,
    "gu",
  );
  for (const match of masked.matchAll(namedNodePattern)) {
    const name = match[1];
    if (name && !found.has(name)) found.set(name, { name, x: null, y: null });
  }
  return [...found.values()];
}

function extractSimpleCircleCenters(source: string): CircleCenter[] {
  const masked = maskComments(source);
  const namedPoints = extractNamedPoints(source);
  const centers = new Map<string, CircleCenter>();
  for (const match of masked.matchAll(/\\draw\b/gu)) {
    const start = match.index;
    if (start === undefined) continue;
    const end = findTikzCommandEnd(masked, start);
    if (end === null) continue;
    let bodyStart = skipWhitespace(masked, start + "\\draw".length);
    if (masked[bodyStart] === "[") {
      const optionEnd = findBalancedEnd(masked, bodyStart, "[", "]");
      if (optionEnd === null) continue;
      bodyStart = skipWhitespace(masked, optionEnd + 1);
    }
    const commandBody = source.slice(bodyStart, end - 1);
    const centerMatch = commandBody.match(/^\s*(\([^()]+\))\s*circle\b/u);
    const reference = centerMatch?.[1]?.trim();
    if (!reference) continue;
    const center = parseCircleCenterReference(reference, namedPoints);
    if (!center) continue;
    centers.set(circleCenterKey(center), center);
  }
  return [...centers.values()];
}

function parseCircleCenterReference(
  reference: string,
  namedPoints: NamedPoint[],
): CircleCenter | null {
  const content = reference.slice(1, -1).trim();
  if (isPointName(content)) {
    const point = namedPoints.find((candidate) => candidate.name === content);
    return {
      reference,
      x: point?.x ?? null,
      y: point?.y ?? null,
    };
  }
  const cartesianMatch = content.match(
    new RegExp(
      String.raw`^\s*(${NUMERIC_LITERAL_PATTERN})\s*(${TIKZ_LENGTH_UNIT_PATTERN})?\s*,\s*(${NUMERIC_LITERAL_PATTERN})\s*(${TIKZ_LENGTH_UNIT_PATTERN})?\s*$`,
      "u",
    ),
  );
  if (cartesianMatch) {
    const [, x, xUnit, y, yUnit] = cartesianMatch;
    if (x !== undefined && y !== undefined) {
      return {
        reference,
        x: parseTikzLiteralLength(x, xUnit),
        y: parseTikzLiteralLength(y, yUnit),
      };
    }
  }
  const polarMatch = content.match(
    new RegExp(
      String.raw`^\s*(${NUMERIC_LITERAL_PATTERN})\s*:\s*(${NUMERIC_LITERAL_PATTERN})\s*(${TIKZ_LENGTH_UNIT_PATTERN})?\s*$`,
      "u",
    ),
  );
  if (!polarMatch) return null;
  const [, degreesText, radiusText, radiusUnit] = polarMatch;
  if (degreesText === undefined || radiusText === undefined) return null;
  const radians = (Number(degreesText) * Math.PI) / 180;
  const radius = parseTikzLiteralLength(radiusText, radiusUnit);
  return {
    reference,
    x: radius * Math.cos(radians),
    y: radius * Math.sin(radians),
  };
}

function circleCenterKey(center: CircleCenter) {
  return center.x !== null && center.y !== null
    ? `${center.x.toFixed(6)}\u0000${center.y.toFixed(6)}`
    : center.reference.replace(/\s+/gu, "").toLocaleLowerCase("en");
}

function pointsSharePosition(point: NamedPoint, center: CircleCenter) {
  if (point.x === null || point.y === null || center.x === null || center.y === null) {
    const namedReference = center.reference.match(
      new RegExp(String.raw`^\(\s*(${POINT_NAME_PATTERN})\s*\)$`, "u"),
    )?.[1];
    return namedReference === point.name;
  }
  return Math.hypot(point.x - center.x, point.y - center.y) < 0.001;
}

function parseTikzLiteralLength(value: string, unit?: string) {
  const defaultFactorInTexPoints = 72.27 / 2.54;
  const factorsInTexPoints: Record<string, number> = {
    bp: 72.27 / 72,
    cc: (12 * 1238) / 1157,
    cm: defaultFactorInTexPoints,
    dd: 1238 / 1157,
    in: 72.27,
    mm: 72.27 / 25.4,
    pc: 12,
    pt: 1,
    sp: 1 / 65536,
  };
  const normalizedUnit = unit?.toLocaleLowerCase("en") ?? "cm";
  return Number(value) * (factorsInTexPoints[normalizedUnit] ?? defaultFactorInTexPoints);
}

function createStyledSegmentLine(source: string, first: string, second: string) {
  const thicknessOption = inferSegmentThicknessOption(source);
  const options = thicknessOption ? `[${thicknessOption}]` : "";
  return `  \\draw${options} (${first}) -- (${second});`;
}

function inferSegmentThicknessOption(source: string) {
  const votes = new Map<string, number>();
  for (const path of parseStraightDrawPaths(source)) {
    const optionMatch = path.prefix.match(/^\\draw\s*(?:\[([\s\S]*)\])?\s*$/u);
    if (!optionMatch) continue;
    const thickness = splitTikzOptions(optionMatch[1] ?? "").find((option) =>
      /^(?:ultra\s+thin|very\s+thin|thin|semithick|thick|very\s+thick|ultra\s+thick|line\s+width\s*=)/iu.test(
        option,
      ),
    );
    const key = thickness?.trim() ?? "";
    const edgeCount = path.cycle ? path.points.length : path.points.length - 1;
    votes.set(key, (votes.get(key) ?? 0) + edgeCount);
  }
  if (votes.size === 0) return "solid";
  return [...votes.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
}

function inferPointLabelFontOption(source: string) {
  const masked = maskComments(source);
  const votes = new Map<string, number>();
  for (const match of masked.matchAll(/\\node\b/gu)) {
    const start = match.index;
    if (start === undefined) continue;
    const end = findTikzCommandEnd(masked, start);
    if (end === null) continue;
    const command = source.slice(start, end);
    const optionStart = command.indexOf("[");
    if (optionStart < 0) continue;
    const optionEnd = findBalancedEnd(command, optionStart, "[", "]");
    if (optionEnd === null) continue;
    const body = command.slice(optionEnd + 1);
    const pointLabel = body.match(
      new RegExp(
        String.raw`\bat\s*\(\s*(${POINT_NAME_PATTERN})\s*\)\s*\{\s*\$\s*\1\s*\$\s*\}\s*;\s*$`,
        "u",
      ),
    );
    if (!pointLabel) continue;
    const fontOption = splitTikzOptions(command.slice(optionStart + 1, optionEnd)).find(
      (option) => /^font\s*=/iu.test(option),
    );
    if (!fontOption) continue;
    const normalized = fontOption.trim();
    votes.set(normalized, (votes.get(normalized) ?? 0) + 1);
  }
  return [...votes.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function splitTikzOptions(value: string) {
  const options: string[] = [];
  let start = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenthesisDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const token = value[index];
    if (token === "\\") {
      index += 1;
      continue;
    }
    if (token === "{") braceDepth += 1;
    else if (token === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (token === "[") bracketDepth += 1;
    else if (token === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (token === "(") parenthesisDepth += 1;
    else if (token === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    else if (
      token === "," &&
      braceDepth === 0 &&
      bracketDepth === 0 &&
      parenthesisDepth === 0
    ) {
      options.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  options.push(value.slice(start).trim());
  return options.filter(Boolean);
}

function extractDeclaredSegments(source: string) {
  const masked = maskComments(source);
  const result = new Set<string>();
  const segmentPattern = new RegExp(
    String.raw`(?=\(\s*(${POINT_NAME_PATTERN})\s*\)\s*--\s*\(\s*(${POINT_NAME_PATTERN})\s*\))`,
    "gu",
  );
  for (const match of masked.matchAll(segmentPattern)) {
    const [, first, second] = match;
    if (first && second) result.add(segmentKey(first, second));
  }
  const decoratedSegmentPattern = new RegExp(
    String.raw`(?=\(\s*(${POINT_NAME_PATTERN})\s*\)\s*--\s*node(?:\s*\[[^\]]*\])?\s*\{[^{}]*\}\s*\(\s*(${POINT_NAME_PATTERN})\s*\))`,
    "gu",
  );
  for (const match of masked.matchAll(decoratedSegmentPattern)) {
    const [, first, second] = match;
    if (first && second) result.add(segmentKey(first, second));
  }
  for (const path of parseStraightDrawPaths(source).filter(({ cycle }) => cycle)) {
    const first = path.points[0];
    const last = path.points.at(-1);
    if (first && last) result.add(segmentKey(first, last));
  }
  return result;
}

type OwnedMidpointBlock = {
  end: number;
  first: string;
  midpoint: string;
  second: string;
  start: number;
  variant: number;
};

type OwnedCircleCenterBlock = {
  centerName: string;
  end: number;
  start: number;
};

function extractOwnedCircleCenterBlocks(source: string): OwnedCircleCenterBlock[] {
  const blocks: OwnedCircleCenterBlock[] = [];
  const startPattern = new RegExp(
    String.raw`^[\t ]*%[\t ]*${CIRCLE_CENTER_BLOCK_PREFIX}:start[\t ]+name=(${POINT_NAME_PATTERN})[\t ]*(?:\r?\n|$)`,
    "gmu",
  );
  const endPattern = new RegExp(
    String.raw`^[\t ]*%[\t ]*${CIRCLE_CENTER_BLOCK_PREFIX}:end[\t ]*(?:\r?\n|$)`,
    "mu",
  );
  for (const match of source.matchAll(startPattern)) {
    const start = match.index;
    const centerName = match[1];
    if (start === undefined || !centerName) continue;
    const remainder = source.slice(start + match[0].length);
    const endMatch = remainder.match(endPattern);
    if (endMatch?.index === undefined) continue;
    blocks.push({
      centerName,
      end: start + match[0].length + endMatch.index + endMatch[0].length,
      start,
    });
  }
  return blocks;
}

function hasExternalCircleCenterReferences(
  source: string,
  block: OwnedCircleCenterBlock,
) {
  const outsideBlock = `${source.slice(0, block.start)}${source.slice(block.end)}`;
  return new RegExp(String.raw`\(\s*${escapeRegExp(block.centerName)}\s*\)`, "u").test(
    maskComments(outsideBlock),
  );
}

function extractOwnedMidpointBlocks(source: string): OwnedMidpointBlock[] {
  const blocks: OwnedMidpointBlock[] = [];
  const startPattern = new RegExp(
    String.raw`^[\t ]*%[\t ]*${MIDPOINT_BLOCK_PREFIX}:start[\t ]+midpoint=(${POINT_NAME_PATTERN})[\t ]+first=(${POINT_NAME_PATTERN})[\t ]+second=(${POINT_NAME_PATTERN})[\t ]+variant=([1-4])[\t ]*(?:\r?\n|$)`,
    "gmu",
  );
  const endPattern = new RegExp(
    String.raw`^[\t ]*%[\t ]*${MIDPOINT_BLOCK_PREFIX}:end[\t ]*(?:\r?\n|$)`,
    "mu",
  );
  for (const match of source.matchAll(startPattern)) {
    const start = match.index;
    const midpoint = match[1];
    const first = match[2];
    const second = match[3];
    const variant = Number(match[4]);
    if (
      start === undefined ||
      !midpoint ||
      !first ||
      !second ||
      !Number.isInteger(variant)
    ) {
      continue;
    }
    const remainder = source.slice(start + match[0].length);
    const endMatch = remainder.match(endPattern);
    if (endMatch?.index === undefined) continue;
    blocks.push({
      end: start + match[0].length + endMatch.index + endMatch[0].length,
      first,
      midpoint,
      second,
      start,
      variant,
    });
  }
  return blocks;
}

function hasExternalMidpointReferences(source: string, block: OwnedMidpointBlock) {
  const outsideBlock = `${source.slice(0, block.start)}${source.slice(block.end)}`;
  const referencePattern = new RegExp(
    String.raw`\(\s*${escapeRegExp(block.midpoint)}\s*\)`,
    "u",
  );
  return referencePattern.test(maskComments(outsideBlock));
}

function hasCalculatedMidpointForSegment(source: string, first: string, second: string) {
  const masked = maskComments(source);
  const escapedFirst = escapeRegExp(first);
  const escapedSecond = escapeRegExp(second);
  const midpointPattern = (start: string, end: string) =>
    new RegExp(
      String.raw`\\coordinate\s*\(\s*${POINT_NAME_PATTERN}\s*\)\s*at\s*\(\s*\$\s*\(\s*${start}\s*\)\s*!\s*0?\.5(?:0*)?\s*!\s*\(\s*${end}\s*\)\s*\$\s*\)\s*;`,
      "u",
    );
  return (
    midpointPattern(escapedFirst, escapedSecond).test(masked) ||
    midpointPattern(escapedSecond, escapedFirst).test(masked)
  );
}

function selectMidpointMarkerVariant(source: string) {
  const used = new Set(extractOwnedMidpointBlocks(source).map((block) => block.variant));
  const normalizedSource = normalizeWhitespace(maskComments(source));
  MIDPOINT_MARK_ACTION_PALETTE.forEach((action, index) => {
    if (normalizedSource.includes(normalizeWhitespace(action))) used.add(index + 1);
  });
  const availableIndex = MIDPOINT_MARK_ACTION_PALETTE.findIndex(
    (_, index) => !used.has(index + 1),
  );
  return availableIndex < 0 ? null : availableIndex + 1;
}

function ensureTikzLibraries(source: string, requiredLibraries: string[]) {
  const masked = maskComments(source);
  const available = new Set<string>();
  for (const match of masked.matchAll(/\\usetikzlibrary\s*\{([^}]*)\}/gu)) {
    for (const library of (match[1] ?? "").split(",")) {
      const normalized = library.trim();
      if (normalized) available.add(normalized);
    }
  }
  const missing = requiredLibraries.filter((library) => !available.has(library));
  if (missing.length === 0) return source;
  const pictureStart = masked.search(/\\begin\{(?:tikzpicture|circuitikz)\}/u);
  if (pictureStart < 0) return null;
  const prefix = source.slice(0, pictureStart);
  const separator = prefix.length === 0 || prefix.endsWith("\n") ? "" : "\n";
  return `${prefix}${separator}\\usetikzlibrary{${missing.join(",")}}\n${source.slice(pictureStart)}`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

type StraightDrawPath = {
  cycle: boolean;
  end: number;
  points: string[];
  prefix: string;
  start: number;
};

function removeStraightSegment(source: string, first: string, second: string) {
  const targetKey = segmentKey(first, second);
  const replacements: Array<{ end: number; start: number; value: string }> = [];
  let changedCount = 0;

  for (const path of parseStraightDrawPaths(source)) {
    const edgeCount = path.cycle ? path.points.length : path.points.length - 1;
    const matchingEdgeIndexes = Array.from(
      { length: edgeCount },
      (_, index) => index,
    ).filter((index) => {
      const edgeStart = path.points[index];
      const edgeEnd = path.points[(index + 1) % path.points.length];
      return Boolean(
        edgeStart && edgeEnd && segmentKey(edgeStart, edgeEnd) === targetKey,
      );
    });
    if (matchingEdgeIndexes.length === 0) continue;

    const rewritten = rewriteStraightDrawPath(source, path, matchingEdgeIndexes);
    if (rewritten === null) continue;
    changedCount += matchingEdgeIndexes.length;
    const range = rewritten
      ? { end: path.end, start: path.start }
      : resolveWholeCommandRemovalRange(source, path.start, path.end);
    replacements.push({ ...range, value: rewritten });
  }

  return {
    changedCount,
    source: applySourceReplacements(source, replacements),
  };
}

function parseStraightDrawPaths(source: string): StraightDrawPath[] {
  const masked = maskComments(source);
  const paths: StraightDrawPath[] = [];
  for (const match of masked.matchAll(/\\draw\b/gu)) {
    const start = match.index;
    if (start === undefined) continue;
    const end = findTikzCommandEnd(masked, start);
    if (end === null) continue;
    let bodyStart = skipWhitespace(masked, start + "\\draw".length);
    if (masked[bodyStart] === "[") {
      const optionEnd = findBalancedEnd(masked, bodyStart, "[", "]");
      if (optionEnd === null) continue;
      bodyStart = skipWhitespace(masked, optionEnd + 1);
    }
    const parsedBody = parseStraightPathBody(masked, bodyStart, end - 1);
    if (!parsedBody) continue;
    paths.push({
      cycle: parsedBody.cycle,
      end,
      points: parsedBody.points,
      prefix: source.slice(start, bodyStart),
      start,
    });
  }
  return paths;
}

function parseStraightPathBody(source: string, start: number, end: number) {
  const points: string[] = [];
  let cursor = skipWhitespace(source, start);
  const firstPoint = readNamedPointReference(source, cursor);
  if (!firstPoint) return null;
  points.push(firstPoint.name);
  cursor = firstPoint.end;
  let cycle = false;

  while (cursor < end) {
    cursor = skipWhitespace(source, cursor);
    if (cursor >= end) break;
    if (!source.startsWith("--", cursor)) return null;
    cursor = skipWhitespace(source, cursor + 2);
    if (/^cycle\s*$/u.test(source.slice(cursor, end))) {
      cycle = true;
      cursor = end;
      break;
    }
    const point = readNamedPointReference(source, cursor);
    if (!point) return null;
    points.push(point.name);
    cursor = point.end;
  }
  return points.length >= 2 && skipWhitespace(source, cursor) >= end
    ? { cycle, points }
    : null;
}

function readNamedPointReference(source: string, start: number) {
  const match = source
    .slice(start)
    .match(new RegExp(String.raw`^\(\s*(${POINT_NAME_PATTERN})\s*\)`, "u"));
  const name = match?.[1];
  return name && match?.[0] ? { end: start + match[0].length, name } : null;
}

function rewriteStraightDrawPath(
  source: string,
  path: StraightDrawPath,
  matchingEdges: number[],
) {
  const indent = readLineIndent(source, path.start);
  const createCommand = (points: string[]) =>
    `${path.prefix}${points.map((point) => `(${point})`).join(" -- ")};`;

  if (path.cycle) {
    if (matchingEdges.length !== 1) return null;
    const removedIndex = matchingEdges[0];
    if (removedIndex === undefined) return null;
    const ordered = Array.from(
      { length: path.points.length },
      (_, offset) => path.points[(removedIndex + 1 + offset) % path.points.length],
    ).filter((point): point is string => Boolean(point));
    return createCommand(ordered);
  }

  const firstPoint = path.points[0];
  if (!firstPoint) return null;
  const chunks: string[][] = [[firstPoint]];
  for (let index = 0; index < path.points.length - 1; index += 1) {
    const nextPoint = path.points[index + 1];
    if (!nextPoint) continue;
    if (matchingEdges.includes(index)) chunks.push([nextPoint]);
    else chunks.at(-1)?.push(nextPoint);
  }
  return chunks
    .filter((chunk) => chunk.length >= 2)
    .map((chunk, index) => `${index === 0 ? "" : `\n${indent}`}${createCommand(chunk)}`)
    .join("");
}

function readLineIndent(source: string, start: number) {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  return source.slice(lineStart, start).match(/^[\t ]*/u)?.[0] ?? "";
}

function resolveWholeCommandRemovalRange(source: string, start: number, end: number) {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const newline = source.indexOf("\n", end);
  const lineEnd = newline < 0 ? source.length : newline;
  return /^[\t ]*$/u.test(source.slice(lineStart, start)) &&
    /^[\t ]*$/u.test(source.slice(end, lineEnd))
    ? { end: newline < 0 ? lineEnd : newline + 1, start: lineStart }
    : { end, start };
}

function findTikzCommandEnd(source: string, start: number) {
  const stack: string[] = [];
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const token = source[cursor];
    if (token === "\\") {
      cursor += 1;
      continue;
    }
    if (token && pairs[token]) stack.push(pairs[token]);
    else if (token === stack.at(-1)) stack.pop();
    else if (token === ";" && stack.length === 0) return cursor + 1;
  }
  return null;
}

function applySourceReplacements(
  source: string,
  replacements: Array<{ end: number; start: number; value: string }>,
) {
  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, replacement) =>
        `${current.slice(0, replacement.start)}${replacement.value}${current.slice(replacement.end)}`,
      source,
    )
    .replace(/\n{3,}/gu, "\n\n");
}

function segmentKey(first: string, second: string) {
  return [first, second].sort((left, right) => left.localeCompare(right)).join("\u0000");
}

function angleGeometryKey(first: string, vertex: string, third: string) {
  return `${vertex}\u0001${segmentKey(first, third)}`;
}

function orientAngleAsMinorSweep(
  points: NamedPoint[],
  first: string,
  vertex: string,
  third: string,
): [string, string, string] | null {
  const firstPoint = points.find((point) => point.name === first);
  const vertexPoint = points.find((point) => point.name === vertex);
  const thirdPoint = points.find((point) => point.name === third);
  if (
    !firstPoint ||
    !vertexPoint ||
    !thirdPoint ||
    firstPoint?.x === null ||
    firstPoint?.y === null ||
    vertexPoint?.x === null ||
    vertexPoint?.y === null ||
    thirdPoint?.x === null ||
    thirdPoint?.y === null
  ) {
    return null;
  }
  const firstAngle = Math.atan2(
    firstPoint.y - vertexPoint.y,
    firstPoint.x - vertexPoint.x,
  );
  const thirdAngle = Math.atan2(
    thirdPoint.y - vertexPoint.y,
    thirdPoint.x - vertexPoint.x,
  );
  const counterClockwiseSweep = normalizeRadians(thirdAngle - firstAngle);
  return counterClockwiseSweep <= Math.PI
    ? [first, vertex, third]
    : [third, vertex, first];
}

function normalizeRadians(value: number) {
  const fullTurn = Math.PI * 2;
  return ((value % fullTurn) + fullTurn) % fullTurn;
}

function extractAnglePics(source: string): AnglePic[] {
  const masked = maskComments(source);
  const pics: AnglePic[] = [];
  const tokenPattern = /\\pic\b|\bpic\s*(?=\[|\{)/gu;
  for (const match of masked.matchAll(tokenPattern)) {
    let cursor = (match.index ?? 0) + match[0].length;
    cursor = skipWhitespace(masked, cursor);
    let options = "";
    if (masked[cursor] === "[") {
      const optionEnd = findBalancedEnd(masked, cursor, "[", "]");
      if (optionEnd === null) continue;
      options = source.slice(cursor + 1, optionEnd);
      cursor = skipWhitespace(masked, optionEnd + 1);
    }
    if (masked[cursor] !== "{") continue;
    const bodyEnd = findBalancedEnd(masked, cursor, "{", "}");
    if (bodyEnd === null) continue;
    const body = source.slice(cursor + 1, bodyEnd);
    const angleMatch = body.match(
      new RegExp(
        String.raw`^\s*angle\s*=\s*(${POINT_NAME_PATTERN})\s*--\s*(${POINT_NAME_PATTERN})\s*--\s*(${POINT_NAME_PATTERN})\s*$`,
        "u",
      ),
    );
    const first = angleMatch?.[1];
    const vertex = angleMatch?.[2];
    const third = angleMatch?.[3];
    if (!first || !vertex || !third) continue;
    pics.push({
      degrees: readQuotedDegrees(options),
      points: [first, vertex, third],
    });
  }
  return pics;
}

function readQuotedDegrees(options: string) {
  const match = options.match(/["']\s*\$?\s*(\d{1,3})\s*(?:\^\s*\{?\s*\\circ\s*\}?|°)/u);
  return match ? Number(match[1]) : null;
}

function selectMarkerCount(pics: AnglePic[], degrees: number) {
  const groups = new Map<string, AnglePic[]>();
  for (const pic of pics) {
    const key = angleGeometryKey(...pic.points);
    groups.set(key, [...(groups.get(key) ?? []), pic]);
  }
  const countByDegrees = new Map<number, number>();
  const groupedMarkers = [...groups.values()].map((group) => {
    const groupDegrees = [
      ...new Set(group.flatMap((pic) => (pic.degrees === null ? [] : [pic.degrees]))),
    ];
    return {
      degrees: groupDegrees.length === 1 ? (groupDegrees[0] ?? null) : null,
      markerCount: group.length,
    };
  });
  const usedCounts = new Set(
    groupedMarkers
      .filter(({ markerCount }) => markerCount > 1)
      .map(({ markerCount }) => markerCount),
  );

  for (const group of groupedMarkers.filter(
    ({ degrees: groupDegrees, markerCount }) => groupDegrees !== null && markerCount > 1,
  )) {
    if (group.degrees !== null && !countByDegrees.has(group.degrees)) {
      countByDegrees.set(group.degrees, group.markerCount);
    }
  }
  for (const group of groupedMarkers.filter(({ markerCount }) => markerCount === 1)) {
    if (group.degrees !== null && countByDegrees.has(group.degrees)) continue;
    let markerCount = 1;
    while (usedCounts.has(markerCount)) markerCount += 1;
    if (group.degrees !== null) countByDegrees.set(group.degrees, markerCount);
    usedCounts.add(markerCount);
  }
  const reusedCount = countByDegrees.get(degrees);
  if (reusedCount) return reusedCount;
  let candidate = 1;
  while (usedCounts.has(candidate)) candidate += 1;
  return candidate;
}

function createAnglePicLines(
  points: [string, string, string],
  degrees: number,
  markerCount: number,
) {
  return Array.from({ length: markerCount }, (_, index) => {
    const radius = ANGLE_RADIUS_START_CM + index * ANGLE_RADIUS_STEP_CM;
    const label =
      index === markerCount - 1
        ? `, angle eccentricity=1.45, font=\\small, "$${degrees}^\\circ$"`
        : "";
    return `  \\pic[draw, angle radius=${radius.toFixed(2)}cm${label}, solid, line cap=butt] {angle=${points.join("--")}};`;
  });
}

function insertBeforePictureEnd(source: string, lines: string[]) {
  const masked = maskComments(source);
  const endPattern = /\\end\{(?:tikzpicture|circuitikz)\}/gu;
  const matches = [...masked.matchAll(endPattern)];
  const last = matches.at(-1);
  if (last?.index === undefined) return null;
  const insertionIndex = last.index;
  const prefix = source.slice(0, insertionIndex);
  const separator = prefix.length === 0 || prefix.endsWith("\n") ? "" : "\n";
  return `${prefix}${separator}${lines.join("\n")}\n${source.slice(insertionIndex)}`;
}

function skipWhitespace(value: string, start: number) {
  let cursor = start;
  while (/\s/u.test(value[cursor] ?? "")) cursor += 1;
  return cursor;
}

function findBalancedEnd(
  value: string,
  start: number,
  opening: "[" | "{",
  closing: "]" | "}",
) {
  let depth = 0;
  let escaped = false;
  let quote: '"' | "'" | null = null;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

function maskComments(source: string) {
  return source
    .split("\n")
    .map((line) => {
      for (let index = 0; index < line.length; index += 1) {
        if (line[index] !== "%") continue;
        let backslashes = 0;
        for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) {
          backslashes += 1;
        }
        if (backslashes % 2 === 0) return line.slice(0, index).padEnd(line.length, " ");
      }
      return line;
    })
    .join("\n");
}
