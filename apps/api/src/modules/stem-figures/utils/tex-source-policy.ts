import {
  STEM_FIGURE_MAX_SOURCE_CHARACTERS,
  STEM_FIGURE_TOOLBOX_MANIFEST,
} from "@learning-path/shared";

import type { LessonSummarySubjectKey } from "#api/modules/ai/types/lesson-summary-subject.types";
import { autoRepairMathAnglePics } from "#api/common/ai/tikz-angle-auto-repair";
import { autoRepairTikzLocalHeaderPlacement } from "#api/common/ai/tikz-local-header-auto-repair";
import { autoRepairTikzMidpointMarkerBundles } from "#api/common/ai/tikz-midpoint-marker-auto-repair";
import { autoRepairTikzNarrativeCallouts } from "#api/common/ai/tikz-narrative-callout-auto-repair";

export type TexSourcePolicyIssue = {
  code: string;
  message: string;
};

type EnvironmentToken = {
  kind: "begin" | "end";
  name: string;
  start: number;
  end: number;
  depth: number;
  matchingEnd?: EnvironmentToken;
};

type ParsedGroup = {
  value: string;
  end: number;
};

const DRAWING_ENVIRONMENTS = new Set(["tikzpicture", "circuitikz", "axis"]);
const ROOT_SCOPED_CONFIG_COMMANDS = new Set([
  "tikzset",
  "pgfplotsset",
  "tdplotsetmaincoords",
]);

const FORBIDDEN_PATTERNS: Array<{
  code: string;
  pattern: RegExp;
  message: string;
}> = [
  {
    code: "TEX_DOCUMENT_DECLARATION_FORBIDDEN",
    pattern: /\\documentclass\b/iu,
    message:
      "Snippet không được khai báo documentclass; renderer sở hữu document wrapper.",
  },
  {
    code: "TEX_PACKAGE_DECLARATION_FORBIDDEN",
    pattern: /\\(?:usepackage|RequirePackage)\b/u,
    message: "Snippet không được khai báo package; renderer sở hữu compiler profile.",
  },
  {
    code: "TEX_FONT_CONFIGURATION_FORBIDDEN",
    pattern: /\\setmainfont\b/iu,
    message: "Snippet không được thay đổi font của compiler profile.",
  },
  {
    code: "TEX_SHELL_ESCAPE_FORBIDDEN",
    pattern: /\\(?:write18|immediate\s*\\write18|ShellEscape)\b/iu,
    message: "Không được gọi shell từ TeX source.",
  },
  {
    code: "TEX_EXTERNAL_IO_FORBIDDEN",
    pattern:
      /\\(?:input|include|includegraphics|openin|openout|closein|closeout|newread|newwrite|read|readline|write|usepackagefrom|addbibresource|bibliography)\b/iu,
    message: "Không được đọc hoặc ghi file/asset bên ngoài.",
  },
  {
    code: "TEX_NETWORK_REFERENCE_FORBIDDEN",
    pattern: /(?:https?|ftp|file):\/\//iu,
    message: "TeX source không được chứa URL hoặc file reference.",
  },
  {
    code: "TEX_UNSAFE_LUA_FORBIDDEN",
    pattern: /\\directlua\b|os\.(?:execute|remove|rename)|io\.(?:open|popen)/iu,
    message: "Lua trực tiếp và API hệ điều hành không được phép.",
  },
  {
    code: "TEX_PDF_EMBED_FORBIDDEN",
    pattern: /\\pdf(?:obj|ximage|annot|catalog|names|trailer|extension)\b/iu,
    message: "Không được nhúng PDF object hoặc annotation tùy ý.",
  },
];

