import { createHash } from "node:crypto";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";

type OpenAiPromptCacheFields = {
  prompt_cache_key?: string;
  prompt_cache_options?: {
    mode: "explicit";
    ttl: "30m";
  };
  prompt_cache_retention?: "24h";
};

export function buildOpenAiPromptCacheFields(input: {
  request: AiStructuredInput;
  model: string;
  structuredTextFormat: unknown;
}): OpenAiPromptCacheFields {
  const configuration = input.request.promptCache;
  if (!configuration) return {};

  const fields: OpenAiPromptCacheFields = {};
  if (configuration.keyEnabled) {
    const namespace = normalizeNamespace(configuration.namespace);
    const modelHash = shortHash(input.model, 8);
    const contractHash = shortHash(
      [
        input.request.promptVersion,
        input.request.schemaVersion,
        input.request.schemaReferenceStrategy ?? "inline",
      ].join("\u0000"),
      8,
    );
    const prefixHash = shortHash(
      [
        input.request.systemPrompt,
        input.request.outputName,
        JSON.stringify(input.structuredTextFormat),
      ].join("\u0000"),
      12,
    );
    fields.prompt_cache_key = [namespace, modelHash, contractHash, prefixHash].join(":");
  }

  if (supportsOpenAiExplicitPromptCaching(input.model)) {
    fields.prompt_cache_options = {
      mode: "explicit",
      ttl: "30m",
    };
    return fields;
  }

  if (
    configuration.retention === "24h" &&
    supportsOpenAiExtendedPromptCacheRetention(input.model)
  ) {
    fields.prompt_cache_retention = "24h";
  }

  return fields;
}

/**
 * GPT-5.6+ supports exact cache boundaries and the new 30-minute TTL contract.
 */
export function supportsOpenAiExplicitPromptCaching(model: string) {
  const match = model.toLowerCase().match(/^gpt-(\d+)\.(\d+)(?:-|$)/u);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 5 || (major === 5 && minor >= 6);
}

/** Legacy extended-retention field used only before GPT-5.6. */
export function supportsOpenAiExtendedPromptCacheRetention(model: string) {
  return /^gpt-5\.4(?:-|$)/u.test(model.toLowerCase());
}

function normalizeNamespace(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 16);
  if (!normalized) {
    throw new Error("Prompt cache namespace must contain an ASCII letter or number.");
  }
  return normalized;
}

function shortHash(value: string, length: number) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}
