import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^#api\/(.*)$/,
        replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/$1`,
      },
    ],
  },
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts", "test/**/*.int.test.ts"],
    pool: "forks",
  },
});
