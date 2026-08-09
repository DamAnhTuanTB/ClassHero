import { z } from "zod";

export * from "./lesson-summary-diagram.js";

export const idSchema = z.string().uuid();