export function validateTexSourcePolicy(
  source: string,
  maxSourceBytes = STEM_FIGURE_MAX_SOURCE_CHARACTERS,
  subjectKey: LessonSummarySubjectKey = "GENERAL",
): TexSourcePolicyIssue[] {
  const issues: TexSourcePolicyIssue[] = [];
  if (Buffer.byteLength(source, "utf8") > maxSourceBytes) {
    issues.push({
      code: "TEX_SOURCE_TOO_LARGE",
      message: `TeX source vượt giới hạn ${maxSourceBytes} byte.`,
    });
  }

  const maskedSource = maskTexComments(source);
  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (forbidden.pattern.test(maskedSource)) {
      issues.push({ code: forbidden.code, message: forbidden.message });
    }
  }
  if (/\\(?:begin|end)\s*\{\s*document\s*\}/iu.test(maskedSource)) {
    issues.push({
      code: "TEX_DOCUMENT_WRAPPER_FORBIDDEN",
      message: "Snippet không được chứa begin/end document.",
    });
  }
  if (
    commandGroups(maskedSource, "pgfplotsset").some((group) =>
      /\bcompat\s*=/iu.test(group),
    )
  ) {
    issues.push({
      code: "TEX_PGFPLOTS_COMPAT_FORBIDDEN",
      message: "Snippet không được thay đổi pgfplots compat của compiler profile.",
    });
  }

  const environmentScan = scanEnvironments(maskedSource);
  issues.push(...environmentScan.issues);
  const drawingEnvironments = environmentScan.tokens.filter(
    (token) => token.kind === "begin" && DRAWING_ENVIRONMENTS.has(token.name),
  );
  const drawingRoots = drawingEnvironments.filter((token) => token.depth === 0);
  if (drawingRoots.length === 0) {
    issues.push({
      code: "TEX_ROOT_REQUIRED",
      message: "Snippet phải có đúng một root tikzpicture hoặc circuitikz theo môn.",
    });
    return deduplicateIssues(issues);
  }
  if (drawingRoots.length > 1) {
    issues.push({
      code: "TEX_SINGLE_ROOT_REQUIRED",
      message: "Mỗi snippet chỉ được chứa đúng một root drawing environment.",
    });
  }
  if (drawingEnvironments.some((token) => token.depth > 0 && token.name !== "axis")) {
    issues.push({
      code: "TEX_SINGLE_ROOT_REQUIRED",
      message: "Không được lồng thêm tikzpicture hoặc circuitikz bên trong root figure.",
    });
  }

  const root = drawingRoots[0]!;
  if (root.name === "axis" && root.depth === 0) {
    issues.push({
      code: "TEX_AXIS_ROOT_FORBIDDEN",
      message: "axis chỉ được là environment con bên trong tikzpicture.",
    });
  }
  const profile = STEM_FIGURE_TOOLBOX_MANIFEST.subjects[subjectKey];
  if (!profile.rootEnvironments.includes(root.name)) {
    issues.push({
      code: "TEX_ROOT_NOT_ALLOWED_FOR_SUBJECT",
      message: `Root ${root.name} không được phép trong profile môn ${subjectKey}.`,
    });
  }

  issues.push(...validateHeader(maskedSource.slice(0, root.start), subjectKey));
  for (const commandName of profile.headerCommands) {
    if (ROOT_SCOPED_CONFIG_COMMANDS.has(commandName)) continue;
    const occurrences = findControlSequencePositions(maskedSource, commandName);
    if (occurrences.some((position) => position >= root.start)) {
      issues.push({
        code: "TEX_HEADER_COMMAND_POSITION_INVALID",
        message: `Lệnh \\${commandName} phải nằm trong local header trước root drawing environment.`,
      });
    }
  }

  if (root.matchingEnd) {
    const trailing = maskedSource
      .slice(root.matchingEnd.end)
      .replace(/^\uFEFF/u, "")
      .trim();
    if (trailing.length > 0) {
      issues.push({
        code: "TEX_TRAILING_CONTENT_FORBIDDEN",
        message: "Sau root drawing environment chỉ được có comment hoặc khoảng trắng.",
      });
    }
  }

  return deduplicateIssues(issues);
}

