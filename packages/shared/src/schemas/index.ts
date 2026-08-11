import { z } from "zod";

export * from "./lesson-summary-diagram.js";
export * from "./lesson-summary-geometry.js";
export * from "./lesson-summary-text.js";

export const idSchema = z.string().uuid();
