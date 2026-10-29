// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js' `server-only` / `client-only` markers are resolved by the
      // bundler at build time but are absent under Vitest — stub them so server
      // modules (e.g. the WAHA client) can be unit-tested.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
      "client-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