export function autoRepairStemFigureLatexSource(input: {
  source: string;
  subjectKey: LessonSummarySubjectKey;
  mode:
    | "REGENERATE_FROM_SOURCE"
    | "EDIT_CURRENT_SOURCE"
    | "GENERATE_FROM_BLOCK"
    | "GENERATE_SOLUTION_FROM_BLOCK"
    | "REPAIR";
  authorityText: string;
}) {
  const localHeader = autoRepairTikzLocalHeaderPlacement(input.source);
  const narrative = autoRepairTikzNarrativeCallouts(localHeader.source);
  if (
    input.subjectKey !== "MATH" ||
    (input.mode !== "GENERATE_FROM_BLOCK" &&
      input.mode !== "GENERATE_SOLUTION_FROM_BLOCK")
  ) {
    return {
      source: narrative.source,
      changes: [...localHeader.changes, ...narrative.changes],
    };
  }
  const angles = autoRepairMathAnglePics({
    source: narrative.source,
    authorityText: input.authorityText,
  });
  const midpointMarkers = autoRepairTikzMidpointMarkerBundles({
    source: angles.source,
    authorityText: input.authorityText,
  });
  return {
    source: midpointMarkers.source,
    changes: [
      ...localHeader.changes,
      ...narrative.changes,
      ...angles.changes,
      ...midpointMarkers.changes,
    ],
  };
}

export function maskTexComments(source: string) {
  const characters = source.split("");
  let index = 0;
  while (index < characters.length) {
    if (characters[index] !== "%" || isEscaped(characters, index)) {
      index += 1;
      continue;
    }
    while (index < characters.length && characters[index] !== "\n") {
      characters[index] = " ";
      index += 1;
    }
  }
  return characters.join("");
}

function validateHeader(source: string, subjectKey: LessonSummarySubjectKey) {
  const issues: TexSourcePolicyIssue[] = [];
  const profile = STEM_FIGURE_TOOLBOX_MANIFEST.subjects[subjectKey];
  let position = skipWhitespace(source, 0);
  if (source.codePointAt(position) === 0xfeff)
    position = skipWhitespace(source, position + 1);

  while (position < source.length) {
    const controlSequence = readControlSequence(source, position);
    if (!controlSequence || !profile.headerCommands.includes(controlSequence.name)) {
      issues.push({
        code: "TEX_HEADER_COMMAND_NOT_ALLOWED",
        message:
          "Local header chỉ được chứa comment, usetikzlibrary, usepgfplotslibrary, tikzset, pgfplotsset hoặc tdplotsetmaincoords theo profile môn.",
      });
      break;
    }

    const expectedArguments = controlSequence.name === "tdplotsetmaincoords" ? 2 : 1;
    const argumentsRead: string[] = [];
    let cursor = controlSequence.end;
    for (let argumentIndex = 0; argumentIndex < expectedArguments; argumentIndex += 1) {
      cursor = skipWhitespace(source, cursor);
      const group = readBalancedGroup(source, cursor);
      if (!group) {
        issues.push({
          code: "TEX_HEADER_ARGUMENT_INVALID",
          message: `Lệnh \\${controlSequence.name} thiếu đối số ngoặc nhọn cân bằng.`,
        });
        return issues;
      }
      argumentsRead.push(group.value);
      cursor = group.end;
    }

    if (controlSequence.name === "usetikzlibrary") {
      issues.push(
        ...validateLibraryNames(
          argumentsRead[0] ?? "",
          profile.tikzLibraries,
          "TikZ",
          subjectKey,
        ),
      );
    }
    if (controlSequence.name === "usepgfplotslibrary") {
      issues.push(
        ...validateLibraryNames(
          argumentsRead[0] ?? "",
          profile.pgfplotsLibraries,
          "PGFPlots",
          subjectKey,
        ),
      );
    }
    if (
      controlSequence.name === "pgfplotsset" &&
      /\bcompat\s*=/iu.test(argumentsRead[0] ?? "")
    ) {
      issues.push({
        code: "TEX_PGFPLOTS_COMPAT_FORBIDDEN",
        message: "Snippet không được thay đổi pgfplots compat của compiler profile.",
      });
    }
    position = skipWhitespace(source, cursor);
  }
  return issues;
}

