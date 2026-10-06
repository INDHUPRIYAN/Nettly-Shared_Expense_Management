import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the Vite dev server and a LOCAL Supabase stack
 * (`npm run db:start`). They create real accounts with unique emails.
 *
 * Smoke-test a deployment instead with: E2E_BASE_URL=https://your-app.vercel.app npm run test:e2e
 */
const remoteBaseUrl = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: remoteBaseUrl ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec/ },
  ],
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: 'npx vite --port 5173 --strictPort',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 60_000,
      },
})
