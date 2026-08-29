import {
  STEM_FIGURE_DISPLAY_SCALE_DEFAULT,
  readStemFigureDisplayScale,
  writeStemFigureDisplayScale,
} from "@learning-path/shared";

export type StemFigureSourceTransformResult = {
  removedCount: number;
  source: string;
};

export type StemFigureQuickAction =
  | "REMOVE_LENGTH_LABELS"
  | "REMOVE_ANGLE_MEASUREMENTS"
  | "REMOVE_NUMERIC_LABELS"
  | "REMOVE_DASHED_PATHS"
  | "SET_LINE_WEIGHT_THIN"
  | "SET_LINE_WEIGHT_NORMAL"
  | "SET_LINE_WEIGHT_BOLD"
  | "SET_PRIMARY_LABEL_SIZE_SMALL"
  | "SET_PRIMARY_LABEL_SIZE_NORMAL"
  | "SET_PRIMARY_LABEL_SIZE_LARGE"
  | "SET_SECONDARY_LABEL_SIZE_TINY"
  | "SET_SECONDARY_LABEL_SIZE_SMALL"
  | "SET_SECONDARY_LABEL_SIZE_NORMAL"
  | "SCALE_DOWN"
  | "SCALE_UP";

export type StemFigureQuickTransformResult = {
  changedCount: number;
  source: string;
};

export type StemFigureScaleTarget = "DISPLAY" | "PRIMARY_LABEL" | "SECONDARY_LABEL";

export const STEM_FIGURE_SCALE_PERCENT_MIN = 10;
export const STEM_FIGURE_SCALE_PERCENT_MAX = 200;
export const STEM_FIGURE_SCALE_PERCENT_DEFAULT = 100;
export const STEM_FIGURE_TEXT_OFFSET_MIN = -50;
export const STEM_FIGURE_TEXT_OFFSET_MAX = 50;
export const STEM_FIGURE_TEXT_OFFSET_DEFAULT = 0;

export type StemFigureTextAdjustmentTarget = "FONT_SIZE" | "X" | "Y";

export type StemFigureTextAdjustment = {
  fontSizePercentage: number;
  xOffsetPt: number;
  yOffsetPt: number;
};

export type StemFigureTextSlotKind =
  "ANNOTATION" | "COMPONENT_LABEL" | "LABEL" | "MEASUREMENT";

export type StemFigureTextSlot = {
  adjustment: StemFigureTextAdjustment | null;
  id: string;
  kind: StemFigureTextSlotKind;
  value: string;
};

export type StemFigureTextSlotExtraction = {
  slots: StemFigureTextSlot[];
  unsupportedCount: number;
};

type SourceRange = {
  end: number;
  start: number;
};

type TikzNode = {
  content: string;
  contentEnd: number;
  end: number;
  optionEnd: number | null;
  optionStart: number | null;
  standalone: boolean;
  start: number;
};

type ParsedTextSlot = StemFigureTextSlot & {
  adjustmentTarget: TikzNode | null;
  deleteRange: SourceRange;
  replacementPrefix: string;
  replacementRange: SourceRange;
  replacementSuffix: string;
};

const LENGTH_UNITS = [
  "dam",
  "mm",
  "cm",
  "dm",
  "hm",
  "km",
  "µm",
  "μm",
  "nm",
  "pm",
  "in",
  "ft",
  "yd",
  "mi",
  "m",
  "å",
] as const;

const LENGTH_UNIT_PATTERN = new RegExp(`(${LENGTH_UNITS.join("|")})$`, "iu");
const TEXT_SLOT_ADJUSTMENT_STYLE = "classhero text slot adjustment";
const TEXT_SLOT_ADJUSTMENT_DEFINITION_PATTERN = new RegExp(
  `^${TEXT_SLOT_ADJUSTMENT_STYLE}/\\.style\\s*=\\s*\\{([\\s\\S]*)\\}$`,
  "u",
);
const TEXT_SLOT_ADJUSTMENT_ACTIVATION_PATTERN = new RegExp(
  `^${TEXT_SLOT_ADJUSTMENT_STYLE}$`,
  "u",
);

/**
 * Extracts only visible text constructs with syntax boundaries that can be
 * rewritten without guessing. Unsupported candidates stay untouched and are
 * counted so the UI can direct the admin back to the code editor.
 */
export function extractStemFigureTextSlots(source: string): StemFigureTextSlotExtraction {
  const parsed = parseStemFigureTextSlots(source);
  return {
    slots: parsed.slots.map(({ adjustment, id, kind, value }) => ({
      adjustment,
      id,
      kind,
      value,
    })),
    unsupportedCount: parsed.unsupportedCount,
  };
}

/**
 * Adjusts one safely parsed TikZ node without changing its geometry anchor.
 * The current source position/font is the baseline (0pt/100%); our isolated
 * local style is added after existing options so user-authored styles remain
 * intact and can be restored by returning every control to its default.
 */
export function updateStemFigureTextSlotAdjustment(
  source: string,
  slotId: string,
  target: StemFigureTextAdjustmentTarget,
  value: number,
): StemFigureQuickTransformResult {
  const slot = parseStemFigureTextSlots(source).slots.find(({ id }) => id === slotId);
  if (!slot?.adjustment || !slot.adjustmentTarget) {
    return { changedCount: 0, source };
  }

  const nextAdjustment = { ...slot.adjustment };
  if (target === "X") {
    nextAdjustment.xOffsetPt = clampRounded(
      value,
      STEM_FIGURE_TEXT_OFFSET_MIN,
      STEM_FIGURE_TEXT_OFFSET_MAX,
    );
  } else if (target === "Y") {
    nextAdjustment.yOffsetPt = clampRounded(
      value,
      STEM_FIGURE_TEXT_OFFSET_MIN,
      STEM_FIGURE_TEXT_OFFSET_MAX,
    );
  } else {
    nextAdjustment.fontSizePercentage = clampRounded(
      value,
      STEM_FIGURE_SCALE_PERCENT_MIN,
      STEM_FIGURE_SCALE_PERCENT_MAX,
    );
  }

  if (
    nextAdjustment.xOffsetPt === slot.adjustment.xOffsetPt &&
    nextAdjustment.yOffsetPt === slot.adjustment.yOffsetPt &&
    nextAdjustment.fontSizePercentage === slot.adjustment.fontSizePercentage
  ) {
    return { changedCount: 0, source };
  }

  return writeTextSlotAdjustment(source, slot.adjustmentTarget, nextAdjustment);
}

