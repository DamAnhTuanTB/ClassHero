export type TikzAngleAutoRepairChange = {
  vertex: string;
  from: string;
  to: string;
};

export type TikzAngleAutoRepairResult = {
  source: string;
  changes: TikzAngleAutoRepairChange[];
};

export type TikzAngleMarkerGroupRepairChange = {
  vertex: string;
  degrees: number;
  from: string;
  to: string;
};

export type TikzMathAngleAutoRepairResult = {
  source: string;
  changes: Array<TikzAngleAutoRepairChange | TikzAngleMarkerGroupRepairChange>;
};

type Point = { x: number; y: number };

const COORDINATE_NAME = String.raw`[A-Za-z@][A-Za-z0-9@:_-]*`;
const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)`;
const EXPLICIT_NON_INTERIOR_ANGLE_PATTERN =
  /(?:góc\s+(?:ngoài|phản(?:\s*xạ)?|lõm)|(?:exterior|reflex)\s+angle)/iu;
const EPSILON = 1e-8;
const ANGLE_MARKER_STYLE_PALETTE = [
  [],
  ["double", "double distance=0.6pt"],
  ["densely dashed"],
  ["double", "double distance=0.6pt", "densely dashed"],
  ["dotted"],
  ["double", "double distance=0.6pt", "dotted"],
  ["loosely dashed"],
  ["double", "double distance=0.6pt", "loosely dashed"],
] as const;
const ANGLE_MARKER_STYLE_TOKEN_PATTERN =
  /^(?:double(?:\s+distance\s*=.*)?|solid|(?:(?:densely|loosely)\s+)?(?:dashed|dotted))$/iu;
const SAFE_ANGLE_PIC_OPTION_PATTERNS = [
  /^draw(?:\s*=.*)?$/iu,
  /^fill(?:\s*=.*)?$/iu,
  /^angle\s+(?:radius|eccentricity)\s*=.*$/iu,
  /^font\s*=.*$/iu,
  /^text(?:\s+opacity)?\s*=.*$/iu,
  /^pic\s+text\s*=.*$/iu,
  /^pic\s+text\s+options\s*=.*$/iu,
  /^line\s+width\s*=.*$/iu,
  /^opacity\s*=.*$/iu,
  /^(?:thin|semithick|thick|very\s+thick|ultra\s+thick)$/iu,
  /^"[\s\S]*"$/u,
  ANGLE_MARKER_STYLE_TOKEN_PATTERN,
] as const;

type ExplicitAngleMeasure = {
  vertex: string;
  first: string | null;
  last: string | null;
  degrees: number;
};
type ParsedAnglePic = {
  index: number;
  match: string;
  beforeOptions: string;
  afterOptions: string;
  first: string;
  vertex: string;
  last: string;
  degrees: number;
  options: string;
  optionTokens: string[];
  markerSignature: string;
};

type ParsedManualAngleArc = {
  index: number;
  match: string;
  prefix: string;
  suffix: string;
  vertex: string;
  degrees: number;
  options: string;
  optionTokens: string[];
  markerSignature: string;
};

/**
 * Applies every high-confidence deterministic Math angle repair in a stable
 * order. Geometry orientation is repaired first, then visible marker groups.
 */
export function autoRepairMathAnglePics(input: {
  source: string;
  authorityText: string;
}): TikzMathAngleAutoRepairResult {
  const orientation = autoRepairReversedInteriorAnglePics(input);
  const markerGroups = autoRepairDistinctNumericAngleMarkerGroups({
    source: orientation.source,
    authorityText: input.authorityText,
  });
  const manualArcs = autoRepairDistinctNumericManualAngleArcs({
    source: markerGroups.source,
    authorityText: input.authorityText,
  });
  return {
    source: manualArcs.source,
    changes: [...orientation.changes, ...markerGroups.changes, ...manualArcs.changes],
  };
}

/**
 * Repairs the second common representation emitted by the model: literal
 * `\\draw (V) ++(...) arc (...);` angle marks. A source is changed only when
 * the literal sweep maps unambiguously to at least two different numeric
 * angle values stated by the authority text. Custom option syntax is left
 * untouched rather than guessed.
 */
export function autoRepairDistinctNumericManualAngleArcs(input: {
  source: string;
  authorityText: string;
}): { source: string; changes: TikzAngleMarkerGroupRepairChange[] } {
  const measures = parseAllExplicitNumericAngleMeasures(input.authorityText);
  const degreesInAuthority = unique(measures.map((measure) => measure.degrees));
  if (degreesInAuthority.length < 2) return { source: input.source, changes: [] };

  const arcs = [...input.source.matchAll(createManualAngleArcPattern())].flatMap(
    (match): ParsedManualAngleArc[] => {
      const index = match.index;
      const vertex = match[4];
      const startDegrees = Number(match[7]);
      const endDegrees = Number(match[8]);
      const options = match[2] ?? "";
      if (
        index === undefined ||
        !vertex ||
        !Number.isFinite(startDegrees) ||
        !Number.isFinite(endDegrees)
      ) {
        return [];
      }
      const sweep = Math.abs(endDegrees - startDegrees);
      if (sweep <= EPSILON || sweep >= 180 - EPSILON) return [];
      const candidateDegrees = unique(
        measures
          .filter(
            (measure) =>
              measure.vertex === vertex && Math.abs(measure.degrees - sweep) <= 0.15,
          )
          .map((measure) => measure.degrees),
      );
      if (candidateDegrees.length !== 1) return [];
      const optionTokens = splitTikzOptions(options);
      if (optionTokens.some((token) => !isSafeManualAngleArcOption(token))) {
        return [];
      }
      return [
        {
          index,
          match: match[0],
          prefix: match[1]!,
          suffix: match[3]!,
          vertex,
          degrees: candidateDegrees[0]!,
          options,
          optionTokens,
          markerSignature: readAngleMarkerSignature(optionTokens),
        },
      ];
    },
  );
  const mappedDegrees = degreesInAuthority.filter((degrees) =>
    arcs.some((arc) => arc.degrees === degrees),
  );
  if (
    mappedDegrees.length < 2 ||
    mappedDegrees.length > ANGLE_MARKER_STYLE_PALETTE.length
  ) {
    return { source: input.source, changes: [] };
  }

  const currentSignatures = mappedDegrees.map((degrees) =>
    unique(
      arcs.filter((arc) => arc.degrees === degrees).map((arc) => arc.markerSignature),
    ),
  );
  if (
    currentSignatures.every((signatures) => signatures.length === 1) &&
    new Set(currentSignatures.map(([signature]) => signature)).size ===
      mappedDegrees.length
  ) {
    return { source: input.source, changes: [] };
  }

  const markerStylesByDegrees = new Map(
    mappedDegrees.map((degrees, index) => [degrees, ANGLE_MARKER_STYLE_PALETTE[index]!]),
  );
  const changes: TikzAngleMarkerGroupRepairChange[] = [];
  const replacements = arcs.flatMap((arc) => {
    const markerStyle = markerStylesByDegrees.get(arc.degrees);
    if (!markerStyle) return [];
    const nextOptions = [
      ...arc.optionTokens.filter(
        (token) => !ANGLE_MARKER_STYLE_TOKEN_PATTERN.test(token),
      ),
      ...markerStyle,
    ].join(", ");
    if (nextOptions === arc.options.trim()) return [];
    changes.push({
      vertex: arc.vertex,
      degrees: arc.degrees,
      from: arc.options.trim(),
      to: nextOptions,
    });
    return [
      {
        start: arc.index,
        end: arc.index + arc.match.length,
        value: `${arc.prefix}${nextOptions ? `[${nextOptions}]` : ""}${arc.suffix}`,
      },
    ];
  });

  return { source: applyReplacements(input.source, replacements), changes };
}

/**
 * Gives explicitly different numeric angle values visibly different TikZ
 * marker groups. The repair is intentionally narrow: every mapped angle must
 * use one simple named-coordinate `\\pic`, and ambiguous/custom option syntax is
 * left untouched for AI/admin review rather than guessed.
 */
export function autoRepairDistinctNumericAngleMarkerGroups(input: {
  source: string;
  authorityText: string;
}): { source: string; changes: TikzAngleMarkerGroupRepairChange[] } {
  const measures = parseAllExplicitNumericAngleMeasures(input.authorityText);
  if (unique(measures.map((measure) => measure.degrees)).length < 2) {
    return { source: input.source, changes: [] };
  }

  const relevantMatches = [...input.source.matchAll(createAnglePicPattern())].filter(
    (match) =>
      Boolean(match[6] && measures.some((measure) => measure.vertex === match[6])),
  );
  if (relevantMatches.length < 2) return { source: input.source, changes: [] };
  const pics = relevantMatches.flatMap((match): ParsedAnglePic[] => {
    const index = match.index;
    const first = match[4];
    const vertex = match[6];
    const last = match[8];
    const options = match[2] ?? "";
    if (index === undefined || !first || !vertex || !last) return [];
    const measure = resolveAnglePicMeasure(measures, { first, vertex, last });
    if (!measure) return [];
    const optionTokens = splitTikzOptions(options);
    if (
      optionTokens.length === 0 ||
      !optionTokens.some((token) => /^draw(?:\s*=.*)?$/iu.test(token)) ||
      optionTokens.some((token) => !isSafeAnglePicOption(token))
    ) {
      return [];
    }
    return [
      {
        index,
        match: match[0],
        beforeOptions: match[1]!,
        afterOptions: `${match[3]}${first}${match[5]}${vertex}${match[7]}${last}${match[9]}`,
        first,
        vertex,
        last,
        degrees: measure.degrees,
        options,
        optionTokens,
        markerSignature: readAngleMarkerSignature(optionTokens),
      } satisfies ParsedAnglePic,
    ];
  });
  if (
    pics.length !== relevantMatches.length ||
    unique(pics.map((pic) => `${pic.first}--${pic.vertex}--${pic.last}`)).length !==
      pics.length
  ) {
    return { source: input.source, changes: [] };
  }

  const orderedDegrees = unique(pics.map((pic) => pic.degrees));
  if (
    orderedDegrees.length < 2 ||
    orderedDegrees.length > ANGLE_MARKER_STYLE_PALETTE.length
  ) {
    return { source: input.source, changes: [] };
  }

  const signaturesByDegrees = new Map<number, Set<string>>();
  for (const pic of pics) {
    const degrees = pic.degrees;
    const signatures = signaturesByDegrees.get(degrees) ?? new Set<string>();
    signatures.add(pic.markerSignature);
    signaturesByDegrees.set(degrees, signatures);
  }
  const currentSignatures = orderedDegrees.map((degrees) =>
    [...signaturesByDegrees.get(degrees)!].sort().join("|"),
  );
  if (
    signaturesByDegrees.size === orderedDegrees.length &&
    [...signaturesByDegrees.values()].every((signatures) => signatures.size === 1) &&
    new Set(currentSignatures).size === currentSignatures.length
  ) {
    return { source: input.source, changes: [] };
  }

  const markerStylesByDegrees = new Map(
    orderedDegrees.map((degrees, index) => [degrees, ANGLE_MARKER_STYLE_PALETTE[index]!]),
  );
  const changes: TikzAngleMarkerGroupRepairChange[] = [];
  const replacements = pics.flatMap((pic) => {
    const markerStyle = markerStylesByDegrees.get(pic.degrees)!;
    const nextOptions = [
      ...pic.optionTokens.filter(
        (token) => !ANGLE_MARKER_STYLE_TOKEN_PATTERN.test(token),
      ),
      ...markerStyle,
    ].join(", ");
    if (nextOptions === pic.options.trim()) return [];
    changes.push({
      vertex: pic.vertex,
      degrees: pic.degrees,
      from: pic.options.trim(),
      to: nextOptions,
    });
    return [
      {
        start: pic.index,
        end: pic.index + pic.match.length,
        value: `${pic.beforeOptions}[${nextOptions}]${pic.afterOptions}`,
      },
    ];
  });
  return { source: applyReplacements(input.source, replacements), changes };
}

function createAnglePicPattern() {
  return new RegExp(
    String.raw`(\\pic\s*)(?:\[([^\]]*)\])?(\s*\{\s*angle\s*=\s*)(${COORDINATE_NAME})(\s*--\s*)(${COORDINATE_NAME})(\s*--\s*)(${COORDINATE_NAME})(\s*\})`,
    "gu",
  );
}

function createManualAngleArcPattern() {
  return new RegExp(
    String.raw`(\\draw\s*)(?:\[([^\]]*)\])?(\s*\(\s*(${COORDINATE_NAME})\s*\)\s*\+\+\s*\(\s*(${NUMBER})\s*:\s*(${NUMBER})\s*\)\s*arc\s*\(\s*(${NUMBER})\s*:\s*(${NUMBER})\s*:\s*(${NUMBER})\s*\)\s*;)`,
    "gu",
  );
}

function parseAllExplicitNumericAngleMeasures(authorityText: string) {
  const measures: ExplicitAngleMeasure[] = [];
  const patterns = [
    new RegExp(
      String.raw`\\+widehat\s*\{\s*([A-Za-z]{1,3})\s*\}\s*=\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:\^\s*\{?\s*\\+circ\s*\}?|°)`,
      "giu",
    ),
    new RegExp(
      String.raw`\\+angle\s*(?:\{\s*)?([A-Za-z]{3})(?:\s*\})?\s*=\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:\^\s*\{?\s*\\+circ\s*\}?|°)`,
      "giu",
    ),
    /∠\s*([A-Za-z]{3})\s*=\s*([+-]?\d+(?:[.,]\d+)?)\s*°/giu,
  ];
  for (const pattern of patterns) {
    for (const match of authorityText.matchAll(pattern)) {
      const notation = readAngleNotation(match[1]);
      const degrees = Number(match[2]?.replace(",", "."));
      if (!notation || !Number.isFinite(degrees)) continue;
      if (
        !measures.some(
          (measure) =>
            measure.vertex === notation.vertex &&
            measure.first === notation.first &&
            measure.last === notation.last &&
            measure.degrees === degrees,
        )
      ) {
        measures.push({ ...notation, degrees });
      }
    }
  }
  return measures;
}

function readAngleNotation(notation: string | undefined) {
  const compact = notation?.replace(/\s/gu, "") ?? "";
  if (/^[A-Za-z]$/u.test(compact)) {
    return { first: null, vertex: compact, last: null };
  }
  if (/^[A-Za-z]{3}$/u.test(compact)) {
    return { first: compact[0]!, vertex: compact[1]!, last: compact[2]! };
  }
  return null;
}

function resolveAnglePicMeasure(
  measures: ExplicitAngleMeasure[],
  pic: { first: string; vertex: string; last: string },
) {
  const candidates = measures.filter((measure) => measure.vertex === pic.vertex);
  const endpointMatches = candidates.filter(
    (measure) =>
      measure.first !== null &&
      measure.last !== null &&
      ((measure.first === pic.first && measure.last === pic.last) ||
        (measure.first === pic.last && measure.last === pic.first)),
  );
  const matchedDegrees = unique(endpointMatches.map((measure) => measure.degrees));
  if (matchedDegrees.length === 1) return endpointMatches[0]!;
  const candidateDegrees = unique(candidates.map((measure) => measure.degrees));
  return candidateDegrees.length === 1 ? (candidates[0] ?? null) : null;
}

function splitTikzOptions(value: string) {
  const options: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if ("{([".includes(character)) depth += 1;
    if ("})]".includes(character)) depth = Math.max(0, depth - 1);
    if (character !== "," || depth !== 0) continue;
    const option = value.slice(start, index).trim();
    if (option) options.push(option);
    start = index + 1;
  }
  const trailing = value.slice(start).trim();
  if (trailing) options.push(trailing);
  return options;
}

function isSafeAnglePicOption(value: string) {
  return SAFE_ANGLE_PIC_OPTION_PATTERNS.some((pattern) => pattern.test(value));
}

function isSafeManualAngleArcOption(value: string) {
  return (
    ANGLE_MARKER_STYLE_TOKEN_PATTERN.test(value) ||
    /^(?:draw(?:\s*=.*)?|line\s+width\s*=.*|opacity\s*=.*|thin|semithick|thick|very\s+thick|ultra\s+thick)$/iu.test(
      value,
    )
  );
}

function readAngleMarkerSignature(options: string[]) {
  const double = options.some((option) => /^double(?:\s|$)/iu.test(option));
  let dash = "solid";
  for (const option of options) {
    if (/^(?:(?:densely|loosely)\s+)?(?:dashed|dotted)$/iu.test(option)) {
      dash = option.toLowerCase().replace(/\s+/gu, " ");
    } else if (/^solid$/iu.test(option)) {
      dash = "solid";
    }
  }
  return `${double ? 2 : 1}:${dash}`;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function applyReplacements(
  source: string,
  replacements: Array<{ start: number; end: number; value: string }>,
) {
  return [...replacements]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, replacement) =>
        `${current.slice(0, replacement.start)}${replacement.value}${current.slice(replacement.end)}`,
      source,
    );
}

/**
 * Repairs only high-confidence reversed TikZ angle pics on convex polygon paths.
 * Ambiguous coordinates, concave polygons, non-adjacent rays, and authority that
 * mentions an exterior/reflex angle are deliberately left unchanged.
 */
export function autoRepairReversedInteriorAnglePics(input: {
  source: string;
  authorityText: string;
}): TikzAngleAutoRepairResult {
  if (EXPLICIT_NON_INTERIOR_ANGLE_PATTERN.test(input.authorityText)) {
    return { source: input.source, changes: [] };
  }

  const coordinates = parseLiteralCoordinates(input.source);
  const polygons = parseConvexPolygonPaths(input.source, coordinates);
  if (polygons.length === 0) return { source: input.source, changes: [] };

  const changes: TikzAngleAutoRepairChange[] = [];
  const anglePattern = new RegExp(
    String.raw`(\{\s*angle\s*=\s*)(${COORDINATE_NAME})(\s*--\s*)(${COORDINATE_NAME})(\s*--\s*)(${COORDINATE_NAME})(\s*\})`,
    "gu",
  );
  const source = input.source.replace(
    anglePattern,
    (match, prefix, first, firstJoin, vertex, secondJoin, last, suffix) => {
      const candidates = polygons.filter((polygon) =>
        isReversedInteriorAngle({ polygon, first, vertex, last, coordinates }),
      );
      if (candidates.length !== 1) return match;
      const from = `${first}--${vertex}--${last}`;
      const to = `${last}--${vertex}--${first}`;
      changes.push({ vertex, from, to });
      return `${prefix}${last}${firstJoin}${vertex}${secondJoin}${first}${suffix}`;
    },
  );

  return { source, changes };
}

function parseLiteralCoordinates(source: string) {
  const coordinates = new Map<string, Point>();
  const coordinatePattern = new RegExp(
    String.raw`\\coordinate\s*\(\s*(${COORDINATE_NAME})\s*\)\s*at\s*\(\s*([^()]+?)\s*\)\s*;`,
    "gu",
  );
  for (const match of source.matchAll(coordinatePattern)) {
    const name = match[1];
    const point = match[2] ? parseLiteralPoint(match[2]) : null;
    if (name && point) coordinates.set(name, point);
  }
  return coordinates;
}

function parseLiteralPoint(value: string): Point | null {
  const cartesian = value.match(
    new RegExp(
      String.raw`^\s*(${NUMBER})\s*(?:cm|mm|pt)?\s*,\s*(${NUMBER})\s*(?:cm|mm|pt)?\s*$`,
      "u",
    ),
  );
  if (cartesian) {
    return { x: Number(cartesian[1]), y: Number(cartesian[2]) };
  }
  const polar = value.match(
    new RegExp(String.raw`^\s*(${NUMBER})\s*:\s*(${NUMBER})\s*(?:cm|mm|pt)?\s*$`, "u"),
  );
  if (!polar) return null;
  const angle = (Number(polar[1]) * Math.PI) / 180;
  const radius = Number(polar[2]);
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function parseConvexPolygonPaths(source: string, coordinates: Map<string, Point>) {
  const polygons: string[][] = [];
  const pathPattern = /\\(?:draw|path)\b(?:\s*\[[^\]]*\])?\s*([^;]+);/gu;
  const purePolygonPattern = new RegExp(
    String.raw`^\s*\(\s*${COORDINATE_NAME}\s*\)(?:\s*--\s*\(\s*${COORDINATE_NAME}\s*\)){2,}\s*--\s*cycle\s*$`,
    "u",
  );
  const namePattern = new RegExp(String.raw`\(\s*(${COORDINATE_NAME})\s*\)`, "gu");
  for (const match of source.matchAll(pathPattern)) {
    const body = match[1];
    if (!body || !purePolygonPattern.test(body)) continue;
    const names = [...body.matchAll(namePattern)].map((entry) => entry[1]!);
    if (
      names.length >= 3 &&
      new Set(names).size === names.length &&
      names.every((name) => coordinates.has(name)) &&
      isConvex(names.map((name) => coordinates.get(name)!))
    ) {
      polygons.push(names);
    }
  }
  return polygons;
}

function isConvex(points: Point[]) {
  let direction = 0;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[index]!;
    const current = points[(index + 1) % points.length]!;
    const next = points[(index + 2) % points.length]!;
    const cross = crossProduct(previous, current, next);
    if (Math.abs(cross) <= EPSILON) return false;
    const sign = Math.sign(cross);
    if (direction === 0) direction = sign;
    else if (direction !== sign) return false;
  }
  return true;
}

function isReversedInteriorAngle(input: {
  polygon: string[];
  first: string;
  vertex: string;
  last: string;
  coordinates: Map<string, Point>;
}) {
  const vertexIndex = input.polygon.indexOf(input.vertex);
  if (vertexIndex < 0) return false;
  const previous = input.polygon.at(vertexIndex - 1)!;
  const next = input.polygon[(vertexIndex + 1) % input.polygon.length]!;
  if (!(
    (input.first === previous && input.last === next) ||
    (input.first === next && input.last === previous)
  )) {
    return false;
  }

  const firstPoint = input.coordinates.get(input.first)!;
  const vertexPoint = input.coordinates.get(input.vertex)!;
  const lastPoint = input.coordinates.get(input.last)!;
  const currentSweep = counterclockwiseSweep(firstPoint, vertexPoint, lastPoint);
  const reversedSweep = counterclockwiseSweep(lastPoint, vertexPoint, firstPoint);
  if (!(currentSweep > Math.PI + EPSILON && reversedSweep < Math.PI - EPSILON)) {
    return false;
  }

  const interiorProbe = angleBisectorProbe(lastPoint, vertexPoint, firstPoint);
  if (!interiorProbe) return false;
  const polygonPoints = input.polygon.map((name) => input.coordinates.get(name)!);
  return pointInPolygon(interiorProbe, polygonPoints);
}

function counterclockwiseSweep(first: Point, vertex: Point, last: Point) {
  const start = Math.atan2(first.y - vertex.y, first.x - vertex.x);
  const end = Math.atan2(last.y - vertex.y, last.x - vertex.x);
  const fullTurn = Math.PI * 2;
  return (((end - start) % fullTurn) + fullTurn) % fullTurn;
}

function angleBisectorProbe(first: Point, vertex: Point, last: Point): Point | null {
  const firstVector = normalize({ x: first.x - vertex.x, y: first.y - vertex.y });
  const lastVector = normalize({ x: last.x - vertex.x, y: last.y - vertex.y });
  if (!firstVector || !lastVector) return null;
  const bisector = normalize({
    x: firstVector.x + lastVector.x,
    y: firstVector.y + lastVector.y,
  });
  if (!bisector) return null;
  return { x: vertex.x + bisector.x * 1e-4, y: vertex.y + bisector.y * 1e-4 };
}

function normalize(point: Point): Point | null {
  const length = Math.hypot(point.x, point.y);
  return length <= EPSILON ? null : { x: point.x / length, y: point.y / length };
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function crossProduct(first: Point, second: Point, third: Point) {
  return (
    (second.x - first.x) * (third.y - second.y) -
    (second.y - first.y) * (third.x - second.x)
  );
}
