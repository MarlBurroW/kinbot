import { defineConfig } from '@playwright/test'

export default defineConfig({
  globalSetup: './e2e/showcase/global-setup.js',
  testDir: './e2e/showcase',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3334',
    trace: 'off',
    screenshot: 'off',
    colorScheme: process.env.SHOWCASE_THEME === 'light' ? 'light' : 'dark',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    viewport: { width: 1280, height: 720 },
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
      DB_PATH: process.env.E2E_DB_PATH || './data/kinbot-showcase.db',
      E2E_SKIP_PROVIDER_TEST: 'true',
      E2E_MOCK_LLM: 'true',
      LOG_LEVEL: 'warn',
      TRUSTED_ORIGINS: 'http://localhost:3334',
      BETTER_AUTH_BASE_URL: 'http://localhost:3334',
    },
  },

  projects: [
    {
      name: 'showcase',
      use: { browserName: 'chromium' },
    },
  ],
})