/** Rewrites or removes exactly one previously extracted visible-text slot. */
export function updateStemFigureTextSlot(
  source: string,
  slotId: string,
  nextValue: string,
): StemFigureQuickTransformResult {
  const slot = parseStemFigureTextSlots(source).slots.find(({ id }) => id === slotId);
  if (!slot) return { changedCount: 0, source };

  const normalizedValue = nextValue.trim();
  if (!normalizedValue) {
    return applyRanges(source, [slot.deleteRange]);
  }

  if (normalizedValue === slot.value) return { changedCount: 0, source };
  return applyReplacements(source, [
    {
      ...slot.replacementRange,
      value: `${slot.replacementPrefix}${normalizedValue}${slot.replacementSuffix}`,
    },
  ]);
}

export function readStemFigureScalePercentage(
  source: string,
  target: StemFigureScaleTarget,
) {
  const scale =
    target === "DISPLAY"
      ? (readStemFigureDisplayScale(source) ?? STEM_FIGURE_DISPLAY_SCALE_DEFAULT)
      : readStemFigureLabelScale(
          source,
          target === "PRIMARY_LABEL" ? "PRIMARY" : "SECONDARY",
        );
  return Math.round(scale * 100);
}

export function setStemFigureScalePercentage(
  source: string,
  target: StemFigureScaleTarget,
  percentage: number,
): StemFigureQuickTransformResult {
  const normalizedPercentage = Math.min(
    STEM_FIGURE_SCALE_PERCENT_MAX,
    Math.max(STEM_FIGURE_SCALE_PERCENT_MIN, Math.round(percentage)),
  );
  const scale = normalizedPercentage / 100;
  if (target === "DISPLAY") {
    const transformed = writeStemFigureDisplayScale(source, scale);
    return { changedCount: transformed === source ? 0 : 1, source: transformed };
  }
  return setTikzLabelFontScale(
    source,
    target === "PRIMARY_LABEL" ? "PRIMARY" : "SECONDARY",
    scale,
  );
}

function parseStemFigureTextSlots(source: string): {
  slots: ParsedTextSlot[];
  unsupportedCount: number;
} {
  const slots: ParsedTextSlot[] = [];
  let unsupportedCount = 0;
  let cursor = 0;

  while (cursor < source.length) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor);
      continue;
    }

    const standaloneNode = isStandaloneNodeStart(source, cursor);
    const inlineNode = !standaloneNode && isInlineNodeStart(source, cursor);
    if (standaloneNode || inlineNode) {
      const node = parseTikzNode(source, cursor, standaloneNode);
      if (!node) {
        unsupportedCount += 1;
        cursor += standaloneNode ? "\\node".length : "node".length;
        continue;
      }
      const contentStart = node.contentEnd - node.content.length - 1;
      const contentEnd = node.contentEnd - 1;
      if (node.content.trim()) {
        slots.push(
          createParsedTextSlot({
            adjustmentTarget: node,
            contentEnd,
            contentStart,
            deleteRange: resolveRemovalRange(source, node),
            idPrefix: standaloneNode ? "NODE" : "INLINE_NODE",
            kind: classifyTextSlotKind(node.content),
            source,
          }),
        );
      }
      cursor = node.contentEnd;
      continue;
    }

    const picCommand = isPicCommandStart(source, cursor);
    const inlinePic = !picCommand && isPicPathOperationStart(source, cursor);
    if (picCommand || inlinePic) {
      const optionStart = skipWhitespaceAndComments(
        source,
        cursor + (picCommand ? "\\pic".length : "pic".length),
      );
      if (source[optionStart] !== "[") {
        cursor = optionStart;
        continue;
      }
      const optionEnd = readBalancedGroup(source, optionStart);
      if (optionEnd === null) {
        unsupportedCount += 1;
        cursor = optionStart + 1;
        continue;
      }
      for (const option of splitTopLevelOptionRanges(
        source,
        optionStart + 1,
        optionEnd - 1,
      )) {
        const quoteStart = skipInlineWhitespace(source, option.start);
        if (source[quoteStart] !== '"') continue;
        const quoteEnd = findClosingQuote(source, quoteStart + 1, option.end);
        if (quoteEnd === null) {
          unsupportedCount += 1;
          continue;
        }
        const content = source.slice(quoteStart + 1, quoteEnd);
        if (!content.trim()) continue;
        slots.push(
          createParsedTextSlot({
            contentEnd: quoteEnd,
            contentStart: quoteStart + 1,
            deleteRange: resolveOptionRemovalRange(
              source,
              optionStart + 1,
              optionEnd - 1,
              option.start,
              option.end,
            ),
            idPrefix: picCommand ? "PIC" : "INLINE_PIC",
            kind: classifyTextSlotKind(content),
            source,
          }),
        );
      }
      cursor = optionEnd;
      continue;
    }

    if (isTikzToOperationStart(source, cursor)) {
      const optionStart = skipWhitespaceAndComments(source, cursor + "to".length);
      if (source[optionStart] !== "[") {
        cursor += "to".length;
        continue;
      }
      const optionEnd = readBalancedGroup(source, optionStart);
      if (optionEnd === null) {
        unsupportedCount += 1;
        cursor = optionStart + 1;
        continue;
      }
      for (const option of splitTopLevelOptionRanges(
        source,
        optionStart + 1,
        optionEnd - 1,
      )) {
        const rawOption = source.slice(option.start, option.end);
        const equalsOffset = rawOption.indexOf("=");
        if (equalsOffset < 0) continue;
        const key = rawOption.slice(0, equalsOffset).trim();
        if (!/^(?:l|l_|l\^|a|a_|a\^|t)$/u.test(key)) continue;

        let contentStart = option.start + equalsOffset + 1;
        let contentEnd = option.end;
        while (/\s/u.test(source[contentStart] ?? "")) contentStart += 1;
        while (contentEnd > contentStart && /\s/u.test(source[contentEnd - 1] ?? "")) {
          contentEnd -= 1;
        }
        if (source[contentStart] === "{") {
          const groupEnd = readBalancedGroup(source, contentStart);
          if (groupEnd === contentEnd) {
            contentStart += 1;
            contentEnd -= 1;
          }
        }
        const content = source.slice(contentStart, contentEnd);
        if (!content.trim()) continue;
        slots.push(
          createParsedTextSlot({
            contentEnd,
            contentStart,
            deleteRange: resolveOptionRemovalRange(
              source,
              optionStart + 1,
              optionEnd - 1,
              option.start,
              option.end,
            ),
            idPrefix: `CIRCUIT_${key}`,
            kind: "COMPONENT_LABEL",
            source,
          }),
        );
      }
      cursor = optionEnd;
      continue;
    }

    cursor += 1;
  }

  return {
    slots: slots.sort(
      (left, right) => left.replacementRange.start - right.replacementRange.start,
    ),
    unsupportedCount,
  };
}

