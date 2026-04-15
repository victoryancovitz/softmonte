import { test as setup } from '@playwright/test'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

const STORAGE_STATE = path.resolve(__dirname, '.auth/user.json')

setup('login', async ({ page }) => {
  // Use the test-login API route to set server-side cookies
  const response = await page.goto('/api/test-login?' + new URLSearchParams({
    email: process.env.E2E_EMAIL || '',
    password: process.env.E2E_PASSWORD || '',
  }).toString())

  if (response?.ok()) {
    console.log('✅ Logged in via API route')
  } else {
    console.log('API route failed, trying UI...')
    await page.goto('/login')
    await page.waitForTimeout(2000)
    await page.locator('input[type="email"]').fill(process.env.E2E_EMAIL || '')
    await page.locator('input[type="password"]').pressSequentially(process.env.E2E_PASSWORD || '', { delay: 30 })
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Entrar")').click()
    await page.waitForTimeout(8000)
  }

  // Navigate to confirm auth works
  await page.goto('/diretoria')
  await page.waitForTimeout(5000)
  await page.context().storageState({ path: STORAGE_STATE })
})

export { STORAGE_STATE }
