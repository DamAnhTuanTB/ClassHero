export function supportsOpenAiTemperature(model: string) {
  return !/^(?:o[1-9]|gpt-5)/u.test(model.toLowerCase());
}

export function supportsOpenAiReasoningEffort(model: string) {
  return /^(?:o[1-9]|gpt-5)/u.test(model.toLowerCase());
}