function createParsedTextSlot({
  adjustmentTarget = null,
  contentEnd,
  contentStart,
  deleteRange,
  idPrefix,
  kind,
  source,
}: {
  adjustmentTarget?: TikzNode | null;
  contentEnd: number;
  contentStart: number;
  deleteRange: SourceRange;
  idPrefix: string;
  kind: StemFigureTextSlotKind;
  source: string;
}): ParsedTextSlot {
  const wrapper = unwrapEditableTextRange(source, contentStart, contentEnd);
  return {
    adjustment: adjustmentTarget
      ? readTextSlotAdjustment(source, adjustmentTarget)
      : null,
    adjustmentTarget,
    deleteRange,
    id: `${idPrefix}:${contentStart}:${contentEnd}`,
    kind,
    replacementPrefix: source.slice(contentStart, wrapper.start),
    replacementRange: { end: contentEnd, start: contentStart },
    replacementSuffix: source.slice(wrapper.end, contentEnd),
    value: source.slice(wrapper.start, wrapper.end),
  };
}

function readTextSlotAdjustment(
  source: string,
  node: TikzNode,
): StemFigureTextAdjustment {
  const options = readNodeOptions(source, node);
  const definition = options
    .map((option) => option.trim().match(TEXT_SLOT_ADJUSTMENT_DEFINITION_PATTERN))
    .find((match) => match?.[1] !== undefined);
  const adjustmentOptions = splitTopLevelOptions(definition?.[1] ?? "");
  const baseFont = readBaseNodeFontMetrics(options);
  const adjustedFont = adjustmentOptions
    .find((option) => /^font\s*=/u.test(option))
    ?.match(ABSOLUTE_FONT_SIZE_PATTERN);
  const adjustedFontSize = Number(adjustedFont?.[1]);

  return {
    fontSizePercentage:
      Number.isFinite(adjustedFontSize) && baseFont.size > 0
        ? clampRounded(
            (adjustedFontSize / baseFont.size) * 100,
            STEM_FIGURE_SCALE_PERCENT_MIN,
            STEM_FIGURE_SCALE_PERCENT_MAX,
          )
        : STEM_FIGURE_SCALE_PERCENT_DEFAULT,
    xOffsetPt: readAdjustmentDimension(adjustmentOptions, "xshift"),
    yOffsetPt: readAdjustmentDimension(adjustmentOptions, "yshift"),
  };
}

function writeTextSlotAdjustment(
  source: string,
  node: TikzNode,
  adjustment: StemFigureTextAdjustment,
): StemFigureQuickTransformResult {
  const originalOptions = readNodeOptions(source, node);
  const preservedOptions = originalOptions.filter((option) => {
    const normalized = option.trim();
    return (
      !TEXT_SLOT_ADJUSTMENT_DEFINITION_PATTERN.test(normalized) &&
      !TEXT_SLOT_ADJUSTMENT_ACTIVATION_PATTERN.test(normalized)
    );
  });
  const styleOptions: string[] = [];

  if (adjustment.xOffsetPt !== STEM_FIGURE_TEXT_OFFSET_DEFAULT) {
    styleOptions.push(`xshift=${formatSignedDimension(adjustment.xOffsetPt)}pt`);
  }
  if (adjustment.yOffsetPt !== STEM_FIGURE_TEXT_OFFSET_DEFAULT) {
    styleOptions.push(`yshift=${formatSignedDimension(adjustment.yOffsetPt)}pt`);
  }
  if (adjustment.fontSizePercentage !== STEM_FIGURE_SCALE_PERCENT_DEFAULT) {
    const baseFont = readBaseNodeFontMetrics(preservedOptions);
    const ratio = adjustment.fontSizePercentage / 100;
    styleOptions.push(
      `font=${createAbsoluteFontSize(baseFont.size * ratio, baseFont.leading * ratio)}`,
    );
  }

  if (styleOptions.length > 0) {
    preservedOptions.push(
      `${TEXT_SLOT_ADJUSTMENT_STYLE}/.style={${styleOptions.join(", ")}}`,
      TEXT_SLOT_ADJUSTMENT_STYLE,
    );
  }

  const commandLength = node.standalone ? "\\node".length : "node".length;
  if (node.optionStart !== null && node.optionEnd !== null) {
    return applyReplacements(source, [
      {
        end: node.optionEnd,
        start: node.optionStart,
        value: preservedOptions.length > 0 ? `[${preservedOptions.join(", ")}]` : "",
      },
    ]);
  }

  if (preservedOptions.length === 0) return { changedCount: 0, source };
  return applyReplacements(source, [
    {
      end: node.start + commandLength,
      start: node.start + commandLength,
      value: `[${preservedOptions.join(", ")}]`,
    },
  ]);
}

function readNodeOptions(source: string, node: TikzNode) {
  return node.optionStart !== null && node.optionEnd !== null
    ? splitTopLevelOptions(source.slice(node.optionStart + 1, node.optionEnd - 1))
    : [];
}

function readBaseNodeFontMetrics(options: string[]) {
  const fontOption = options.find((option) => {
    const normalized = option.trim();
    return (
      /^font\s*=/u.test(normalized) &&
      !TEXT_SLOT_ADJUSTMENT_DEFINITION_PATTERN.test(normalized)
    );
  });
  const absolute = fontOption?.match(ABSOLUTE_FONT_SIZE_PATTERN);
  if (absolute?.[1] && absolute[2]) {
    return { leading: Number(absolute[2]), size: Number(absolute[1]) };
  }

  const named = fontOption?.match(NAMED_FONT_SIZE_PATTERN)?.[1];
  const size = named ? (NAMED_FONT_SIZE_POINTS[named] ?? 10) : 10;
  return { leading: size * 1.2, size };
}

function readAdjustmentDimension(options: string[], property: "xshift" | "yshift") {
  const pattern = new RegExp(`^${property}\\s*=\\s*([+-]?\\d+(?:\\.\\d+)?)pt$`, "u");
  const parsed = Number(
    options.map((option) => option.trim().match(pattern)?.[1]).find(Boolean),
  );
  return Number.isFinite(parsed)
    ? clampRounded(parsed, STEM_FIGURE_TEXT_OFFSET_MIN, STEM_FIGURE_TEXT_OFFSET_MAX)
    : STEM_FIGURE_TEXT_OFFSET_DEFAULT;
}

function clampRounded(value: number, min: number, max: number) {
  const normalized = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(max, Math.max(min, normalized));
}

function formatSignedDimension(value: number) {
  return value > 0 ? `+${value}` : value.toString();
}

