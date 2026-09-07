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
  degrees: number | string;
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
const MAX_CONCENTRIC_ANGLE_ARCS = 6;
const DEFAULT_CONCENTRIC_ANGLE_ARC_GAP_CM = 0.05;
const ANGLE_RADIUS_INCREMENT_BY_UNIT = {
  cm: DEFAULT_CONCENTRIC_ANGLE_ARC_GAP_CM,
  mm: DEFAULT_CONCENTRIC_ANGLE_ARC_GAP_CM * 10,
  pt: DEFAULT_CONCENTRIC_ANGLE_ARC_GAP_CM * 28.3465,
} as const;
const ANGLE_MARKER_STYLE_TOKEN_PATTERN =
  /^(?:double(?:\s+distance\s*=.*)?|solid|(?:(?:densely|loosely)\s+)?(?:dashed|dotted))$/iu;
const ANGLE_LINE_CAP_TOKEN_PATTERN = /^line\s+cap\s*=.*$/iu;
const ANGLE_LABEL_OPTION_PATTERNS = [
  /^angle\s+eccentricity\s*=.*$/iu,
  /^font\s*=.*$/iu,
  /^text(?:\s+opacity)?\s*=.*$/iu,
  /^pic\s+text\s*=.*$/iu,
  /^pic\s+text\s+options\s*=.*$/iu,
  /^"[\s\S]*"$/u,
] as const;
const SAFE_ANGLE_PIC_OPTION_PATTERNS = [
  /^draw(?:\s*=.*)?$/iu,
  /^fill(?:\s*=.*)?$/iu,
  /^angle\s+(?:radius|eccentricity)\s*=.*$/iu,
  /^font\s*=.*$/iu,
  /^text(?:\s+opacity)?\s*=.*$/iu,
  /^pic\s+text\s*=.*$/iu,
  /^pic\s+text\s+options\s*=.*$/iu,
  /^line\s+width\s*=.*$/iu,
  ANGLE_LINE_CAP_TOKEN_PATTERN,
  /^opacity\s*=.*$/iu,
  /^(?:thin|semithick|thick|very\s+thick|ultra\s+thick)$/iu,
  /^"[\s\S]*"$/u,
  ANGLE_MARKER_STYLE_TOKEN_PATTERN,
] as const;

type ExplicitAngleMeasure = {
  vertex: string;
  first: string | null;
  last: string | null;
  key: string;
  display: number | string;
  numericDegrees: number | null;
};
type ParsedAnglePic = {
  index: number;
  match: string;
  beforeOptions: string;
  afterOptions: string;
  terminator: string;
  first: string;
  vertex: string;
  last: string;
  measureKey: string;
  measureDisplay: number | string;
  options: string;
  optionTokens: string[];
  radius: ParsedAngleRadius | null;
};

type ParsedManualAngleArc = {
  index: number;
  match: string;
  prefix: string;
  vertex: string;
  degrees: number;
  options: string;
  optionTokens: string[];
  startDegreesSource: string;
  startRadius: number;
  arcStartDegreesSource: string;
  arcEndDegreesSource: string;
  arcRadius: number;
};

type ParsedAngleRadius = {
  value: number;
  unit: keyof typeof ANGLE_RADIUS_INCREMENT_BY_UNIT;
};

/**
 * Applies every high-confidence deterministic Math angle repair in a stable
 * order. Geometry orientation is repaired first, then marker groups are
 * canonicalized to independent, solid, concentric arcs with flat endpoints.
 */
