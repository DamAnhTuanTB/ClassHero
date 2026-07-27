import type {
  AiEmbeddingInput,
  AiEmbeddingOutput,
} from "#api/modules/ai/types/ai-embedding.types";

export interface ExpectedEmbeddingSpace {
  model: string;
  dimensions: number;
}

export function assertEmbeddingInput(input: AiEmbeddingInput): void {
  if (input.texts.length === 0) {
    throw new Error("Embedding input must contain at least one text.");
  }

  const emptyTextIndex = input.texts.findIndex((text) => text.trim().length === 0);
  if (emptyTextIndex >= 0) {
    throw new Error(`Embedding input text at index ${emptyTextIndex} is empty.`);
  }

  if (input.dimensions !== undefined && input.dimensions <= 0) {
    throw new Error("Embedding dimensions must be a positive integer.");
  }
}

export function assertEmbeddingOutput(params: {
  output: AiEmbeddingOutput;
  expectedCount: number;
  expectedSpace: ExpectedEmbeddingSpace;
}): void {
  const { output, expectedCount, expectedSpace } = params;

  if (output.model !== expectedSpace.model) {
    throw new Error(
      `Embedding provider returned model "${output.model}", expected "${expectedSpace.model}".`,
    );
  }

  if (output.dimensions !== expectedSpace.dimensions) {
    throw new Error(
      `Embedding provider returned ${output.dimensions} dimensions, expected ${expectedSpace.dimensions}.`,
    );
  }

  if (output.vectors.length !== expectedCount) {
    throw new Error(
      `Embedding provider returned ${output.vectors.length} vectors for ${expectedCount} inputs.`,
    );
  }

  for (const [index, vector] of output.vectors.entries()) {
    if (vector.length !== expectedSpace.dimensions) {
      throw new Error(
        `Embedding vector at index ${index} has ${vector.length} dimensions, expected ${expectedSpace.dimensions}.`,
      );
    }

    if (!vector.every(Number.isFinite)) {
      throw new Error(
        `Embedding vector at index ${index} contains a non-finite value.`,
      );
    }
  }
}