function unwrapEditableTextRange(source: string, start: number, end: number) {
  if (end - start >= 2 && source[start] === "$" && source[end - 1] === "$") {
    return { end: end - 1, start: start + 1 };
  }
  if (
    end - start >= 4 &&
    source.startsWith("\\(", start) &&
    source.slice(end - 2, end) === "\\)"
  ) {
    return { end: end - 2, start: start + 2 };
  }
  return { end, start };
}

function classifyTextSlotKind(content: string): StemFigureTextSlotKind {
  if (
    isExplicitLengthMeasurement(content) ||
    isExplicitAngleMeasurement(content) ||
    isExplicitNumericLabel(content)
  ) {
    return "MEASUREMENT";
  }
  if (/\\text\b|\s/u.test(content.replace(/^\$|\$$/gu, ""))) {
    return "ANNOTATION";
  }
  return "LABEL";
}

/**
 * Removes only TikZ node clauses whose complete visible content is an explicit
 * length measurement. Geometry, point labels, angles, axis values and comments
 * are preserved. The result remains a regular editable TikZ snippet.
 */
export function removeStemFigureLengthLabels(
  source: string,
): StemFigureSourceTransformResult {
  return removeTikzNodeLabels(source, isExplicitLengthMeasurement);
}

/**
 * Removes TikZ node clauses whose complete visible content is an explicit angle
 * measurement such as 60°, 90^\circ, \ang{45} or \SI{30}{\degree}. Angle arcs,
 * right-angle marks, point labels and path geometry are preserved.
 */
export function removeStemFigureAngleMeasurements(
  source: string,
): StemFigureSourceTransformResult {
  const nodeResult = removeTikzNodeLabels(source, isExplicitAngleMeasurement);
  const picResult = removeTikzPicAngleLabels(nodeResult.source);
  return {
    removedCount: nodeResult.removedCount + picResult.removedCount,
    source: picResult.source,
  };
}

/**
 * Applies an explicit, syntax-bounded edit to a TikZ snippet. These actions do
 * not infer subject semantics and are safe to run before the existing backend
 * compiler/validator gate.
 */
export function applyStemFigureQuickAction(
  source: string,
  action: StemFigureQuickAction,
): StemFigureQuickTransformResult {
  switch (action) {
    case "REMOVE_LENGTH_LABELS": {
      const result = removeStemFigureLengthLabels(source);
      return { changedCount: result.removedCount, source: result.source };
    }
    case "REMOVE_ANGLE_MEASUREMENTS": {
      const result = removeStemFigureAngleMeasurements(source);
      return { changedCount: result.removedCount, source: result.source };
    }
    case "REMOVE_NUMERIC_LABELS": {
      const result = removeTikzNodeLabels(source, isExplicitNumericLabel);
      return { changedCount: result.removedCount, source: result.source };
    }
    case "REMOVE_DASHED_PATHS":
      return removeTikzDashedPaths(source);
    case "SET_LINE_WEIGHT_THIN":
      return setTikzLineWeight(source, "0.45pt");
    case "SET_LINE_WEIGHT_NORMAL":
      return setTikzLineWeight(source, "0.8pt");
    case "SET_LINE_WEIGHT_BOLD":
      return setTikzLineWeight(source, "1.2pt");
    case "SET_PRIMARY_LABEL_SIZE_SMALL":
      return setTikzLabelFontSize(source, "PRIMARY", "\\small");
    case "SET_PRIMARY_LABEL_SIZE_NORMAL":
      return setTikzLabelFontSize(source, "PRIMARY", "\\normalsize");
    case "SET_PRIMARY_LABEL_SIZE_LARGE":
      return setTikzLabelFontSize(source, "PRIMARY", "\\large");
    case "SET_SECONDARY_LABEL_SIZE_TINY":
      return setTikzLabelFontSize(source, "SECONDARY", "\\scriptsize");
    case "SET_SECONDARY_LABEL_SIZE_SMALL":
      return setTikzLabelFontSize(source, "SECONDARY", "\\footnotesize");
    case "SET_SECONDARY_LABEL_SIZE_NORMAL":
      return setTikzLabelFontSize(source, "SECONDARY", "\\small");
    case "SCALE_DOWN":
      return setFigureDisplayScale(source, 0.8);
    case "SCALE_UP":
      return setFigureDisplayScale(source, 1.2);
  }
}

const DRAW_COMMANDS = ["\\filldraw", "\\shadedraw", "\\draw", "\\path"] as const;
const DASH_OPTION_PATTERN =
  /^(?:(?:densely|loosely)\s+)?(?:dashed|dotted)$|^dash\s+pattern\s*=/iu;
const LINE_WEIGHT_PATTERN =
  /^(?:ultra\s+thin|very\s+thin|thin|semithick|thick|very\s+thick|ultra\s+thick)$|^line\s+width\s*=/iu;

function isExplicitNumericLabel(content: string) {
  if (!/\d/u.test(content)) return false;
  if (isExplicitLengthMeasurement(content) || isExplicitAngleMeasurement(content)) {
    return false;
  }

  const normalized = content
    .replace(/\\(?:d?frac|tfrac|sqrt|left|right|phantom|vphantom|hphantom)\b/gu, "")
    .replace(/\\[,;:!]/gu, "")
    .replace(/[{}$~\s]/gu, "");
  return normalized.length > 0 && !/[\p{L}]/u.test(normalized);
}

function removeTikzDashedPaths(source: string): StemFigureQuickTransformResult {
  const ranges: SourceRange[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor);
      continue;
    }
    const command = DRAW_COMMANDS.find((candidate) =>
      isCommandStart(source, cursor, candidate),
    );
    if (!command) {
      cursor += 1;
      continue;
    }

    const optionStart = skipInlineWhitespace(source, cursor + command.length);
    if (source[optionStart] !== "[") {
      cursor += command.length;
      continue;
    }
    const optionEnd = readBalancedGroup(source, optionStart);
    const commandEnd = optionEnd === null ? null : findTikzCommandEnd(source, optionEnd);
    if (optionEnd === null || commandEnd === null) {
      cursor += command.length;
      continue;
    }
    const options = splitTopLevelOptions(source.slice(optionStart + 1, optionEnd - 1));
    if (options.some((option) => DASH_OPTION_PATTERN.test(option.trim()))) {
      ranges.push(resolveCommandRemovalRange(source, cursor, commandEnd));
    }
    cursor = commandEnd;
  }

  return applyRanges(source, ranges);
}