export function autoRepairMathAnglePics(input: {
  source: string;
  authorityText: string;
}): TikzMathAngleAutoRepairResult {
  const orientation = autoRepairReversedInteriorAnglePics(input);
  const markerGroups = autoRepairDistinctAngleMeasureMarkerGroups({
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
 * the literal sweep maps unambiguously to at least two different numeric angle
 * values stated by the authority text. Every marker is emitted as its own
 * solid arc; TikZ `double` and dash patterns are never used as angle markers.
 * Custom option syntax is left untouched rather than guessed.
 */
export function autoRepairDistinctNumericManualAngleArcs(input: {
  source: string;
  authorityText: string;
}): { source: string; changes: TikzAngleMarkerGroupRepairChange[] } {
  const measures = parseAllExplicitAngleMeasures(input.authorityText).filter(
    (measure) => measure.numericDegrees !== null,
  );
  const degreesInAuthority = unique(
    measures.flatMap((measure) =>
      measure.numericDegrees === null ? [] : [measure.numericDegrees],
    ),
  );
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
              measure.vertex === vertex &&
              measure.numericDegrees !== null &&
              Math.abs(measure.numericDegrees - sweep) <= 0.15,
          )
          .flatMap((measure) =>
            measure.numericDegrees === null ? [] : [measure.numericDegrees],
          ),
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
          vertex,
          degrees: candidateDegrees[0]!,
          options,
          optionTokens,
          startDegreesSource: match[5]!,
          startRadius: Number(match[6]),
          arcStartDegreesSource: match[7]!,
          arcEndDegreesSource: match[8]!,
          arcRadius: Number(match[9]),
        },
      ];
    },
  );
  const mappedDegrees = degreesInAuthority.filter((degrees) =>
    arcs.some((arc) => arc.degrees === degrees),
  );
  if (mappedDegrees.length < 2 || mappedDegrees.length > MAX_CONCENTRIC_ANGLE_ARCS) {
    return { source: input.source, changes: [] };
  }

  const arcsBySweep = new Map<string, ParsedManualAngleArc[]>();
  for (const arc of arcs) {
    const sweepKey = [
      arc.vertex,
      arc.startDegreesSource,
      arc.arcStartDegreesSource,
      arc.arcEndDegreesSource,
      arc.degrees,
    ].join(":");
    const group = arcsBySweep.get(sweepKey) ?? [];
    group.push(arc);
    arcsBySweep.set(sweepKey, group);
  }
  const arcGroups = [...arcsBySweep.values()].sort(
    (left, right) => left[0]!.index - right[0]!.index,
  );

  const markerCountByDegrees = new Map(
    mappedDegrees.map((degrees, index) => [degrees, index + 1]),
  );
  const changes: TikzAngleMarkerGroupRepairChange[] = [];
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  for (const group of arcGroups) {
    const firstArc = group[0]!;
    const markerCount = markerCountByDegrees.get(firstArc.degrees);
    if (
      !markerCount ||
      group.length > MAX_CONCENTRIC_ANGLE_ARCS ||
      group.some((arc) => Math.abs(arc.startRadius - arc.arcRadius) > EPSILON) ||
      unique(
        group.map((arc) => readManualAngleArcConstructionSignature(arc.optionTokens)),
      ).length !== 1
    ) {
      return { source: input.source, changes: [] };
    }
    const baseRadius = Math.min(...group.map((arc) => arc.arcRadius));
    const nextOptions = normalizeSolidAngleMarkerOptions(firstArc.optionTokens);
    const indent = readLineIndent(input.source, firstArc.index);
    const renderedArcs = Array.from({ length: markerCount }, (_, index) => {
      const radius = formatTikzNumber(
        baseRadius + index * DEFAULT_CONCENTRIC_ANGLE_ARC_GAP_CM,
      );
      return `${firstArc.prefix}[${nextOptions.join(", ")}](${firstArc.vertex}) ++(${firstArc.startDegreesSource}:${radius}) arc (${firstArc.arcStartDegreesSource}:${firstArc.arcEndDegreesSource}:${radius});`;
    }).join(`\n${indent}`);
    changes.push({
      vertex: firstArc.vertex,
      degrees: firstArc.degrees,
      from: group.map((arc) => arc.options.trim()).join(" | "),
      to: `${markerCount} solid concentric arc${markerCount === 1 ? "" : "s"}`,
    });
    replacements.push({
      start: firstArc.index,
      end: firstArc.index + firstArc.match.length,
      value: renderedArcs,
    });
    for (const duplicate of group.slice(1)) {
      replacements.push(createWholeLineRemoval(input.source, duplicate));
    }
  }

  const source = applyReplacements(input.source, replacements);
  return source === input.source ? { source, changes: [] } : { source, changes };
}

/**
 * Gives explicitly different numeric angle values visibly different TikZ
 * marker groups. Group N uses N independent, solid, concentric `\\pic` arcs
 * with flat endpoints. This deliberately avoids TikZ `double`, whose stroke
 * outlines can look joined at the ends, and avoids dashed/dotted short arcs.
 * The repair is intentionally narrow: every mapped angle must use one simple
 * named-coordinate `\\pic`; ambiguous/custom option syntax is left untouched.
 */
