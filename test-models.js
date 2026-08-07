const models = ["gpt-4.5-preview", "gpt-5.5", "o1-mini", "o3-mini", "gemini-3.0-pro"];
const isReasoningModel = (modelName) => {
  if (!modelName) return false;
  const m = modelName.toLowerCase();
  // We should match o1, o3, etc. but NOT gpt-5!
  return /^(o[1-9])/.test(m) || m.includes("thinking");
}
console.log(models.map(m => `${m}: ${isReasoningModel(m)}`));