function setTikzLineWeight(
  source: string,
  lineWidth: string,
): StemFigureQuickTransformResult {
  const replacements: Array<SourceRange & { value: string }> = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor);
      continue;
    }
    const command = DRAW_COMMANDS.find((candidate) =>
      isCommandStart(source, cursor, candidate),
    );
    if (!command) {
      cursor += 1;
      continue;
    }

    const optionStart = skipInlineWhitespace(source, cursor + command.length);
    if (source[optionStart] === "[") {
      const optionEnd = readBalancedGroup(source, optionStart);
      if (optionEnd === null) {
        cursor += command.length;
        continue;
      }
      const original = source.slice(optionStart + 1, optionEnd - 1);
      const options = splitTopLevelOptions(original).filter(
        (option) => !LINE_WEIGHT_PATTERN.test(option.trim()),
      );
      options.push(`line width=${lineWidth}`);
      const value = `[${options.join(", ")}]`;
      if (value !== source.slice(optionStart, optionEnd)) {
        replacements.push({ end: optionEnd, start: optionStart, value });
      }
      cursor = optionEnd;
      continue;
    }

    replacements.push({
      end: cursor + command.length,
      start: cursor + command.length,
      value: `[line width=${lineWidth}]`,
    });
    cursor += command.length;
  }

  return applyReplacements(source, replacements);
}

function setFigureDisplayScale(
  source: string,
  factor: number,
): StemFigureQuickTransformResult {
  const currentScale =
    readStemFigureDisplayScale(source) ?? STEM_FIGURE_DISPLAY_SCALE_DEFAULT;
  const transformed = writeStemFigureDisplayScale(source, currentScale * factor);
  return { changedCount: transformed === source ? 0 : 1, source: transformed };
}

type LabelRole = "PRIMARY" | "SECONDARY";

const FONT_SIZE_PATTERN =
  /\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/gu;
const ABSOLUTE_FONT_SIZE_PATTERN =
  /\\fontsize\s*\{\s*(\d+(?:\.\d+)?)pt\s*\}\s*\{\s*(\d+(?:\.\d+)?)pt\s*\}\s*\\selectfont/iu;
const NAMED_FONT_SIZE_PATTERN =
  /\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/u;
const LABEL_SCALE_MARKER_PATTERNS: Record<LabelRole, RegExp> = {
  PRIMARY: /^%\s*classhero-primary-label-scale\s*:\s*(\d+(?:\.\d+)?)\s*$/imu,
  SECONDARY: /^%\s*classhero-secondary-label-scale\s*:\s*(\d+(?:\.\d+)?)\s*$/imu,
};
const NAMED_FONT_SIZE_POINTS: Record<string, number> = {
  tiny: 5,
  scriptsize: 7,
  footnotesize: 8,
  small: 9,
  normalsize: 10,
  large: 12,
  Large: 14.4,
  LARGE: 17.28,
  huge: 20.74,
  Huge: 24.88,
};

function readStemFigureLabelScale(source: string, role: LabelRole) {
  const match = source.match(LABEL_SCALE_MARKER_PATTERNS[role]);
  const parsed = Number(match?.[1]);
  return Number.isFinite(parsed)
    ? Math.min(2, Math.max(0.1, parsed))
    : STEM_FIGURE_DISPLAY_SCALE_DEFAULT;
}

function setTikzLabelFontScale(
  source: string,
  role: LabelRole,
  targetScale: number,
): StemFigureQuickTransformResult {
  const currentScale = readStemFigureLabelScale(source, role);
  if (targetScale === currentScale) return { changedCount: 0, source };

  const ratio = targetScale / currentScale;
  const replacements: Array<SourceRange & { value: string }> = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor);
      continue;
    }

    const standalone = isStandaloneNodeStart(source, cursor);
    const inline = !standalone && isInlineNodeStart(source, cursor);
    if (!standalone && !inline) {
      cursor += 1;
      continue;
    }

    const node = parseTikzNode(source, cursor, standalone);
    if (!node) {
      cursor += standalone ? "\\node".length : "node".length;
      continue;
    }

    if (classifyLabelRole(node.content) === role) {
      if (node.optionStart !== null && node.optionEnd !== null) {
        const originalOptions = splitTopLevelOptions(
          source.slice(node.optionStart + 1, node.optionEnd - 1),
        );
        const adjustmentDefinition = originalOptions.find((option) =>
          TEXT_SLOT_ADJUSTMENT_DEFINITION_PATTERN.test(option.trim()),
        );
        const hasAdjustmentActivation = originalOptions.some((option) =>
          TEXT_SLOT_ADJUSTMENT_ACTIVATION_PATTERN.test(option.trim()),
        );
        const options = adjustmentDefinition
          ? originalOptions.filter((option) => {
              const normalized = option.trim();
              return (
                !TEXT_SLOT_ADJUSTMENT_DEFINITION_PATTERN.test(normalized) &&
                !TEXT_SLOT_ADJUSTMENT_ACTIVATION_PATTERN.test(normalized)
              );
            })
          : originalOptions;
        const fontIndex = options.findIndex((option) => /^font\s*=/iu.test(option));
        if (fontIndex >= 0) {
          options[fontIndex] = scaleFontOption(options[fontIndex] ?? "font=", ratio);
        } else {
          options.push(`font=${createAbsoluteFontSize(10 * ratio, 12 * ratio)}`);
        }
        if (adjustmentDefinition) {
          options.push(scaleTextSlotAdjustmentFont(adjustmentDefinition, ratio));
          if (hasAdjustmentActivation) options.push(TEXT_SLOT_ADJUSTMENT_STYLE);
        }
        replacements.push({
          end: node.optionEnd,
          start: node.optionStart,
          value: `[${options.join(", ")}]`,
        });
      } else {
        const commandLength = standalone ? "\\node".length : "node".length;
        replacements.push({
          end: node.start + commandLength,
          start: node.start + commandLength,
          value: `[font=${createAbsoluteFontSize(10 * ratio, 12 * ratio)}]`,
        });
      }
    }
    cursor = node.contentEnd;
  }

  const transformed = applyReplacements(source, replacements);
  if (transformed.changedCount === 0) return transformed;
  return {
    ...transformed,
    source: writeLabelScaleMarker(transformed.source, role, targetScale),
  };
}

