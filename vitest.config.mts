import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;
// tests/test-db-url.ts ile aynı değer.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://anahtar:anahtar@127.0.0.1:5432/anahtar_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "server-only": path.resolve(root, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    env: { DATABASE_URL: TEST_DATABASE_URL, DATABASE_SSL: "false" },
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Entegrasyon testleri tek bir test veritabanını paylaşır.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
