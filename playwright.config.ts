import { defineConfig } from '@playwright/test'
import path from 'path'

const STORAGE_STATE = path.resolve(__dirname, 'e2e/.auth/user.json')

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'https://softmonte.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, teardown: undefined },
    {
      name: 'chromium',
      use: { browserName: 'chromium', storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
})
