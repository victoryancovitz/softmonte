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

test('DEBUG — fornecedores page structure', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto(URL + '/compras/fornecedores')
  await page.waitForTimeout(4000)

  const buttons = await page.locator('button').allTextContents()
  console.log('BUTTONS:', buttons.filter(b => b.trim()).join(' | '))
  await page.screenshot({ path: 'e2e/screenshots/debug-fornecedores.png', fullPage: true })
})

test('DEBUG — faltas page structure', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto(URL + '/faltas/nova')
  await page.waitForTimeout(4000)

  const selects = page.locator('select')
  const selectCount = await selects.count()
  console.log(`SELECTS: ${selectCount}`)
  for (let i = 0; i < selectCount; i++) {
    const opts = await selects.nth(i).locator('option').allTextContents()
    console.log(`  select[${i}]: ${opts.slice(0, 5).join(', ')}${opts.length > 5 ? '...' : ''}`)
  }

  const inputs = await page.locator('input').evaluateAll(els =>
    els.map(el => ({ type: el.getAttribute('type'), placeholder: el.getAttribute('placeholder') }))
  )
  console.log('INPUTS:', JSON.stringify(inputs))
  const buttons = await page.locator('button').allTextContents()
  console.log('BUTTONS:', buttons.filter(b => b.trim()).join(' | '))
  await page.screenshot({ path: 'e2e/screenshots/debug-faltas.png', fullPage: true })
})

test('DEBUG — desligamentos page', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto(URL + '/rh/desligamentos/novo')
  await page.waitForTimeout(4000)

  const selects = page.locator('select')
  const selectCount = await selects.count()
  console.log(`SELECTS: ${selectCount}`)
  for (let i = 0; i < selectCount; i++) {
    const opts = await selects.nth(i).locator('option').allTextContents()
    console.log(`  select[${i}]: ${opts.slice(0, 5).join(', ')}${opts.length > 5 ? `... (${opts.length} total)` : ''}`)
  }
  const buttons = await page.locator('button').allTextContents()
  console.log('BUTTONS:', buttons.filter(b => b.trim()).join(' | '))
  await page.screenshot({ path: 'e2e/screenshots/debug-desligamentos.png', fullPage: true })
})

test('DEBUG — cotacoes page', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto(URL + '/compras/cotacoes')
  await page.waitForTimeout(4000)

  const buttons = await page.locator('button').allTextContents()
  console.log('BUTTONS:', buttons.filter(b => b.trim()).join(' | '))
  await page.screenshot({ path: 'e2e/screenshots/debug-cotacoes.png', fullPage: true })
})
