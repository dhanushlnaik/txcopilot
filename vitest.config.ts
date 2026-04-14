import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./__tests__/mocks/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts", "src/__tests__/**/*.test.ts"],
  },
});
