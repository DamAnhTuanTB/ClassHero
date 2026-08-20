import { readFile } from "node:fs/promises";

export const stemFigureToolboxManifest = await loadToolboxManifest();
export const compilerProfileVersion = stemFigureToolboxManifest.version;

const drawingEnvironments = new Set(["tikzpicture", "circuitikz", "axis"]);
const rootScopedConfigCommands = new Set([
  "tikzset",
  "pgfplotsset",
  "tdplotsetmaincoords",
]);

const forbiddenPatterns = [
  [
    "TEX_DOCUMENT_DECLARATION_FORBIDDEN",
    /\\documentclass\b/iu,
    "Snippet must not declare documentclass; the renderer owns the document wrapper.",
  ],
  [
    "TEX_PACKAGE_DECLARATION_FORBIDDEN",
    /\\(?:usepackage|RequirePackage)\b/u,
    "Snippet must not declare packages; the renderer owns the compiler profile.",
  ],
  [
    "TEX_FONT_CONFIGURATION_FORBIDDEN",
    /\\setmainfont\b/iu,
    "Snippet must not change the compiler-profile font.",
  ],
  [
    "TEX_SHELL_ESCAPE_FORBIDDEN",
    /\\(?:write18|immediate\s*\\write18|ShellEscape)\b/iu,
    "Shell commands are forbidden.",
  ],
  [
    "TEX_EXTERNAL_IO_FORBIDDEN",
    /\\(?:input|include|includegraphics|openin|openout|closein|closeout|newread|newwrite|read|readline|write|usepackagefrom|addbibresource|bibliography)\b/iu,
    "External file I/O is forbidden.",
  ],
  [
    "TEX_NETWORK_REFERENCE_FORBIDDEN",
    /(?:https?|ftp|file):\/\//iu,
    "Network and file URLs are forbidden.",
  ],
  [
    "TEX_UNSAFE_LUA_FORBIDDEN",
    /\\directlua\b|os\.(?:execute|remove|rename)|io\.(?:open|popen)/iu,
    "Direct Lua and operating-system APIs are forbidden.",
  ],
  [
    "TEX_PDF_EMBED_FORBIDDEN",
    /\\pdf(?:obj|ximage|annot|catalog|names|trailer|extension)\b/iu,
    "Arbitrary PDF objects and annotations are forbidden.",
  ],
];

export function normalizeSubjectKey(value) {
  return typeof value === "string" &&
    Object.hasOwn(stemFigureToolboxManifest.subjects, value)
    ? value
    : "GENERAL";
}

export function validateTexSourcePolicy(source, subjectKey, maxSourceBytes) {
  const issues = [];
  if (Buffer.byteLength(source, "utf8") > maxSourceBytes) {
    issues.push(issue("TEX_SOURCE_TOO_LARGE", `Source exceeds ${maxSourceBytes} bytes.`));
  }
  const maskedSource = maskTexComments(source);
  for (const [code, pattern, message] of forbiddenPatterns) {
    if (pattern.test(maskedSource)) issues.push(issue(code, message));
  }
  if (/\\(?:begin|end)\s*\{\s*document\s*\}/iu.test(maskedSource)) {
    issues.push(
      issue(
        "TEX_DOCUMENT_WRAPPER_FORBIDDEN",
        "Snippet must not contain begin/end document.",
      ),
    );
  }
  if (
    commandGroups(maskedSource, "pgfplotsset").some((group) =>
      /\bcompat\s*=/iu.test(group),
    )
  ) {
    issues.push(
      issue("TEX_PGFPLOTS_COMPAT_FORBIDDEN", "Snippet must not change pgfplots compat."),
    );
  }

  const environmentScan = scanEnvironments(maskedSource);
  issues.push(...environmentScan.issues);
  const allDrawingEnvironments = environmentScan.tokens.filter(
    (token) => token.kind === "begin" && drawingEnvironments.has(token.name),
  );
  const roots = allDrawingEnvironments.filter((token) => token.depth === 0);
  if (roots.length === 0) {
    issues.push(
      issue("TEX_ROOT_REQUIRED", "Snippet must have one subject-allowed drawing root."),
    );
    return deduplicateIssues(issues);
  }
  if (roots.length > 1) {
    issues.push(
      issue("TEX_SINGLE_ROOT_REQUIRED", "Snippet must have exactly one drawing root."),
    );
  }
  if (allDrawingEnvironments.some((token) => token.depth > 0 && token.name !== "axis")) {
    issues.push(
      issue(
        "TEX_SINGLE_ROOT_REQUIRED",
        "Nested tikzpicture/circuitikz roots are forbidden.",
      ),
    );
  }

  const root = roots[0];
  if (root.name === "axis") {
    issues.push(
      issue("TEX_AXIS_ROOT_FORBIDDEN", "axis must be nested inside tikzpicture."),
    );
  }
  const profile = stemFigureToolboxManifest.subjects[subjectKey];
  if (!profile.rootEnvironments.includes(root.name)) {
    issues.push(
      issue(
        "TEX_ROOT_NOT_ALLOWED_FOR_SUBJECT",
        `Root ${root.name} is not allowed for subject ${subjectKey}.`,
      ),
    );
  }
  issues.push(...validateHeader(maskedSource.slice(0, root.start), subjectKey));
  for (const commandName of profile.headerCommands) {
    if (rootScopedConfigCommands.has(commandName)) continue;
    if (
      findControlSequencePositions(maskedSource, commandName).some(
        (position) => position >= root.start,
      )
    ) {
      issues.push(
        issue(
          "TEX_HEADER_COMMAND_POSITION_INVALID",
          `Command \\${commandName} must appear before the drawing root.`,
        ),
      );
    }
  }
  if (root.matchingEnd && maskedSource.slice(root.matchingEnd.end).trim().length > 0) {
    issues.push(
      issue(
        "TEX_TRAILING_CONTENT_FORBIDDEN",
        "Only comments and whitespace may follow the drawing root.",
      ),
    );
  }
  return deduplicateIssues(issues);
}

