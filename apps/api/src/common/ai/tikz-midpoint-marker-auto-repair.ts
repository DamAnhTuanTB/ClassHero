export type TikzMidpointMarkerRepairChange = {
  midpoint: string;
  segment: string;
  removedStyles: string[];
};

export type TikzMidpointMarkerRepairResult = {
  source: string;
  changes: TikzMidpointMarkerRepairChange[];
};

type Point = { x: number; y: number };
type MidpointRelation = { midpoint: string; first: string; last: string };
type TikzMark = { raw: string; position: number };
type TikzStyleDefinition = { name: string; marks: TikzMark[] };

const EPSILON = 1e-7;
const COORDINATE_NAME = String.raw`[A-Za-z@][A-Za-z0-9@:_-]*`;
const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)`;
const MIDPOINT_MARK_ACTION_PALETTE = [
  String.raw`\draw[line width=0.55pt] (-1.8pt,-1.2pt) -- (1.8pt,1.2pt);`,
  String.raw`\draw[line width=0.55pt] (-2.1pt,-1.2pt) -- (0.3pt,1.2pt); \draw[line width=0.55pt] (-0.3pt,-1.2pt) -- (2.1pt,1.2pt);`,
  String.raw`\draw[line width=0.55pt] (-1.8pt,1.2pt) -- (1.8pt,-1.2pt);`,
  String.raw`\draw[line width=0.55pt] (-2.1pt,1.2pt) -- (0.3pt,-1.2pt); \draw[line width=0.55pt] (-0.3pt,1.2pt) -- (2.1pt,-1.2pt);`,
] as const;

/**
 * Replaces midpoint marker bundles drawn directly at the midpoint of a whole
 * segment with a compact matching pair on the two half-segments. The repair is
 * deliberately conservative: the authority must explicitly name the midpoint,
 * the source must verify that construction, and the affected path/style syntax
 * must be simple enough to rewrite without guessing.
 */
export function autoRepairTikzMidpointMarkerBundles(input: {
  source: string;
  authorityText: string;
}): TikzMidpointMarkerRepairResult {
  const relations = parseMidpointRelations(input.authorityText);
  if (relations.length === 0 || relations.length > MIDPOINT_MARK_ACTION_PALETTE.length) {
    return { source: input.source, changes: [] };
  }

  const verifiedRelations = relations.filter((relation) =>
    hasVerifiedMidpointConstruction(input.source, relation),
  );
  if (verifiedRelations.length !== relations.length) {
    return { source: input.source, changes: [] };
  }

  const styles = parseTikzStyleDefinitions(input.source);
  const pathPattern = createDirectSegmentDrawPattern();
  const pathMatches = [...input.source.matchAll(pathPattern)];
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  const changes: TikzMidpointMarkerRepairChange[] = [];

  for (const [groupIndex, relation] of relations.entries()) {
    const candidates = pathMatches.filter((match) => {
      const first = match[4];
      const last = match[5];
      return (
        (first === relation.first && last === relation.last) ||
        (first === relation.last && last === relation.first)
      );
    });
    if (candidates.length !== 1) continue;
    const match = candidates[0]!;
    const index = match.index;
    if (index === undefined) continue;

    const optionTokens = splitTikzOptions(match[2] ?? "");
    if (
      optionTokens.some((token) =>
        /^(?:decoration|postaction|preaction)\s*=/iu.test(token),
      )
    ) {
      continue;
    }
    const appliedMarkingStyles = optionTokens.flatMap((token) => {
      const definition = styles.get(token.trim());
      return definition && definition.marks.length > 0 ? [definition] : [];
    });
    const badStyles = appliedMarkingStyles.filter((style) =>
      style.marks.some((mark) => Math.abs(mark.position - 0.5) <= EPSILON),
    );
    if (badStyles.length === 0) continue;

    const badStyleNames = new Set(badStyles.map((style) => style.name));
    const markingStyleNames = new Set(appliedMarkingStyles.map((style) => style.name));
    const preservedMarks = appliedMarkingStyles.flatMap((style) =>
      style.marks
        .filter(
          (mark) =>
            !badStyleNames.has(style.name) || Math.abs(mark.position - 0.5) > EPSILON,
        )
        .map((mark) => mark.raw),
    );
    const action = MIDPOINT_MARK_ACTION_PALETTE[groupIndex]!;
    const midpointMarks = [
      `mark=at position .25 with {${action}}`,
      `mark=at position .75 with {${action}}`,
    ];
    const nextOptions = [
      ...optionTokens.filter((token) => !markingStyleNames.has(token.trim())),
      `decoration={markings, ${[...preservedMarks, ...midpointMarks].join(", ")}}`,
      "postaction={decorate}",
    ].join(", ");

    replacements.push({
      start: index,
      end: index + match[0].length,
      value: `${match[1]}[${nextOptions}]${match[3]}`,
    });
    changes.push({
      midpoint: relation.midpoint,
      segment: `${relation.first}${relation.last}`,
      removedStyles: [...badStyleNames],
    });
  }

  return {
    source: applyReplacements(input.source, replacements),
    changes,
  };
}

function parseMidpointRelations(authorityText: string) {
  const relations: MidpointRelation[] = [];
  const parallelPattern =
    /Gọi\s+([\s\S]{1,240}?)\s+lần\s+lượt\s+là\s+trung\s+điểm\s+của\s+([\s\S]{1,320}?)(?:[.\n]|$)/giu;
  for (const match of authorityText.matchAll(parallelPattern)) {
    const midpoints = extractAuthorityTokens(match[1]).filter(
      (token) => token.length === 1,
    );
    const segments = extractAuthorityTokens(match[2]).filter(
      (token) => token.length === 2,
    );
    if (midpoints.length === 0 || midpoints.length !== segments.length) continue;
    for (const [index, midpoint] of midpoints.entries()) {
      const segment = segments[index]!;
      relations.push({ midpoint, first: segment[0]!, last: segment[1]! });
    }
  }

  const normalized = authorityText.replace(/[$\\{}]/gu, " ");
  const individualPattern =
    /\b([A-Z])\b\s+(?:là|được\s+gọi\s+là)\s+trung\s+điểm\s+của\s+\b([A-Z])\s*([A-Z])\b/gu;
  for (const match of normalized.matchAll(individualPattern)) {
    if (!match[1] || !match[2] || !match[3]) continue;
    relations.push({ midpoint: match[1], first: match[2], last: match[3] });
  }

  return relations.filter(
    (relation, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.midpoint === relation.midpoint &&
          candidate.first === relation.first &&
          candidate.last === relation.last,
      ) === index,
  );
}

function extractAuthorityTokens(value: string | undefined) {
  return value?.match(/[A-Z][A-Za-z0-9@:_-]*/gu) ?? [];
}

function hasVerifiedMidpointConstruction(source: string, relation: MidpointRelation) {
  const midpoint = escapeRegExp(relation.midpoint);
  const first = escapeRegExp(relation.first);
  const last = escapeRegExp(relation.last);
  const calcPatterns = [
    new RegExp(
      String.raw`\\coordinate\s*\(\s*${midpoint}\s*\)\s*at\s*\(\s*\$\s*\(\s*${first}\s*\)\s*!\s*0?\.5(?:0*)?\s*!\s*\(\s*${last}\s*\)\s*\$\s*\)\s*;`,
      "u",
    ),
    new RegExp(
      String.raw`\\coordinate\s*\(\s*${midpoint}\s*\)\s*at\s*\(\s*\$\s*\(\s*${last}\s*\)\s*!\s*0?\.5(?:0*)?\s*!\s*\(\s*${first}\s*\)\s*\$\s*\)\s*;`,
      "u",
    ),
  ];
  if (calcPatterns.some((pattern) => pattern.test(source))) return true;

  const coordinates = parseLiteralCartesianCoordinates(source);
  const midpointPoint = coordinates.get(relation.midpoint);
  const firstPoint = coordinates.get(relation.first);
  const lastPoint = coordinates.get(relation.last);
  return Boolean(
    midpointPoint &&
    firstPoint &&
    lastPoint &&
    Math.abs(midpointPoint.x - (firstPoint.x + lastPoint.x) / 2) <= EPSILON &&
    Math.abs(midpointPoint.y - (firstPoint.y + lastPoint.y) / 2) <= EPSILON,
  );
}

function parseLiteralCartesianCoordinates(source: string) {
  const coordinates = new Map<string, Point>();
  const pattern = new RegExp(
    String.raw`\\coordinate\s*\(\s*(${COORDINATE_NAME})\s*\)\s*at\s*\(\s*(${NUMBER})\s*(?:cm|mm|pt)?\s*,\s*(${NUMBER})\s*(?:cm|mm|pt)?\s*\)\s*;`,
    "gu",
  );
  for (const match of source.matchAll(pattern)) {
    if (!match[1]) continue;
    coordinates.set(match[1], { x: Number(match[2]), y: Number(match[3]) });
  }
  return coordinates;
}

function parseTikzStyleDefinitions(source: string) {
  const definitions = new Map<string, TikzStyleDefinition>();
  const pattern = /([A-Za-z][A-Za-z0-9 _-]*?)\/\.style\s*=\s*\{/gu;
  for (const match of source.matchAll(pattern)) {
    const openingBrace = (match.index ?? 0) + match[0].length - 1;
    const closingBrace = findMatchingBrace(source, openingBrace);
    const name = match[1]?.trim();
    if (!name || closingBrace === null) continue;
    const body = source.slice(openingBrace + 1, closingBrace);
    definitions.set(name, { name, marks: parseTikzMarks(body) });
  }
  return definitions;
}

function parseTikzMarks(value: string) {
  const marks: TikzMark[] = [];
  const pattern = new RegExp(
    String.raw`mark\s*=\s*at\s+position\s+(${NUMBER})\s+with\s*\{`,
    "gu",
  );
  for (const match of value.matchAll(pattern)) {
    const openingBrace = (match.index ?? 0) + match[0].length - 1;
    const closingBrace = findMatchingBrace(value, openingBrace);
    const position = Number(match[1]);
    if (closingBrace === null || !Number.isFinite(position)) continue;
    marks.push({
      raw: value.slice(match.index, closingBrace + 1).trim(),
      position,
    });
  }
  return marks;
}

function findMatchingBrace(value: string, openingBrace: number) {
  let depth = 0;
  for (let index = openingBrace; index < value.length; index += 1) {
    if (value[index] === "\\") {
      index += 1;
      continue;
    }
    if (value[index] === "{") depth += 1;
    if (value[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return null;
}

function createDirectSegmentDrawPattern() {
  return new RegExp(
    String.raw`(\\draw\s*)\[([^\]]+)\](\s*\(\s*(${COORDINATE_NAME})\s*\)\s*--\s*\(\s*(${COORDINATE_NAME})\s*\)\s*;)`,
    "gu",
  );
}

function splitTikzOptions(value: string) {
  const options: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === "\\") {
      index += 1;
      continue;
    }
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
