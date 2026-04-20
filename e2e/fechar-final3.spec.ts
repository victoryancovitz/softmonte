import { test, Page } from '@playwright/test'
const URL = 'https://softmonte.vercel.app'
async function login(page: Page) {
  await page.goto(URL + '/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', 'diretoria@tecnomonte.com.br')
  await page.fill('input[type="password"]', 'Softmonte@2026')
  await page.click('button:has-text("Entrar")')
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(2000)
}
async function fechar(page: Page, obra: string, mes: string) {
  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(3000)
  const sel = page.locator('select').first()
  const opts = await sel.locator('option').allTextContents()
  const idx = opts.findIndex(o => o.includes(obra))
  if (idx < 0) { console.log(`  ❌ ${obra} não encontrada`); return }
  await sel.selectOption({ index: idx })
  await page.waitForTimeout(1000)
  const selects = page.locator('select')
  for (let i = 1; i < await selects.count(); i++) {
    const o = await selects.nth(i).locator('option').allTextContents()
    const mi = o.findIndex(x => x === mes)
    if (mi >= 0) { await selects.nth(i).selectOption({ index: mi }); break }
  }
  await page.waitForTimeout(1000)
  const btn = page.locator('button:has-text("Fechar folha")')
  if (await btn.count() === 0) { console.log(`  ⚠️ sem botão`); return }
  await btn.click()
  await page.waitForTimeout(3000)
  const body = await page.textContent('body') ?? ''
  if (body.includes('mesmo assim')) {
    const b2 = page.locator('button:has-text("mesmo assim")')
    if (await b2.count() > 0) { await b2.click(); await page.waitForTimeout(40000) }
  } else { await page.waitForTimeout(35000) }
  console.log(`  ✅ ${obra} — ${mes}`)
}
test('1', async ({ page }) => { test.setTimeout(120000); await login(page); await fechar(page, 'Laminação', 'Janeiro') })
test('2', async ({ page }) => { test.setTimeout(120000); await login(page); await fechar(page, 'Vale — Caldeiraria', 'Janeiro') })
test('3', async ({ page }) => { test.setTimeout(120000); await login(page); await fechar(page, 'Vale — Correia', 'Fevereiro') })
