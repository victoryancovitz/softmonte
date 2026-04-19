import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 1,
  workers: 2,
  use: {
    baseURL: 'https://softmonte.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' }, testMatch: /\.spec\.ts/ },
  ],
  reporter: [['html', { open: 'never' }], ['list']],
  outputDir: 'e2e/screenshots',
})
