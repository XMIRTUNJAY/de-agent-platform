import { defineConfig, devices } from '@playwright/test';

// E2E runs against `astro dev` (not build): it exercises the same pages and
// API routes CI ships, without the minutes-long static prerender. Production
// parity for the built artifact is covered by `astro check` + pipeline tests.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4322',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx astro dev --port 4322 --host 127.0.0.1',
    url: 'http://127.0.0.1:4322/',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
