import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Load ONLY the test database settings
const testEnv = config({ path: ".env.test", override: true }).parsed ?? {};

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    env: testEnv,
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false, // one database, run files one after another
    testTimeout: 60_000, // remote database: allow slow round trips
    hookTimeout: 60_000,
  },
});