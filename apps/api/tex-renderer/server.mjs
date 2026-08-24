import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import {
  buildCompilerEnvelope,
  compilerProfileVersion,
  normalizeSubjectKey,
  validateTexSourcePolicy,
} from "./tex-source-policy.mjs";

const port = readPositiveInteger(process.env.TEX_RENDERER_PORT, 8080);
const token = process.env.TEX_RENDERER_TOKEN ?? "";
const timeoutMs = readPositiveInteger(process.env.TEX_RENDER_TIMEOUT_MS, 20_000);
const renderConcurrency = readPositiveInteger(process.env.TEX_RENDER_CONCURRENCY, 1);
const maxSourceBytes = readPositiveInteger(
  process.env.TEX_RENDER_MAX_SOURCE_BYTES,
  40_000,
);
const maxSvgBytes = readPositiveInteger(process.env.TEX_RENDER_MAX_SVG_BYTES, 2_000_000);
const rendererVersion = process.env.TEX_RENDERER_VERSION ?? "texlive-debian-v3-snippet";
const texmfCache =
  process.env.TEXMFCACHE?.trim() || join(tmpdir(), "tex-renderer-texmf-cache");
const texmfCacheSeed = process.env.TEXMF_CACHE_SEED?.trim() || "";
const renderLimiter = createConcurrencyLimiter(renderConcurrency);

if (token.length < 16) {
  throw new Error("TEX_RENDERER_TOKEN must contain at least 16 characters.");
}

await prepareTexmfCache(texmfCache, texmfCacheSeed);

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return sendJson(response, 200, {
      ok: true,
      rendererVersion,
      compilerProfileVersion,
    });
  }
  if (request.headers.authorization !== `Bearer ${token}`) {
    return sendJson(response, 401, { ok: false, code: "UNAUTHORIZED" });
  }

  try {
    if (request.method === "POST" && request.url === "/render") {
      return handleRender(request, response);
    }
    return sendJson(response, 404, { ok: false, code: "NOT_FOUND" });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      category: "INFRASTRUCTURE",
      code: "TEX_RENDERER_INTERNAL_ERROR",
      log: safeErrorMessage(error),
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(
    `TeX renderer listening on ${port} with compile concurrency ${renderConcurrency}.\n`,
  );
});

async function handleRender(request, response) {
  const body = await readJsonBody(request, maxSourceBytes + 4_096);
  if (typeof body.latexSource !== "string") {
    return sendJson(response, 400, {
      ok: false,
      category: "SOURCE",
      code: "LATEX_SOURCE_REQUIRED",
      log: "latexSource must be a string.",
      issues: [diagnosticIssue("LATEX_SOURCE_REQUIRED", "latexSource must be a string.")],
      collectionComplete: true,
    });
  }
  const sourceBytes = Buffer.byteLength(body.latexSource, "utf8");
  if (sourceBytes > maxSourceBytes) {
    return sendJson(response, 413, {
      ok: false,
      category: "SOURCE",
      code: "LATEX_SOURCE_TOO_LARGE",
      log: `Source contains ${sourceBytes} bytes; limit is ${maxSourceBytes}.`,
      issues: [
        diagnosticIssue(
          "LATEX_SOURCE_TOO_LARGE",
          `Source contains ${sourceBytes} bytes; limit is ${maxSourceBytes}.`,
        ),
      ],
      collectionComplete: true,
    });
  }
  const subjectKey = normalizeSubjectKey(body.subjectKey);
  const policyIssues = validateTexSourcePolicy(
    body.latexSource,
    subjectKey,
    maxSourceBytes,
  );
  if (policyIssues.length > 0) {
    return sendJson(response, 422, {
      ok: false,
      category: "SOURCE",
      code: "TEX_SOURCE_POLICY_REJECTED",
      log: JSON.stringify(policyIssues),
      issues: policyIssues.map((policyIssue) =>
        diagnosticIssue(policyIssue.code, policyIssue.message),
      ),
      collectionComplete: true,
    });
  }
  const result = await renderLimiter.run(() => renderLatex(body.latexSource, subjectKey));
  return sendJson(response, result.ok ? 200 : 422, result);
}

