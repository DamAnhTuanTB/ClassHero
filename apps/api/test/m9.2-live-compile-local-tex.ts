/**
 * Read-only renderer harness for a small directory of local TeX snippets.
 * It never calls an AI provider and never mutates the database.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";

import { validateEnv, type EnvConfig } from "#api/config/env.validation";
import { TexRendererClientService } from "#api/modules/stem-figures/services/tex-renderer-client.service";

async function main() {
  config({ path: resolve(process.cwd(), ".env"), quiet: true });
  process.env.TEX_RENDERER_URL ??= "http://127.0.0.1:8080";
  const sourceDirectory = resolve(process.cwd(), requiredEnv("M9_2_LOCAL_TEX_DIRECTORY"));
  const env = validateEnv(process.env);
  const renderer = new TexRendererClientService(
    new ConfigService<EnvConfig, true>(env, true),
  );
  const filenames = (await readdir(sourceDirectory))
    .filter((filename) => filename.endsWith(".tex"))
    .sort();
  if (filenames.length === 0 || filenames.length > 10) {
    throw new Error("The source directory must contain between 1 and 10 .tex files.");
  }

  const results = [];
  for (const filename of filenames) {
    const source = await readFile(resolve(sourceDirectory, filename), "utf8");
    const rendered = await renderer.render(source, "MATH");
    if (rendered.ok) {
      const outputFilename = filename.replace(/\.tex$/u, ".svg");
      await writeFile(resolve(sourceDirectory, outputFilename), rendered.svg, "utf8");
      results.push({ filename, ok: true, outputFilename });
    } else {
      results.push({
        filename,
        ok: false,
        code: rendered.code,
        issues: rendered.issues,
      });
    }
  }
  process.stdout.write(`${JSON.stringify({ sourceDirectory, results }, null, 2)}\n`);
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

void main();
