import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Each test file drives its own headless Chromium; running files in parallel makes
    // them contend for CPU and flake on timeouts. Sequential is slower but deterministic
    // — reproducibility matters more than wall-clock here.
    fileParallelism: false,
  },
});
