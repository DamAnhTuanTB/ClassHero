import { zodTextFormat } from "openai/helpers/zod";
import {
  makeParseableTextFormat,
  type AutoParseableTextFormat,
} from "openai/lib/parser";
import { toStrictJsonSchema } from "openai/lib/transform";
import { z } from "zod";

import type {
  AiOutputSchema,
  AiStructuredSchemaReferenceStrategy,
} from "#api/modules/ai/types/ai-text.types";

type JsonObject = Record<string, unknown>;
type JsonSlot = {
  path: string;
  value: JsonObject;
  replace: (value: JsonObject) => void;
};

const compactFormatCache = new WeakMap<object, Map<string, AutoParseableTextFormat<unknown>>>();

export function buildAiStructuredTextFormat<TOutput>(
  schema: AiOutputSchema<TOutput>,
  outputName: string,
  referenceStrategy: AiStructuredSchemaReferenceStrategy = "inline",
): AutoParseableTextFormat<TOutput> {
  if (referenceStrategy === "inline") {
    return zodTextFormat(schema, outputName);
  }

  if (referenceStrategy === "ref_v2") {
    const cacheKey = `${outputName}:ref_v2`;
    const cached = compactFormatCache.get(schema as object)?.get(cacheKey);
    if (cached) {
      return cached as AutoParseableTextFormat<TOutput>;
    }
    const format = deepFreeze(buildReferenceTextFormat(schema, outputName, true));
    const schemaCache = compactFormatCache.get(schema as object) ?? new Map();
    schemaCache.set(cacheKey, format as AutoParseableTextFormat<unknown>);
    compactFormatCache.set(schema as object, schemaCache);
    return format;
  }

  return buildReferenceTextFormat(schema, outputName, false);
}

function buildReferenceTextFormat<TOutput>(
  schema: AiOutputSchema<TOutput>,
  outputName: string,
  compactV2: boolean,
): AutoParseableTextFormat<TOutput> {
  const generatedSchema = toStrictJsonSchema(
    z.toJSONSchema(schema, {
      reused: "ref",
      override: ({ zodSchema, jsonSchema }) => {
        const definition = zodSchema._zod.def;
        if (
          definition.type === "union" &&
          "discriminator" in definition &&
          Array.isArray(jsonSchema.oneOf)
        ) {
          if (jsonSchema.anyOf !== undefined) {
            throw new Error(
              "Zod discriminated union generated both anyOf and oneOf.",
            );
          }
          jsonSchema.anyOf = jsonSchema.oneOf;
          delete jsonSchema.oneOf;
        }
      },
    }) as Parameters<typeof toStrictJsonSchema>[0],
  ) as unknown as JsonObject;

  const jsonSchema = compactV2
    ? compactAndRenameExactSchemaReferences(generatedSchema)
    : generatedSchema;

  return makeParseableTextFormat<TOutput>(
    {
      type: "json_schema",
      name: outputName,
      strict: true,
      schema: jsonSchema as unknown as Record<string, unknown>,
    },
    (content) => schema.parse(JSON.parse(content)),
  );
}

function compactAndRenameExactSchemaReferences(schema: JsonObject): JsonObject {
  const compacted = structuredClone(schema);
  const definitions = readDefinitions(compacted);
  const slots = collectExactReusableSchemaSlots(compacted);

  hoistExactSlots(definitions, "__compact_geometry_statement", slots.geometry, 3);
  hoistExactSlots(definitions, "__compact_marker_group", slots.markerGroups, 2);
  hoistExactSlots(definitions, "__compact_measure", slots.measures, 2);

  return renameDefinitionsDeterministically(compacted);
}

function readDefinitions(schema: JsonObject): JsonObject {
  const definitions = schema.$defs;
  if (!isJsonObject(definitions)) {
    throw new Error("Reference schema does not contain a $defs object.");
  }
  return definitions;
}

