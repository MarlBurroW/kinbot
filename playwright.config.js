import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  globalSetup: './e2e/global-setup.js',
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',

  use: {
    baseURL: 'http://localhost:3334',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on',
  },

  webServer: {
    command: 'bun src/server/index.ts',
    port: 3334,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3334',
      DB_PATH: process.env.E2E_DB_PATH || './data/kinbot-e2e.db',
      E2E_SKIP_PROVIDER_TEST: 'true',
      LOG_LEVEL: 'warn',
      TRUSTED_ORIGINS: 'http://localhost:3334',
      BETTER_AUTH_BASE_URL: 'http://localhost:3334',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