function validateLibraryNames(
  value: string,
  allowedLibraries: string[],
  libraryKind: string,
  subjectKey: LessonSummarySubjectKey,
) {
  const allowed = new Set(allowedLibraries);
  const names = value.split(",").map((name) => name.trim());
  if (names.some((name) => name.length === 0)) {
    return [
      {
        code: "TEX_LIBRARY_NAME_INVALID",
        message: `Danh sách ${libraryKind} library chứa tên rỗng.`,
      },
    ];
  }
  return names.flatMap((name) =>
    allowed.has(name)
      ? []
      : [
          {
            code: "TEX_LIBRARY_NOT_ALLOWED_FOR_SUBJECT",
            message: `${libraryKind} library ${name} không được phép trong profile môn ${subjectKey}.`,
          },
        ],
  );
}

function scanEnvironments(source: string) {
  const issues: TexSourcePolicyIssue[] = [];
  const tokens: EnvironmentToken[] = [];
  const stack: EnvironmentToken[] = [];
  let position = 0;

  while (position < source.length) {
    const slash = source.indexOf("\\", position);
    if (slash < 0) break;
    const controlSequence = readControlSequence(source, slash);
    position = controlSequence?.end ?? slash + 1;
    if (
      !controlSequence ||
      (controlSequence.name !== "begin" && controlSequence.name !== "end")
    ) {
      continue;
    }
    const group = readBalancedGroup(source, skipWhitespace(source, controlSequence.end));
    if (!group) {
      issues.push({
        code: "TEX_ENVIRONMENT_UNBALANCED",
        message: `Lệnh \\${controlSequence.name} thiếu tên environment cân bằng.`,
      });
      continue;
    }
    const name = group.value.trim();
    const token: EnvironmentToken = {
      kind: controlSequence.name,
      name,
      start: slash,
      end: group.end,
      depth:
        controlSequence.name === "begin" ? stack.length : Math.max(0, stack.length - 1),
    };
    tokens.push(token);
    position = group.end;
    if (token.kind === "begin") {
      stack.push(token);
      continue;
    }
    const opening = stack.pop();
    if (!opening || opening.name !== token.name) {
      issues.push({
        code: "TEX_ENVIRONMENT_UNBALANCED",
        message: `Environment ${token.name || "không tên"} đóng/mở không cân bằng.`,
      });
      continue;
    }
    opening.matchingEnd = token;
  }

  for (const opening of stack) {
    issues.push({
      code: "TEX_ENVIRONMENT_UNBALANCED",
      message: `Environment ${opening.name || "không tên"} chưa được đóng.`,
    });
  }
  return { tokens, issues };
}

function commandGroups(source: string, commandName: string) {
  return findControlSequencePositions(source, commandName).flatMap((position) => {
    const controlSequence = readControlSequence(source, position);
    if (!controlSequence) return [];
    const group = readBalancedGroup(source, skipWhitespace(source, controlSequence.end));
    return group ? [group.value] : [];
  });
}

function findControlSequencePositions(source: string, commandName: string) {
  const positions: number[] = [];
  let position = 0;
  while (position < source.length) {
    const slash = source.indexOf("\\", position);
    if (slash < 0) break;
    const controlSequence = readControlSequence(source, slash);
    position = controlSequence?.end ?? slash + 1;
    if (controlSequence?.name === commandName) positions.push(slash);
  }
  return positions;
}

function readControlSequence(source: string, position: number) {
  if (source[position] !== "\\") return null;
  let end = position + 1;
  while (end < source.length && /[A-Za-z@]/u.test(source[end] ?? "")) end += 1;
  if (end === position + 1) return null;
  return { name: source.slice(position + 1, end), end };
}

function readBalancedGroup(source: string, position: number): ParsedGroup | null {
  if (source[position] !== "{") return null;
  let depth = 0;
  for (let index = position; index < source.length; index += 1) {
    const character = source[index];
    if ((character === "{" || character === "}") && isEscaped(source, index)) continue;
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) {
      return { value: source.slice(position + 1, index), end: index + 1 };
    }
  }
  return null;
}

function skipWhitespace(source: string, position: number) {
  let cursor = position;
  while (cursor < source.length && /\s/u.test(source[cursor] ?? "")) cursor += 1;
  return cursor;
}

function isEscaped(source: string | string[], position: number) {
  let backslashCount = 0;
  for (let index = position - 1; index >= 0 && source[index] === "\\"; index -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function deduplicateIssues(issues: TexSourcePolicyIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}\u0000${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
