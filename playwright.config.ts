import { defineConfig } from "@playwright/test";

// UI tests: the real page and server, with a local stand-in for the model API.
// Uses the Edge that ships with Windows, so no browser download is needed.
const APP = 3190,
  MOCK = 3191;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${APP}`,
    channel: process.env.PW_CHANNEL || "msedge",
    headless: true,
  },
  webServer: [
    {
      command: "npx tsx tests/e2e/mock-model.ts",
      url: `http://127.0.0.1:${MOCK}/health`,
      env: { MOCK_PORT: String(MOCK) },
      reuseExistingServer: false,
    },
    {
      command: "npx vite build --logLevel warn && npx tsx server/index.ts",
      url: `http://127.0.0.1:${APP}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        PORT: String(APP),
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: `http://127.0.0.1:${MOCK}/v1`,
        OPENAI_MODEL: "mock-model",
        LLM_CACHE: "off",
      },
    },
  ],
});