async function renderLatex(latexSource, subjectKey) {
  const workDirectory = await mkdtemp(join(tmpdir(), "stem-figure-"));
  const sourcePath = join(workDirectory, "main.tex");
  const fragmentPath = join(workDirectory, "fragment.tex");
  const pdfPath = join(workDirectory, "main.pdf");
  const svgPath = join(workDirectory, "main.svg");
  const startedAt = Date.now();

  try {
    await Promise.all([
      writeFile(sourcePath, buildCompilerEnvelope(subjectKey), {
        encoding: "utf8",
        mode: 0o600,
      }),
      writeFile(fragmentPath, latexSource, { encoding: "utf8", mode: 0o600 }),
    ]);
    const latex = await runCommand(
      "lualatex",
      [
        "--no-shell-escape",
        "--nosocket",
        "--interaction=nonstopmode",
        "--file-line-error",
        `--output-directory=${workDirectory}`,
        "main.tex",
      ],
      workDirectory,
    );
    const compilerIssues = parseCompilerIssues(latex.log);
    if (!latex.ok || compilerIssues.length > 0) {
      const code = latex.timedOut ? "TEX_COMPILE_TIMEOUT" : "TEX_COMPILE_FAILED";
      return {
        ok: false,
        category: latex.timedOut ? "INFRASTRUCTURE" : "SOURCE",
        code,
        log: latex.log,
        issues:
          compilerIssues.length > 0
            ? compilerIssues
            : [diagnosticIssue(code, latex.log || "LuaLaTeX did not complete.")],
        collectionComplete: !latex.timedOut && !latex.fatalStop && !latex.outputTruncated,
        durationMs: Date.now() - startedAt,
        rendererVersion: `${rendererVersion}+${compilerProfileVersion}`,
      };
    }

    const convert = await runCommand(
      "dvisvgm",
      ["--pdf", "--page=1", "--no-fonts", "--exact-bbox", `--output=${svgPath}`, pdfPath],
      workDirectory,
    );
    if (!convert.ok) {
      return {
        ok: false,
        category: "INFRASTRUCTURE",
        code: convert.timedOut ? "SVG_CONVERSION_TIMEOUT" : "SVG_CONVERSION_FAILED",
        log: convert.log,
        issues: [
          diagnosticIssue(
            convert.timedOut ? "SVG_CONVERSION_TIMEOUT" : "SVG_CONVERSION_FAILED",
            convert.log || "dvisvgm did not complete.",
          ),
        ],
        collectionComplete: !convert.timedOut,
        durationMs: Date.now() - startedAt,
        rendererVersion: `${rendererVersion}+${compilerProfileVersion}`,
      };
    }

    const svg = await readFile(svgPath, "utf8");
    if (Buffer.byteLength(svg, "utf8") > maxSvgBytes) {
      return {
        ok: false,
        category: "SOURCE",
        code: "SVG_OUTPUT_TOO_LARGE",
        log: `SVG exceeds ${maxSvgBytes} bytes.`,
        issues: [
          diagnosticIssue("SVG_OUTPUT_TOO_LARGE", `SVG exceeds ${maxSvgBytes} bytes.`),
        ],
        collectionComplete: true,
        durationMs: Date.now() - startedAt,
        rendererVersion: `${rendererVersion}+${compilerProfileVersion}`,
      };
    }
    return {
      ok: true,
      svg,
      log: trimLog(`${latex.log}\n${convert.log}`),
      durationMs: Date.now() - startedAt,
      rendererVersion: `${rendererVersion}+${compilerProfileVersion}`,
    };
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}

async function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      env: {
        PATH: process.env.PATH,
        HOME: cwd,
        TEXMFCACHE: texmfCache,
        TEXMFOUTPUT: cwd,
        openin_any: "p",
        openout_any: "p",
        shell_escape: "f",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let outputTruncated = false;
    let timedOut = false;
    let settled = false;
    const collect = (chunk) => {
      const text = chunk.toString("utf8");
      const remaining = Math.max(80_000 - output.length, 0);
      output += text.slice(0, remaining);
      if (text.length > remaining) outputTruncated = true;
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timeout = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    }, timeoutMs);
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        timedOut: false,
        fatalStop: true,
        outputTruncated: false,
        log: trimLog(safeErrorMessage(error)),
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const log = trimLog(output);
      resolve({
        ok: code === 0 && !timedOut,
        timedOut,
        outputTruncated,
        fatalStop: /Emergency stop|Fatal error occurred|No pages of output/iu.test(log),
        log,
      });
    });
  });
}

function createConcurrencyLimiter(limit) {
  let active = 0;
  const waiting = [];

  const acquire = () => {
    if (active < limit) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => waiting.push(resolve));
  };

  const release = () => {
    const next = waiting.shift();
    if (next) {
      next();
      return;
    }
    active -= 1;
  };

  return {
    async run(task) {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}

async function prepareTexmfCache(cachePath, seedPath) {
  await mkdir(cachePath, { recursive: true });
  if (seedPath && seedPath !== cachePath) {
    await cp(seedPath, cachePath, { recursive: true, force: true });
  }
}

function parseCompilerIssues(log) {
  const issues = [];
  const lines = log.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fileLine = line.match(/(?:^|\/)(main|fragment)\.tex:(\d+):\s*(.+)$/u);
    if (fileLine) {
      issues.push({
        ...diagnosticIssue("TEX_COMPILE_ERROR", fileLine[3]),
        file: `${fileLine[1]}.tex`,
        line: Number(fileLine[2]),
      });
      continue;
    }
    if (line.startsWith("! ")) {
      const lineHint = lines
        .slice(index + 1, index + 4)
        .join(" ")
        .match(/l\.(\d+)/u);
      issues.push({
        ...diagnosticIssue("TEX_COMPILE_ERROR", line.slice(2)),
        file: "fragment.tex",
        line: lineHint ? Number(lineHint[1]) : null,
      });
    }
  }
  return deduplicateIssues(issues);
}

function diagnosticIssue(code, message) {
  return {
    code,
    severity: "ERROR",
    message: String(message).trim().slice(0, 4_000) || code,
    file: null,
    line: null,
    column: null,
    element: null,
    path: null,
  };
}

function deduplicateIssues(issues) {
  const seen = new Set();
  return issues.filter((issue) => {
    const key = JSON.stringify(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readJsonBody(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body === null ? "" : JSON.stringify(body));
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function trimLog(value) {
  return value.replaceAll(/[^\S\r\n]+$/gmu, "").slice(-80_000);
}

function safeErrorMessage(error) {
  return error instanceof Error
    ? error.message.slice(0, 2_000)
    : String(error).slice(0, 2_000);
}
