import { defineConfig, devices } from '@playwright/test';

// Non-default port (3000 is what `npm run dev` uses, and the user keeps a dev
// server open on it during sessions per AGENTS.md — never reuse it). Also
// avoids clashing with other agents/tasks running Playwright in parallel.
const PORT = 3010;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // No bundler/build step (vanilla ES modules + importmap, see AGENTS.md) — `serve`
    // just serves the repo statically, same as `npm run dev` on its own port.
    command: `npx serve -l ${PORT} .`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