export function buildCompilerEnvelope(subjectKey) {
  const profile = stemFigureToolboxManifest.subjects[subjectKey];
  return [
    String.raw`\documentclass[tikz,border=6pt]{standalone}`,
    ...profile.packages.map(({ name, options }) =>
      options
        ? String.raw`\usepackage[${options}]{${name}}`
        : String.raw`\usepackage{${name}}`,
    ),
    profile.tikzLibraries.length > 0
      ? String.raw`\usetikzlibrary{${profile.tikzLibraries.join(",")}}`
      : null,
    profile.pgfplotsLibraries.length > 0
      ? String.raw`\usepgfplotslibrary{${profile.pgfplotsLibraries.join(",")}}`
      : null,
    ...profile.rootEnvironments.map(
      (environment) => String.raw`\standaloneenv{${environment}}`,
    ),
    ...profile.compilerDeclarations,
    String.raw`\begin{document}`,
    String.raw`\input{fragment.tex}`,
    String.raw`\end{document}`,
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function validateHeader(source, subjectKey) {
  const issues = [];
  const profile = stemFigureToolboxManifest.subjects[subjectKey];
  let position = skipWhitespace(source, 0);
  if (source.codePointAt(position) === 0xfeff)
    position = skipWhitespace(source, position + 1);
  while (position < source.length) {
    const controlSequence = readControlSequence(source, position);
    if (!controlSequence || !profile.headerCommands.includes(controlSequence.name)) {
      issues.push(
        issue(
          "TEX_HEADER_COMMAND_NOT_ALLOWED",
          "Local header contains a command outside the subject toolbox.",
        ),
      );
      break;
    }
    const expectedArguments = controlSequence.name === "tdplotsetmaincoords" ? 2 : 1;
    const argumentsRead = [];
    let cursor = controlSequence.end;
    for (let argumentIndex = 0; argumentIndex < expectedArguments; argumentIndex += 1) {
      cursor = skipWhitespace(source, cursor);
      const group = readBalancedGroup(source, cursor);
      if (!group) {
        issues.push(
          issue(
            "TEX_HEADER_ARGUMENT_INVALID",
            `Command \\${controlSequence.name} has an unbalanced or missing argument.`,
          ),
        );
        return issues;
      }
      argumentsRead.push(group.value);
      cursor = group.end;
    }
    if (controlSequence.name === "usetikzlibrary") {
      issues.push(
        ...validateLibraries(argumentsRead[0], profile.tikzLibraries, "TikZ", subjectKey),
      );
    }
    if (controlSequence.name === "usepgfplotslibrary") {
      issues.push(
        ...validateLibraries(
          argumentsRead[0],
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
      issues.push(
        issue(
          "TEX_PGFPLOTS_COMPAT_FORBIDDEN",
          "Snippet must not change pgfplots compat.",
        ),
      );
    }
    position = skipWhitespace(source, cursor);
  }
  return issues;
}

function validateLibraries(value, allowedLibraries, kind, subjectKey) {
  const allowed = new Set(allowedLibraries);
  const names = String(value ?? "")
    .split(",")
    .map((name) => name.trim());
  if (names.some((name) => name.length === 0)) {
    return [
      issue("TEX_LIBRARY_NAME_INVALID", `${kind} library list contains an empty name.`),
    ];
  }
  return names.flatMap((name) =>
    allowed.has(name)
      ? []
      : [
          issue(
            "TEX_LIBRARY_NOT_ALLOWED_FOR_SUBJECT",
            `${kind} library ${name} is not allowed for subject ${subjectKey}.`,
          ),
        ],
  );
}

function scanEnvironments(source) {
  const issues = [];
  const tokens = [];
  const stack = [];
  let position = 0;
  while (position < source.length) {
    const slash = source.indexOf("\\", position);
    if (slash < 0) break;
    const controlSequence = readControlSequence(source, slash);
    position = controlSequence?.end ?? slash + 1;
    if (!controlSequence || !["begin", "end"].includes(controlSequence.name)) continue;
    const group = readBalancedGroup(source, skipWhitespace(source, controlSequence.end));
    if (!group) {
      issues.push(
        issue(
          "TEX_ENVIRONMENT_UNBALANCED",
          `Command \\${controlSequence.name} has no environment name.`,
        ),
      );
      continue;
    }
    const token = {
      kind: controlSequence.name,
      name: group.value.trim(),
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
      issues.push(
        issue("TEX_ENVIRONMENT_UNBALANCED", `Environment ${token.name} is not balanced.`),
      );
      continue;
    }
    opening.matchingEnd = token;
  }
  for (const opening of stack) {
    issues.push(
      issue("TEX_ENVIRONMENT_UNBALANCED", `Environment ${opening.name} is not closed.`),
    );
  }
  return { tokens, issues };
}

function maskTexComments(source) {
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

function commandGroups(source, commandName) {
  return findControlSequencePositions(source, commandName).flatMap((position) => {
    const controlSequence = readControlSequence(source, position);
    const group = controlSequence
      ? readBalancedGroup(source, skipWhitespace(source, controlSequence.end))
      : null;
    return group ? [group.value] : [];
  });
}

function findControlSequencePositions(source, commandName) {
  const positions = [];
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

function readControlSequence(source, position) {
  if (source[position] !== "\\") return null;
  let end = position + 1;
  while (end < source.length && /[A-Za-z@]/u.test(source[end] ?? "")) end += 1;
  return end === position + 1 ? null : { name: source.slice(position + 1, end), end };
}

function readBalancedGroup(source, position) {
  if (source[position] !== "{") return null;
  let depth = 0;
  for (let index = position; index < source.length; index += 1) {
    const character = source[index];
    if ((character === "{" || character === "}") && isEscaped(source, index)) continue;
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return { value: source.slice(position + 1, index), end: index + 1 };
  }
  return null;
}

function skipWhitespace(source, position) {
  let cursor = position;
  while (cursor < source.length && /\s/u.test(source[cursor] ?? "")) cursor += 1;
  return cursor;
}

function isEscaped(source, position) {
  let count = 0;
  for (let index = position - 1; index >= 0 && source[index] === "\\"; index -= 1)
    count += 1;
  return count % 2 === 1;
}

function issue(code, message) {
  return { code, message };
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((item) => {
    const key = `${item.code}\u0000${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadToolboxManifest() {
  const configuredPath = process.env.TEX_TOOLBOX_MANIFEST_PATH;
  const candidates = [
    configuredPath ? new URL(`file://${configuredPath}`) : null,
    new URL("./stem-figure-toolbox-manifest.json", import.meta.url),
    new URL(
      "../../../packages/shared/src/constants/stem-figure-toolbox-manifest.json",
      import.meta.url,
    ),
  ].filter(Boolean);
  let lastError;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(await readFile(candidate, "utf8"));
      assertToolboxManifest(parsed);
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("STEM figure toolbox manifest was not found.");
}

function assertToolboxManifest(value) {
  if (!value || typeof value.version !== "string" || !value.subjects) {
    throw new Error("STEM figure toolbox manifest is invalid.");
  }
  for (const key of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"]) {
    const profile = value.subjects[key];
    if (
      !profile ||
      !Array.isArray(profile.rootEnvironments) ||
      !Array.isArray(profile.headerCommands) ||
      !Array.isArray(profile.packages) ||
      !Array.isArray(profile.tikzLibraries) ||
      !Array.isArray(profile.pgfplotsLibraries) ||
      !Array.isArray(profile.compilerDeclarations)
    ) {
      throw new Error(`STEM figure toolbox profile ${key} is invalid.`);
    }
  }
}