function scaleTextSlotAdjustmentFont(option: string, ratio: number) {
  return /(?:^|[,\s{])font\s*=/u.test(option) ? scaleFontOption(option, ratio) : option;
}

function scaleFontOption(option: string, ratio: number) {
  const absolute = option.match(ABSOLUTE_FONT_SIZE_PATTERN);
  if (absolute?.[1] && absolute[2]) {
    return option.replace(
      ABSOLUTE_FONT_SIZE_PATTERN,
      createAbsoluteFontSize(Number(absolute[1]) * ratio, Number(absolute[2]) * ratio),
    );
  }

  const named = option.match(NAMED_FONT_SIZE_PATTERN);
  if (named?.[1]) {
    const size = NAMED_FONT_SIZE_POINTS[named[1]] ?? 10;
    return option.replace(
      NAMED_FONT_SIZE_PATTERN,
      createAbsoluteFontSize(size * ratio, size * 1.2 * ratio),
    );
  }
  return `${option}${createAbsoluteFontSize(10 * ratio, 12 * ratio)}`;
}

function createAbsoluteFontSize(size: number, leading: number) {
  return `\\fontsize{${formatScaleNumber(size)}pt}{${formatScaleNumber(leading)}pt}\\selectfont`;
}

function writeLabelScaleMarker(source: string, role: LabelRole, scale: number) {
  const pattern = LABEL_SCALE_MARKER_PATTERNS[role];
  const markerName =
    role === "PRIMARY"
      ? "classhero-primary-label-scale"
      : "classhero-secondary-label-scale";
  const marker = `% ${markerName}: ${formatScaleNumber(scale)}`;
  if (pattern.test(source)) return source.replace(pattern, marker);

  const rootStart = source.search(/\\begin\{(?:tikzpicture|circuitikz)\}/u);
  if (rootStart < 0) return source;
  const prefix = source.slice(0, rootStart);
  const separator = prefix.length > 0 && !prefix.endsWith("\n") ? "\n" : "";
  return `${prefix}${separator}${marker}\n${source.slice(rootStart)}`;
}

function formatScaleNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function setTikzLabelFontSize(
  source: string,
  role: LabelRole,
  fontSize: string,
): StemFigureQuickTransformResult {
  const replacements: Array<SourceRange & { value: string }> = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor);
      continue;
    }

    const standalone = isStandaloneNodeStart(source, cursor);
    const inline = !standalone && isInlineNodeStart(source, cursor);
    if (!standalone && !inline) {
      cursor += 1;
      continue;
    }

    const node = parseTikzNode(source, cursor, standalone);
    if (!node) {
      cursor += standalone ? "\\node".length : "node".length;
      continue;
    }

    if (classifyLabelRole(node.content) === role) {
      if (node.optionStart !== null && node.optionEnd !== null) {
        const options = splitTopLevelOptions(
          source.slice(node.optionStart + 1, node.optionEnd - 1),
        );
        const fontIndex = options.findIndex((option) => /^font\s*=/iu.test(option));
        if (fontIndex >= 0) {
          const current = options[fontIndex] ?? "";
          FONT_SIZE_PATTERN.lastIndex = 0;
          const hasSize = FONT_SIZE_PATTERN.test(current);
          FONT_SIZE_PATTERN.lastIndex = 0;
          const next = hasSize
            ? current.replace(FONT_SIZE_PATTERN, fontSize)
            : `${current}${fontSize}`;
          FONT_SIZE_PATTERN.lastIndex = 0;
          options[fontIndex] = next;
        } else {
          options.push(`font=${fontSize}`);
        }
        replacements.push({
          end: node.optionEnd,
          start: node.optionStart,
          value: `[${options.join(", ")}]`,
        });
      } else {
        const commandLength = standalone ? "\\node".length : "node".length;
        replacements.push({
          end: node.start + commandLength,
          start: node.start + commandLength,
          value: `[font=${fontSize}]`,
        });
      }
    }
    cursor = node.contentEnd;
  }

  return applyReplacements(source, replacements);
}

function classifyLabelRole(content: string): LabelRole {
  return isExplicitLengthMeasurement(content) ||
    isExplicitAngleMeasurement(content) ||
    isExplicitNumericLabel(content)
    ? "SECONDARY"
    : "PRIMARY";
}

function splitTopLevelOptions(value: string) {
  const options: string[] = [];
  const stack: string[] = [];
  let start = 0;
  let quoted = false;
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

  for (let cursor = 0; cursor < value.length; cursor += 1) {
    const token = value[cursor];
    if (token === '"' && !isEscaped(value, cursor)) quoted = !quoted;
    if (quoted) continue;
    if (token && pairs[token]) stack.push(pairs[token]);
    else if (token === stack.at(-1)) stack.pop();
    else if (token === "," && stack.length === 0) {
      const option = value.slice(start, cursor).trim();
      if (option) options.push(option);
      start = cursor + 1;
    }
  }
  const option = value.slice(start).trim();
  if (option) options.push(option);
  return options;
}

function splitTopLevelOptionRanges(source: string, start: number, end: number) {
  const ranges: SourceRange[] = [];
  const stack: string[] = [];
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  let optionStart = start;
  let quoted = false;

  for (let cursor = start; cursor < end; cursor += 1) {
    const token = source[cursor];
    if (token === '"' && !isEscaped(source, cursor)) quoted = !quoted;
    if (quoted) continue;
    if (token && pairs[token]) stack.push(pairs[token]);
    else if (token === stack.at(-1)) stack.pop();
    else if (token === "," && stack.length === 0) {
      const range = trimSourceRange(source, optionStart, cursor);
      if (range.start < range.end) ranges.push(range);
      optionStart = cursor + 1;
    }
  }

  const range = trimSourceRange(source, optionStart, end);
  if (range.start < range.end) ranges.push(range);
  return ranges;
}

function trimSourceRange(source: string, start: number, end: number): SourceRange {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && /\s/u.test(source[trimmedStart] ?? "")) {
    trimmedStart += 1;
  }
  while (trimmedEnd > trimmedStart && /\s/u.test(source[trimmedEnd - 1] ?? "")) {
    trimmedEnd -= 1;
  }
  return { end: trimmedEnd, start: trimmedStart };
}

function resolveOptionRemovalRange(
  source: string,
  optionContentStart: number,
  optionContentEnd: number,
  itemStart: number,
  itemEnd: number,
): SourceRange {
  let end = itemEnd;
  while (end < optionContentEnd && /\s/u.test(source[end] ?? "")) end += 1;
  if (source[end] === ",") {
    end += 1;
    while (end < optionContentEnd && /\s/u.test(source[end] ?? "")) end += 1;
    return { end, start: itemStart };
  }

  let start = itemStart;
  while (start > optionContentStart && /\s/u.test(source[start - 1] ?? "")) start -= 1;
  if (source[start - 1] === ",") start -= 1;
  return { end: itemEnd, start };
}

function findTikzCommandEnd(source: string, start: number) {
  const stack: string[] = [];
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  for (let cursor = start; cursor < source.length; cursor += 1) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor) - 1;
      continue;
    }
    if (isEscaped(source, cursor)) continue;
    const token = source[cursor];
    if (token && pairs[token]) stack.push(pairs[token]);
    else if (token === stack.at(-1)) stack.pop();
    else if (token === ";" && stack.length === 0) return cursor + 1;
  }
  return null;
}

