import { test as setup } from '@playwright/test'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.test') })

const STORAGE_STATE = path.resolve(__dirname, '.auth/user.json')

setup('login', async ({ page }) => {
  const supabaseUrl = 'https://wzmkifutluyqzqefrbpp.supabase.co'
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Login via Supabase Auth REST API directly
  const response = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    data: {
      email: process.env.E2E_EMAIL,
      password: process.env.E2E_PASSWORD,
    },
  })

  if (!response.ok()) {
    // Fallback: login via UI
    console.log('API login failed, trying UI login...')
    await page.goto('/login')
    await page.waitForTimeout(2000)
    await page.locator('input[type="email"]').fill(process.env.E2E_EMAIL || '')
    await page.locator('input[type="password"]').pressSequentially(process.env.E2E_PASSWORD || '', { delay: 30 })
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Entrar")').click()
    await page.waitForTimeout(8000)
  } else {
    const tokens = await response.json()
    // Navigate to the app and inject the session via localStorage
    await page.goto('/login')
    await page.waitForTimeout(1000)
    await page.evaluate((t) => {
      // Supabase stores session in localStorage
      const key = Object.keys(localStorage).find(k => k.includes('supabase')) || 'sb-wzmkifutluyqzqefrbpp-auth-token'
      localStorage.setItem(key, JSON.stringify({
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + t.expires_in,
        token_type: 'bearer',
        user: t.user,
      }))
    }, tokens)
    // Reload to pick up the session
    await page.goto('/diretoria')
    await page.waitForTimeout(5000)
  }

  await page.context().storageState({ path: STORAGE_STATE })
})

export { STORAGE_STATE }
