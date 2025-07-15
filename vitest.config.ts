import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.{ts,js}"],
    testTimeout: 60000, // 60 seconds for container startup
    hookTimeout: 60000,
    teardownTimeout: 60000,
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