function resolveCommandRemovalRange(source: string, start: number, end: number) {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const newline = source.indexOf("\n", end);
  const lineEnd = newline === -1 ? source.length : newline;
  if (
    /^[\t ]*$/u.test(source.slice(lineStart, start)) &&
    /^[\t ]*$/u.test(source.slice(end, lineEnd))
  ) {
    return { end: newline === -1 ? lineEnd : newline + 1, start: lineStart };
  }
  return { end, start };
}

function applyRanges(
  source: string,
  ranges: SourceRange[],
): StemFigureQuickTransformResult {
  if (ranges.length === 0) return { changedCount: 0, source };
  let transformed = source;
  for (const range of ranges.slice().reverse()) {
    transformed = transformed.slice(0, range.start) + transformed.slice(range.end);
  }
  return { changedCount: ranges.length, source: transformed.replace(/\n{3,}/gu, "\n\n") };
}

function applyReplacements(
  source: string,
  replacements: Array<SourceRange & { value: string }>,
): StemFigureQuickTransformResult {
  if (replacements.length === 0) return { changedCount: 0, source };
  let transformed = source;
  for (const replacement of replacements.slice().reverse()) {
    transformed =
      transformed.slice(0, replacement.start) +
      replacement.value +
      transformed.slice(replacement.end);
  }
  return { changedCount: replacements.length, source: transformed };
}

function isCommandStart(source: string, start: number, command: string) {
  return (
    source.startsWith(command, start) &&
    !/[A-Za-z@]/u.test(source[start + command.length] ?? "")
  );
}

function skipInlineWhitespace(source: string, start: number) {
  let cursor = start;
  while (/[\t ]/u.test(source[cursor] ?? "")) cursor += 1;
  return cursor;
}

function removeTikzNodeLabels(
  source: string,
  shouldRemove: (content: string) => boolean,
): StemFigureSourceTransformResult {
  const ranges: SourceRange[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor);
      continue;
    }

    const standalone = isStandaloneNodeStart(source, cursor);
    const inline = !standalone && isInlineNodeStart(source, cursor);
    if (!standalone && !inline) {
      cursor += 1;
      continue;
    }

    const node = parseTikzNode(source, cursor, standalone);
    if (!node) {
      cursor += standalone ? "\\node".length : "node".length;
      continue;
    }

    if (shouldRemove(node.content)) {
      ranges.push(resolveRemovalRange(source, node));
    }
    cursor = node.contentEnd;
  }

  if (ranges.length === 0) return { removedCount: 0, source };

  let transformed = source;
  for (const range of ranges.slice().reverse()) {
    transformed = transformed.slice(0, range.start) + transformed.slice(range.end);
  }

  return {
    removedCount: ranges.length,
    source: transformed.replace(/\n{3,}/gu, "\n\n"),
  };
}

function isExplicitAngleMeasurement(content: string) {
  if (!/\d/u.test(content)) return false;

  const normalized = content.replace(/\s/gu, "");
  return (
    /(?:\^\{?\\circ\}?|\\(?:degree|textdegree)\b|°)[}$]*$/iu.test(normalized) ||
    /\\ang\{[^{}]*\d[^{}]*\}[}$]*$/iu.test(normalized) ||
    /\\(?:SI|qty)\{[^{}]*\d[^{}]*\}\{\\(?:degree|arcdegree)\}[}$]*$/u.test(normalized)
  );
}

function removeTikzPicAngleLabels(source: string): StemFigureSourceTransformResult {
  const ranges: SourceRange[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor);
      continue;
    }

    const command = isPicCommandStart(source, cursor);
    const inline = !command && isPicPathOperationStart(source, cursor);
    if (!command && !inline) {
      cursor += 1;
      continue;
    }

    const optionStart = skipWhitespaceAndComments(
      source,
      cursor + (command ? "\\pic".length : "pic".length),
    );
    if (source[optionStart] !== "[") {
      cursor = optionStart;
      continue;
    }
    const optionEnd = readBalancedGroup(source, optionStart);
    if (optionEnd === null) {
      cursor = optionStart + 1;
      continue;
    }

    let optionCursor = optionStart + 1;
    while (optionCursor < optionEnd - 1) {
      if (source[optionCursor] !== '"' || isEscaped(source, optionCursor)) {
        optionCursor += 1;
        continue;
      }
      const quoteEnd = findClosingQuote(source, optionCursor + 1, optionEnd - 1);
      if (quoteEnd === null) break;
      const label = source.slice(optionCursor + 1, quoteEnd);
      if (isExplicitAngleMeasurement(label)) {
        ranges.push(
          resolvePicOptionRemovalRange(
            source,
            optionStart + 1,
            optionEnd - 1,
            optionCursor,
            quoteEnd + 1,
          ),
        );
      }
      optionCursor = quoteEnd + 1;
    }
    cursor = optionEnd;
  }

  if (ranges.length === 0) return { removedCount: 0, source };

  let transformed = source;
  for (const range of ranges.slice().reverse()) {
    transformed = transformed.slice(0, range.start) + transformed.slice(range.end);
  }
  return { removedCount: ranges.length, source: transformed };
}

function resolvePicOptionRemovalRange(
  source: string,
  optionContentStart: number,
  optionContentEnd: number,
  labelStart: number,
  labelEnd: number,
): SourceRange {
  let end = labelEnd;
  while (end < optionContentEnd && /[\t ]/u.test(source[end] ?? "")) end += 1;
  if (source[end] === ",") {
    end += 1;
    while (end < optionContentEnd && /[\t ]/u.test(source[end] ?? "")) end += 1;
    return { end, start: labelStart };
  }

  let start = labelStart;
  while (start > optionContentStart && /[\t ]/u.test(source[start - 1] ?? "")) {
    start -= 1;
  }
  if (source[start - 1] === ",") start -= 1;
  return { end: labelEnd, start };
}

function findClosingQuote(source: string, start: number, end: number) {
  for (let cursor = start; cursor < end; cursor += 1) {
    if (source[cursor] === '"' && !isEscaped(source, cursor)) return cursor;
  }
  return null;
}

function isPicCommandStart(source: string, start: number) {
  return (
    source.startsWith("\\pic", start) &&
    !/[A-Za-z@]/u.test(source[start + "\\pic".length] ?? "")
  );
}

function isPicPathOperationStart(source: string, start: number) {
  if (!source.startsWith("pic", start)) return false;
  const before = source[start - 1] ?? "";
  const after = source[start + "pic".length] ?? "";
  return !/[A-Za-z@\\]/u.test(before) && !/[A-Za-z@]/u.test(after);
}