export function autoRepairDistinctAngleMeasureMarkerGroups(input: {
  source: string;
  authorityText: string;
}): { source: string; changes: TikzAngleMarkerGroupRepairChange[] } {
  const measures = parseAllExplicitAngleMeasures(input.authorityText);
  if (unique(measures.map((measure) => measure.key)).length < 2) {
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
        terminator: match[10]!,
        first,
        vertex,
        last,
        measureKey: measure.key,
        measureDisplay: measure.display,
        options,
        optionTokens,
        radius: parseAngleRadius(optionTokens),
      } satisfies ParsedAnglePic,
    ];
  });
  if (pics.length !== relevantMatches.length) {
    return { source: input.source, changes: [] };
  }

  const picsByRay = new Map<string, ParsedAnglePic[]>();
  for (const pic of pics) {
    const rayKey = `${pic.first}--${pic.vertex}--${pic.last}`;
    const group = picsByRay.get(rayKey) ?? [];
    group.push(pic);
    picsByRay.set(rayKey, group);
  }
  const picGroups = [...picsByRay.values()].sort(
    (left, right) => left[0]!.index - right[0]!.index,
  );
  if (picGroups.length < 2) return { source: input.source, changes: [] };

  const orderedMeasureKeys = unique(picGroups.map((group) => group[0]!.measureKey));
  if (
    orderedMeasureKeys.length < 2 ||
    orderedMeasureKeys.length > MAX_CONCENTRIC_ANGLE_ARCS
  ) {
    return { source: input.source, changes: [] };
  }

  const markerCountByMeasureKey = new Map(
    orderedMeasureKeys.map((measureKey, index) => [measureKey, index + 1]),
  );
  const changes: TikzAngleMarkerGroupRepairChange[] = [];
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  for (const group of picGroups) {
    const firstPic = group[0]!;
    const markerCount = markerCountByMeasureKey.get(firstPic.measureKey)!;
    const radii = group.map((pic) => pic.radius);
    const radiusUnits = unique(radii.flatMap((radius) => (radius ? [radius.unit] : [])));
    const labelPics = group.filter((pic) =>
      pic.optionTokens.some((token) => isAngleLabelOption(token)),
    );
    const constructionSignatures = unique(
      group.map((pic) => readAnglePicConstructionSignature(pic.optionTokens)),
    );
    if (
      group.length > MAX_CONCENTRIC_ANGLE_ARCS ||
      labelPics.length > 1 ||
      constructionSignatures.length !== 1 ||
      ((markerCount > 1 || group.length > 1) &&
        (radii.some((radius) => radius === null) || radiusUnits.length !== 1)) ||
      (markerCount > 1 &&
        group.some((pic) =>
          pic.optionTokens.some((token) => /^fill(?:\s*=.*)?$/iu.test(token)),
        ))
    ) {
      return { source: input.source, changes: [] };
    }

    const template = labelPics[0] ?? firstPic;
    const baseRadius = radii.every((radius) => radius !== null)
      ? Math.min(...radii.map((radius) => radius.value))
      : null;
    const radiusTemplate = radii.find((radius) => radius !== null) ?? null;
    const baseOptions = normalizeSolidAngleMarkerOptions(template.optionTokens);
    const indent = readLineIndent(input.source, firstPic.index);
    const renderedPics = Array.from({ length: markerCount }, (_, index) => {
      const optionTokens =
        index === markerCount - 1
          ? baseOptions
          : baseOptions.filter((token) => !isAngleLabelOption(token));
      const nextOptions =
        radiusTemplate && baseRadius !== null
          ? replaceAngleRadius(
              optionTokens,
              radiusTemplate,
              baseRadius + index * ANGLE_RADIUS_INCREMENT_BY_UNIT[radiusTemplate.unit],
            )
          : optionTokens;
      return `${firstPic.beforeOptions}[${nextOptions.join(", ")}]${firstPic.afterOptions}${firstPic.terminator}`;
    }).join(`\n${indent}`);
    changes.push({
      vertex: firstPic.vertex,
      degrees: firstPic.measureDisplay,
      from: group.map((pic) => pic.options.trim()).join(" | "),
      to: `${markerCount} solid concentric arc${markerCount === 1 ? "" : "s"}`,
    });
    replacements.push({
      start: firstPic.index,
      end: firstPic.index + firstPic.match.length,
      value: renderedPics,
    });
    for (const duplicate of group.slice(1)) {
      replacements.push(createWholeLineRemoval(input.source, duplicate));
    }
  }
  const source = applyReplacements(input.source, replacements);
  return source === input.source ? { source, changes: [] } : { source, changes };
}

