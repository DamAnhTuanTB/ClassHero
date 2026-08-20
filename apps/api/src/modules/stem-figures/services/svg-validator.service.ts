import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SaxesParser } from "saxes";

import type { EnvConfig } from "#api/config/env.validation";
import type {
  SvgValidationIssue,
  SvgValidationResult,
} from "#api/modules/stem-figures/types/tex-renderer.types";

export const STEM_FIGURE_VALIDATOR_VERSION = "stem-svg-validator-v1";

const ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "defs",
  "clipPath",
  "mask",
  "marker",
  "symbol",
  "use",
]);
const ALLOWED_ATTRIBUTES = new Set([
  "id",
  "class",
  "viewBox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "transform",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "clip-path",
  "mask",
  "marker-start",
  "marker-mid",
  "marker-end",
  "preserveAspectRatio",
  "xmlns",
  "xmlns:xlink",
  "version",
  "role",
  "aria-label",
  "href",
  "xlink:href",
]);
const URL_BEARING_ATTRIBUTES = new Set([
  "href",
  "xlink:href",
  "fill",
  "stroke",
  "clip-path",
  "mask",
  "marker-start",
  "marker-mid",
  "marker-end",
]);
const FINITE_NUMBER_PATTERN = /(?:^|[^A-Za-z])(?:NaN|[+-]?Infinity)(?:$|[^A-Za-z])/iu;
const EXTERNAL_REFERENCE_PATTERN = /(?:https?|ftp|file|data):|^\/\//iu;
const URL_FUNCTION_PATTERN = /url\(([^)]+)\)/giu;