function isTikzToOperationStart(source: string, start: number) {
  if (!source.startsWith("to", start)) return false;
  const before = source[start - 1] ?? "";
  const after = source[start + "to".length] ?? "";
  return !/[A-Za-z@\\]/u.test(before) && !/[A-Za-z@]/u.test(after);
}

function parseTikzNode(
  source: string,
  start: number,
  standalone: boolean,
): TikzNode | null {
  let cursor = start + (standalone ? "\\node".length : "node".length);
  let optionEnd: number | null = null;
  let optionStart: number | null = null;

  for (let step = 0; step < 12 && cursor < source.length; step += 1) {
    cursor = skipWhitespaceAndComments(source, cursor);
    const token = source[cursor];

    if (token === "[") {
      const parsedOptionEnd = readBalancedGroup(source, cursor);
      if (parsedOptionEnd === null) return null;
      optionStart ??= cursor;
      optionEnd ??= parsedOptionEnd;
      cursor = parsedOptionEnd;
      continue;
    }

    if (token === "(") {
      const coordinateEnd = readBalancedGroup(source, cursor);
      if (coordinateEnd === null) return null;
      cursor = coordinateEnd;
      continue;
    }

    if (startsWord(source, cursor, "at")) {
      cursor += 2;
      continue;
    }

    if (token === "{") {
      const contentEnd = readBalancedGroup(source, cursor);
      if (contentEnd === null) return null;
      const end = standalone ? findStandaloneNodeEnd(source, contentEnd) : contentEnd;
      if (end === null) return null;
      return {
        content: source.slice(cursor + 1, contentEnd - 1),
        contentEnd,
        end,
        optionEnd,
        optionStart,
        standalone,
        start,
      };
    }

    return null;
  }

  return null;
}

function isExplicitLengthMeasurement(content: string) {
  if (/\\(?:vec|overrightarrow|overleftarrow)\b/u.test(content)) return false;

  const normalized = content
    .replace(/\\(?:mathrm|textrm|text|operatorname|mathsf|mathtt|mathbf|mathit)\s*/gu, "")
    .replace(/(?:\\(?:left|right|quad|qquad|enspace|thinspace)\b|\\[,;:!])/gu, "")
    .replace(/[{}$~\s]/gu, "")
    .replaceAll("\\AA", "å")
    .toLocaleLowerCase("vi");
  const unitMatch = normalized.match(LENGTH_UNIT_PATTERN);
  if (!unitMatch?.index) return false;

  const quantity = normalized.slice(0, unitMatch.index);
  if (!/[\p{L}\p{N}]/u.test(quantity)) return false;

  const hasNumber = /\d/u.test(quantity);
  const hasMathExpression = /[+\-=]|\\(?:d?frac|tfrac|sqrt)\b/u.test(content);
  const hasTypesetUnit =
    /\\(?:mathrm|textrm|text)\s*\{\s*(?:dam|mm|cm|dm|hm|km|[µμ]m|nm|pm|in|ft|yd|mi|m|\\AA|Å)\s*\}\s*\$?\s*$/iu.test(
      content,
    );
  const hasSeparatedUnit =
    /(?:\\[,;:]|~|\s)\s*(?:dam|mm|cm|dm|hm|km|[µμ]m|nm|pm|in|ft|yd|mi|m|Å)\s*\$?\s*$/iu.test(
      content,
    );

  if (hasNumber) return true;
  if (unitMatch[1]?.toLocaleLowerCase("vi") === "m") return hasTypesetUnit;
  return hasMathExpression || hasTypesetUnit || hasSeparatedUnit;
}

function resolveRemovalRange(source: string, node: TikzNode): SourceRange {
  if (!node.standalone) {
    let start = node.start;
    while (start > 0 && /[\t ]/u.test(source[start - 1] ?? "")) start -= 1;
    return { end: node.end, start };
  }

  const lineStart = source.lastIndexOf("\n", node.start - 1) + 1;
  const newline = source.indexOf("\n", node.end);
  const lineEnd = newline === -1 ? source.length : newline;
  const before = source.slice(lineStart, node.start);
  const after = source.slice(node.end, lineEnd);
  if (/^[\t ]*$/u.test(before) && /^[\t ]*$/u.test(after)) {
    return { end: newline === -1 ? lineEnd : newline + 1, start: lineStart };
  }
  return { end: node.end, start: node.start };
}

function findStandaloneNodeEnd(source: string, contentEnd: number) {
  const cursor = skipWhitespaceAndComments(source, contentEnd);
  return source[cursor] === ";" ? cursor + 1 : null;
}

function readBalancedGroup(source: string, start: number) {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const opening = source[start];
  if (!opening || !pairs[opening]) return null;
  const stack = [pairs[opening]];

  for (let cursor = start + 1; cursor < source.length; cursor += 1) {
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor) - 1;
      continue;
    }
    if (isEscaped(source, cursor)) continue;
    const token = source[cursor];
    if (token && pairs[token]) {
      stack.push(pairs[token]);
      continue;
    }
    if (token === stack.at(-1)) {
      stack.pop();
      if (stack.length === 0) return cursor + 1;
    }
  }

  return null;
}

function skipWhitespaceAndComments(source: string, start: number) {
  let cursor = start;
  while (cursor < source.length) {
    if (/\s/u.test(source[cursor] ?? "")) {
      cursor += 1;
      continue;
    }
    if (isCommentStart(source, cursor)) {
      cursor = nextLineStart(source, cursor);
      continue;
    }
    break;
  }
  return cursor;
}

function isStandaloneNodeStart(source: string, start: number) {
  return (
    source.startsWith("\\node", start) &&
    !/[A-Za-z@]/u.test(source[start + "\\node".length] ?? "")
  );
}

function isInlineNodeStart(source: string, start: number) {
  if (!source.startsWith("node", start)) return false;
  const before = source[start - 1] ?? "";
  const after = source[start + "node".length] ?? "";
  return !/[A-Za-z@\\]/u.test(before) && !/[A-Za-z@]/u.test(after);
}

function startsWord(source: string, start: number, word: string) {
  if (!source.startsWith(word, start)) return false;
  return !/[A-Za-z@]/u.test(source[start + word.length] ?? "");
}

function isCommentStart(source: string, index: number) {
  return source[index] === "%" && !isEscaped(source, index);
}

function isEscaped(source: string, index: number) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function nextLineStart(source: string, index: number) {
  const newline = source.indexOf("\n", index);
  return newline === -1 ? source.length : newline + 1;
}