function createAnglePicPattern() {
  return new RegExp(
    String.raw`(\\pic\s*)(?:\[([^\]]*)\])?(\s*\{\s*angle\s*=\s*)(${COORDINATE_NAME})(\s*--\s*)(${COORDINATE_NAME})(\s*--\s*)(${COORDINATE_NAME})(\s*\})(\s*;)`,
    "gu",
  );
}

function createManualAngleArcPattern() {
  return new RegExp(
    String.raw`(\\draw\s*)(?:\[([^\]]*)\])?(\s*\(\s*(${COORDINATE_NAME})\s*\)\s*\+\+\s*\(\s*(${NUMBER})\s*:\s*(${NUMBER})\s*\)\s*arc\s*\(\s*(${NUMBER})\s*:\s*(${NUMBER})\s*:\s*(${NUMBER})\s*\)\s*;)`,
    "gu",
  );
}

function parseAllExplicitAngleMeasures(authorityText: string) {
  const measures: ExplicitAngleMeasure[] = [];
  const patterns = [
    new RegExp(
      String.raw`\\+widehat\s*\{\s*([A-Za-z]{1,3})\s*\}\s*=\s*([^$"\r\n]{1,120}?)\s*(?:\^\s*\{?\s*\\+circ\s*\}?|°)`,
      "giu",
    ),
    new RegExp(
      String.raw`\\+angle\s*(?:\{\s*)?([A-Za-z]{3})(?:\s*\})?\s*=\s*([^$"\r\n]{1,120}?)\s*(?:\^\s*\{?\s*\\+circ\s*\}?|°)`,
      "giu",
    ),
    /∠\s*([A-Za-z]{3})\s*=\s*([^$"\r\n]{1,120}?)\s*°/giu,
    new RegExp(
      String.raw`\\+widehat\s*\{\s*([A-Za-z]{1,3})\s*\}\s*=\s*([^$"\r\n]{1,120}?)(?=\s*(?:\$|"))`,
      "giu",
    ),
    new RegExp(
      String.raw`\\+angle\s*(?:\{\s*)?([A-Za-z]{3})(?:\s*\})?\s*=\s*([^$"\r\n]{1,120}?)(?=\s*(?:\$|"))`,
      "giu",
    ),
  ];
  for (const pattern of patterns) {
    for (const match of authorityText.matchAll(pattern)) {
      const notation = readAngleNotation(match[1]);
      const measure = normalizeAngleMeasureExpression(match[2]);
      if (!notation || !measure) continue;
      if (
        !measures.some(
          (existing) =>
            existing.vertex === notation.vertex &&
            existing.first === notation.first &&
            existing.last === notation.last &&
            existing.key === measure.key,
        )
      ) {
        measures.push({ ...notation, ...measure });
      }
    }
  }
  return measures;
}

function normalizeAngleMeasureExpression(
  value: string | undefined,
): Pick<ExplicitAngleMeasure, "key" | "display" | "numericDegrees"> | null {
  let compact = value
    ?.replace(/\\+(?:left|right)\b/gu, "")
    .replace(/\\+/gu, "\\")
    .replace(/−/gu, "-")
    .replace(/\s+/gu, "")
    .trim();
  compact = compact?.replace(/(?:\^\{?\\circ\}?|°)$/u, "");
  if (
    !compact ||
    compact.length > 80 ||
    !/^[A-Za-z0-9+\-*/().,{}^_\\]+$/u.test(compact) ||
    /\\(?:widehat|angle)\b/iu.test(compact)
  ) {
    return null;
  }
  while (compact.startsWith("(") && compact.endsWith(")")) {
    const inner = compact.slice(1, -1);
    if (!hasBalancedParentheses(inner)) break;
    compact = inner;
  }
  if (!/[A-Za-z0-9]/u.test(compact)) return null;
  const numericDegrees = /^[+-]?\d+(?:[.,]\d+)?$/u.test(compact)
    ? Number(compact.replace(",", "."))
    : null;
  if (numericDegrees !== null && !Number.isFinite(numericDegrees)) return null;
  const key =
    numericDegrees === null ? `expr:${compact.toLowerCase()}` : `num:${numericDegrees}`;
  return {
    key,
    display: numericDegrees ?? compact,
    numericDegrees,
  };
}

function hasBalancedParentheses(value: string) {
  let depth = 0;
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
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
  const matchedKeys = unique(endpointMatches.map((measure) => measure.key));
  if (matchedKeys.length === 1) return endpointMatches[0]!;
  const candidateKeys = unique(candidates.map((measure) => measure.key));
  return candidateKeys.length === 1 ? (candidates[0] ?? null) : null;
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
    /^(?:draw(?:\s*=.*)?|line\s+(?:width|cap)\s*=.*|opacity\s*=.*|thin|semithick|thick|very\s+thick|ultra\s+thick)$/iu.test(
      value,
    )
  );
}

function normalizeSolidAngleMarkerOptions(options: string[]) {
  return [
    ...options.filter(
      (option) =>
        !ANGLE_MARKER_STYLE_TOKEN_PATTERN.test(option) &&
        !ANGLE_LINE_CAP_TOKEN_PATTERN.test(option),
    ),
    "solid",
    "line cap=butt",
  ];
}

function isAngleLabelOption(option: string) {
  return ANGLE_LABEL_OPTION_PATTERNS.some((pattern) => pattern.test(option));
}

function readAnglePicConstructionSignature(options: string[]) {
  return options
    .filter(
      (option) =>
        !/^angle\s+radius\s*=/iu.test(option) &&
        !isAngleLabelOption(option) &&
        !ANGLE_MARKER_STYLE_TOKEN_PATTERN.test(option) &&
        !ANGLE_LINE_CAP_TOKEN_PATTERN.test(option),
    )
    .map((option) => option.replace(/\s+/gu, " ").trim().toLowerCase())
    .sort()
    .join("|");
}

function readManualAngleArcConstructionSignature(options: string[]) {
  return options
    .filter(
      (option) =>
        !ANGLE_MARKER_STYLE_TOKEN_PATTERN.test(option) &&
        !ANGLE_LINE_CAP_TOKEN_PATTERN.test(option),
    )
    .map((option) => option.replace(/\s+/gu, " ").trim().toLowerCase())
    .sort()
    .join("|");
}

function parseAngleRadius(options: string[]): ParsedAngleRadius | null {
  const pattern = new RegExp(
    String.raw`^angle\s+radius\s*=\s*(${NUMBER})\s*(cm|mm|pt)$`,
    "iu",
  );
  const matches = options.flatMap((option) => {
    const match = option.match(pattern);
    if (!match || !match[1] || !match[2]) return [];
    return [
      {
        value: Number(match[1]),
        unit: match[2].toLowerCase() as ParsedAngleRadius["unit"],
      },
    ];
  });
  return matches.length === 1 && Number.isFinite(matches[0]!.value) ? matches[0]! : null;
}

function replaceAngleRadius(options: string[], radius: ParsedAngleRadius, value: number) {
  return options.map((option) =>
    /^angle\s+radius\s*=/iu.test(option)
      ? `angle radius=${formatTikzNumber(value)}${radius.unit}`
      : option,
  );
}

function formatTikzNumber(value: number) {
  return value.toFixed(4).replace(/0+$/u, "").replace(/\.$/u, "");
}

function readLineIndent(source: string, index: number) {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  return source.slice(lineStart, index).match(/^\s*/u)?.[0] ?? "";
}

function createWholeLineRemoval(source: string, item: { index: number; match: string }) {
  const lineStart = source.lastIndexOf("\n", item.index - 1) + 1;
  const matchEnd = item.index + item.match.length;
  const lineEndIndex = source.indexOf("\n", matchEnd);
  const lineEnd = lineEndIndex < 0 ? source.length : lineEndIndex + 1;
  const before = source.slice(lineStart, item.index);
  const after = source.slice(matchEnd, lineEndIndex < 0 ? source.length : lineEndIndex);
  if (/^[\t ]*$/u.test(before) && /^[\t ]*$/u.test(after)) {
    return { start: lineStart, end: lineEnd, value: "" };
  }
  return { start: item.index, end: matchEnd, value: "" };
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
