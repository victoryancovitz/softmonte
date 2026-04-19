import { Page } from '@playwright/test'

const BASE = 'https://softmonte.vercel.app'

const CREDENTIALS: Record<string, { email: string; pass: string }> = {
  admin: { email: 'diretoria@tecnomonte.com.br', pass: 'Softmonte@2026' },
  diretoria: { email: 'diretoria@tecnomonte.com.br', pass: 'Softmonte@2026' },
  rh: { email: 'rh@tecnomonte.com.br', pass: 'Softmonte@2026' },
  financeiro: { email: 'financeiro@tecnomonte.com.br', pass: 'Softmonte@2026' },
  encarregado: { email: 'encarregado@tecnomonte.com.br', pass: 'Softmonte@2026' },
  engenheiro: { email: 'engenheiro@tecnomonte.com.br', pass: 'Softmonte@2026' },
}

export type Role = keyof typeof CREDENTIALS

export async function loginAs(page: Page, role: Role = 'admin') {
  const cred = CREDENTIALS[role]
  if (!cred) throw new Error(`Role "${role}" sem credenciais configuradas`)

  await page.goto(BASE + '/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', cred.email)
  await page.fill('input[type="password"]', cred.pass)
  await page.click('button:has-text("Entrar")')
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(1500)
}

export async function loginInvalido(page: Page, email: string, pass: string) {
  await page.goto(BASE + '/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pass)
  await page.click('button:has-text("Entrar")')
}

export async function logout(page: Page) {
  // Clicar no avatar/menu e sair
  const avatar = page.locator('[data-testid="user-menu"], button:has-text("Sair"), [aria-label="Menu do usuário"]')
  if (await avatar.count() > 0) {
    await avatar.first().click()
    const sair = page.locator('button:has-text("Sair"), a:has-text("Sair")')
    if (await sair.count() > 0) {
      await sair.first().click()
      await page.waitForURL('**/login', { timeout: 10000 })
    }
  }
}

export { BASE }
