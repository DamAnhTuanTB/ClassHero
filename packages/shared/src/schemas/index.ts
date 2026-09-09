import { z } from "zod";

export * from "./lesson-summary-geometry.js";
export * from "./lesson-summary-text.js";
export * from "./latex-text.js";
export * from "./numeric-answer.js";
export * from "./provider-usage-target.js";
export * from "./stem-figure.js";
export * from "./tiptap.js";

export const idSchema = z.string().uuid();