function collectExactReusableSchemaSlots(schema: JsonObject) {
  const geometry: JsonSlot[] = [];
  const markerGroups: JsonSlot[] = [];
  const measures: JsonSlot[] = [];

  walkJson(schema, "", (object, path) => {
    const properties = object.properties;
    if (!isJsonObject(properties)) return;

    const geometryStatement = properties.geometryStatement;
    if (isJsonObject(geometryStatement)) {
      geometry.push({
        path: `${path}/properties/geometryStatement`,
        value: geometryStatement,
        replace: (value) => {
          properties.geometryStatement = value;
        },
      });
    }

    const measuresSchema = properties.measures;
    if (isJsonObject(measuresSchema) && isJsonObject(measuresSchema.items)) {
      const item = measuresSchema.items;
      const itemProperties = item.properties;
      if (
        isJsonObject(itemProperties) &&
        "target" in itemProperties &&
        "text" in itemProperties
      ) {
        measures.push({
          path: `${path}/properties/measures/items`,
          value: item,
          replace: (value) => {
            measuresSchema.items = value;
          },
        });
      }
    }

    const markersSchema = properties.markers;
    if (!isJsonObject(markersSchema) || !isJsonObject(markersSchema.properties)) {
      return;
    }
    const equalLengths = markersSchema.properties.equalLengths;
    const parallels = markersSchema.properties.parallels;
    if (
      isJsonObject(equalLengths) &&
      isJsonObject(equalLengths.items) &&
      isJsonObject(parallels) &&
      isJsonObject(parallels.items)
    ) {
      markerGroups.push(
        {
          path: `${path}/properties/markers/properties/equalLengths/items`,
          value: equalLengths.items,
          replace: (value) => {
            equalLengths.items = value;
          },
        },
        {
          path: `${path}/properties/markers/properties/parallels/items`,
          value: parallels.items,
          replace: (value) => {
            parallels.items = value;
          },
        },
      );
    }
  });

  const groupedMeasures = groupSlotsByCanonicalValue(measures).find(
    (group) => group.length === 2,
  );
  return {
    geometry,
    markerGroups,
    measures: groupedMeasures ?? [],
  };
}

function hoistExactSlots(
  definitions: JsonObject,
  definitionName: string,
  slots: JsonSlot[],
  expectedCount: number,
) {
  if (slots.length === 0) return;
  if (slots.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} exact schema slots for ${definitionName}, found ${slots.length}.`,
    );
  }
  const canonical = stableJson(slots[0]!.value);
  const mismatch = slots.find((slot) => stableJson(slot.value) !== canonical);
  if (mismatch) {
    throw new Error(
      `Schema slot ${mismatch.path} is not equivalent to ${slots[0]!.path}.`,
    );
  }
  definitions[definitionName] = structuredClone(slots[0]!.value);
  for (const slot of slots) {
    slot.replace({ $ref: `#/$defs/${definitionName}` });
  }
}

function renameDefinitionsDeterministically(schema: JsonObject): JsonObject {
  const definitions = readDefinitions(schema);
  const entries = Object.entries(definitions).sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  );
  const nameMap = new Map(
    entries.map(([name], index) => [name, encodeShortDefinitionName(index)]),
  );
  const renamedDefinitions: JsonObject = {};
  for (const [oldName, definition] of entries) {
    renamedDefinitions[nameMap.get(oldName)!] = definition;
  }
  schema.$defs = renamedDefinitions;

  walkJson(schema, "", (object) => {
    if (typeof object.$ref !== "string") return;
    const match = /^#\/\$defs\/([^/]+)(.*)$/u.exec(object.$ref);
    if (!match) {
      throw new Error(`Unsupported non-$defs reference in ref_v2: ${object.$ref}`);
    }
    const oldName = decodeJsonPointerSegment(match[1]!);
    const newName = nameMap.get(oldName);
    if (!newName) {
      throw new Error(`Unresolved $defs reference in ref_v2: ${object.$ref}`);
    }
    object.$ref = `#/$defs/${encodeJsonPointerSegment(newName)}${match[2] ?? ""}`;
  });

  return schema;
}

function groupSlotsByCanonicalValue(slots: JsonSlot[]): JsonSlot[][] {
  const groups = new Map<string, JsonSlot[]>();
  for (const slot of slots) {
    const key = stableJson(slot.value);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return [...groups.values()].sort(
    (left, right) =>
      stableJson(right[0]!.value).length - stableJson(left[0]!.value).length,
  );
}

function walkJson(
  value: unknown,
  path: string,
  visit: (object: JsonObject, path: string) => void,
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, `${path}/${index}`, visit));
    return;
  }
  if (!isJsonObject(value)) return;
  visit(value, path);
  for (const [key, child] of Object.entries(value)) {
    walkJson(child, `${path}/${encodeJsonPointerSegment(key)}`, visit);
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (isJsonObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function encodeShortDefinitionName(index: number): string {
  let value = index;
  let result = "";
  do {
    result = String.fromCharCode(97 + (value % 26)) + result;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return result;
}

function encodeJsonPointerSegment(value: string) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function decodeJsonPointerSegment(value: string) {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

export function estimateAiStructuredInputTokens(input: {
  systemPrompt: string;
  inputPrompt: string;
  structuredTextFormat: unknown;
  minimumPromptTokens?: number;
}) {
  const promptTokens = Math.max(
    input.minimumPromptTokens ?? 0,
    Math.ceil((input.systemPrompt.length + input.inputPrompt.length) / 4),
  );
  const schemaTokens = Math.ceil(
    // JSON Schema is punctuation- and identifier-heavy. Live Responses usage for
    // this contract is about 1.2 characters/token, unlike prose at about 4.
    JSON.stringify(input.structuredTextFormat).length / 1.2,
  );
  return {
    promptTokens,
    schemaTokens,
    estimatedTokens: promptTokens + schemaTokens,
  };
}
