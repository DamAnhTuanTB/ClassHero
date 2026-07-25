import { z } from "zod";

const schema = z.object({
  num: z.number({ invalid_type_error: "invalid type" })
});

const result = schema.safeParse({ num: NaN });
console.log(JSON.stringify(result.success ? "success" : result.error.errors, null, 2));