@Injectable()
export class SvgValidatorService {
  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  validate(svg: string): SvgValidationResult {
    const issues: SvgValidationIssue[] = [];
    const maxBytes = this.config.get("TEX_RENDER_MAX_SVG_BYTES", { infer: true });
    const maxNodes = this.config.get("TEX_RENDER_MAX_SVG_NODES", { infer: true });
    const maxPathCharacters = this.config.get("TEX_RENDER_MAX_PATH_CHARACTERS", {
      infer: true,
    });

    if (Buffer.byteLength(svg, "utf8") > maxBytes) {
      issues.push(issue("SVG_TOO_LARGE", `SVG vượt giới hạn ${maxBytes} byte.`));
    }
    if (/<!DOCTYPE|<!ENTITY/iu.test(svg)) {
      issues.push(issue("SVG_DTD_FORBIDDEN", "SVG không được chứa DTD hoặc entity."));
    }
    if (/<(?:script|foreignObject|iframe|object|embed|image|audio|video)\b/iu.test(svg)) {
      issues.push(
        issue("SVG_EXECUTABLE_CONTENT", "SVG chứa phần tử thực thi hoặc asset nhúng."),
      );
    }
    if (FINITE_NUMBER_PATTERN.test(svg)) {
      issues.push(issue("SVG_NON_FINITE_NUMBER", "SVG chứa NaN hoặc Infinity."));
    }

    let rootSeen = false;
    let viewBox: [number, number, number, number] | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let nodeCount = 0;
    let pathCharacters = 0;
    let parsingFailed = false;
    const parser = new SaxesParser({ xmlns: false });
    parser.on("doctype", () => {
      issues.push(issue("SVG_DTD_FORBIDDEN", "SVG không được chứa DTD."));
    });
    parser.on("processinginstruction", ({ target }) => {
      if (target.toLowerCase() !== "xml") {
        issues.push(
          issue(
            "SVG_PROCESSING_INSTRUCTION",
            "SVG không được chứa processing instruction.",
          ),
        );
      }
    });
    parser.on("opentag", (tag) => {
      nodeCount += 1;
      const elementName = tag.name;
      if (!ALLOWED_ELEMENTS.has(elementName)) {
        issues.push(
          issue("SVG_ELEMENT_FORBIDDEN", `SVG element <${elementName}> không được phép.`),
        );
      }
      if (!rootSeen) {
        rootSeen = true;
        if (elementName !== "svg") {
          issues.push(issue("SVG_ROOT_REQUIRED", "Root element phải là <svg>."));
        }
      }
      for (const [name, rawAttribute] of Object.entries(tag.attributes)) {
        const value = String(rawAttribute);
        if (/^on/iu.test(name)) {
          issues.push(
            issue(
              "SVG_EVENT_HANDLER_FORBIDDEN",
              `Event handler ${name} không được phép.`,
            ),
          );
          continue;
        }
        if (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith("aria-")) {
          issues.push(
            issue("SVG_ATTRIBUTE_FORBIDDEN", `SVG attribute ${name} không được phép.`),
          );
        }
        if (name === "d") pathCharacters += value.length;
        if (URL_BEARING_ATTRIBUTES.has(name) && hasUnsafeReference(name, value)) {
          issues.push(
            issue(
              "SVG_EXTERNAL_REFERENCE",
              `SVG attribute ${name} tham chiếu asset ngoài.`,
            ),
          );
        }
        if (elementName === "svg" && name === "viewBox") viewBox = parseViewBox(value);
        if (elementName === "svg" && name === "width") width = parseDimension(value);
        if (elementName === "svg" && name === "height") height = parseDimension(value);
      }
    });
    parser.on("error", (error) => {
      parsingFailed = true;
      issues.push(issue("SVG_XML_INVALID", error.message));
    });
    try {
      parser.write(svg).close();
    } catch (error) {
      parsingFailed = true;
      issues.push(
        issue(
          "SVG_XML_INVALID",
          error instanceof Error ? error.message : "SVG XML không hợp lệ.",
        ),
      );
    }

    if (!rootSeen && !parsingFailed) {
      issues.push(issue("SVG_EMPTY", "SVG không có root element."));
    }
    const resolvedViewBox = viewBox as [number, number, number, number] | null;
    if (!resolvedViewBox) {
      issues.push(issue("SVG_VIEWBOX_INVALID", "SVG cần viewBox hữu hạn và dương."));
    } else if (
      resolvedViewBox[2] <= 0 ||
      resolvedViewBox[3] <= 0 ||
      resolvedViewBox.some(
        (value) => !Number.isFinite(value) || Math.abs(value) > 1_000_000,
      )
    ) {
      issues.push(issue("SVG_VIEWBOX_INVALID", "SVG viewBox vượt giới hạn an toàn."));
    }
    if (nodeCount > maxNodes) {
      issues.push(issue("SVG_NODE_LIMIT", `SVG vượt giới hạn ${maxNodes} node.`));
    }
    if (pathCharacters > maxPathCharacters) {
      issues.push(
        issue("SVG_PATH_LIMIT", `SVG path vượt giới hạn ${maxPathCharacters} ký tự.`),
      );
    }

    const uniqueIssues = deduplicateIssues(issues);
    if (uniqueIssues.length > 0 || !resolvedViewBox) {
      return {
        ok: false,
        issues: uniqueIssues,
        validatorVersion: STEM_FIGURE_VALIDATOR_VERSION,
      };
    }

    const sanitizedSvg = sanitizeSvg(svg);
    try {
      new SaxesParser({ xmlns: false }).write(sanitizedSvg).close();
    } catch (error) {
      return {
        ok: false,
        issues: [
          issue(
            "SVG_SANITIZED_XML_INVALID",
            error instanceof Error
              ? error.message
              : "SVG sau sanitize không còn là XML hợp lệ.",
          ),
        ],
        validatorVersion: STEM_FIGURE_VALIDATOR_VERSION,
      };
    }
    return {
      ok: true,
      sanitizedSvg,
      sha256: createHash("sha256").update(sanitizedSvg).digest("hex"),
      width,
      height,
      viewBox: resolvedViewBox,
      nodeCount,
      validatorVersion: STEM_FIGURE_VALIDATOR_VERSION,
    };
  }
}

function sanitizeSvg(svg: string) {
  return svg
    .replace(/<\?xml[^>]*\?>/giu, "")
    .replace(/<!--([\s\S]*?)-->/gu, "")
    .trim();
}

function parseViewBox(value: string): [number, number, number, number] | null {
  const values = value
    .trim()
    .split(/[\s,]+/u)
    .map(Number);
  return values.length === 4 && values.every(Number.isFinite)
    ? [values[0]!, values[1]!, values[2]!, values[3]!]
    : null;
}

function parseDimension(value: string) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(?:pt|px|cm|mm|in)?$/iu);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hasUnsafeReference(name: string, value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/gu, "");
  if ((name === "href" || name === "xlink:href") && !trimmed.startsWith("#")) {
    return true;
  }
  if (EXTERNAL_REFERENCE_PATTERN.test(trimmed)) return true;
  return [...trimmed.matchAll(URL_FUNCTION_PATTERN)].some(
    (match) =>
      !match[1]
        ?.trim()
        .replace(/^['"]|['"]$/gu, "")
        .startsWith("#"),
  );
}

function issue(code: string, message: string): SvgValidationIssue {
  return { code, message: message.slice(0, 500), repairableBySource: true };
}

function deduplicateIssues(issues: SvgValidationIssue[]) {
  return issues.filter(
    (candidate, index) =>
      issues.findIndex(
        (issue) => issue.code === candidate.code && issue.message === candidate.message,
      ) === index,
  );
}
