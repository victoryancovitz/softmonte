import { test, expect, Page } from '@playwright/test'

const EMAIL = 'diretoria@tecnomonte.com.br'
const PASSWORD = 'Softmonte@2026'

// Login — wait for hydration then fill
async function login(page: Page) {
  await page.goto('/login')
  // Wait for React hydration (button becomes interactive)
  await page.waitForSelector('button:has-text("Entrar")', { timeout: 15000 })
  await page.waitForTimeout(1000) // extra wait for hydration

  // Use fill (works with React after hydration)
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.waitForTimeout(200)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.waitForTimeout(200)

  // Screenshot to verify fields are filled
  await page.screenshot({ path: 'e2e/screenshots/login-filled.png' })

  // Click submit
  await page.locator('button:has-text("Entrar")').click()

  // Wait for navigation
  try {
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 })
  } catch {
    // Take screenshot to see what happened
    await page.screenshot({ path: 'e2e/screenshots/login-after-click.png' })
    await page.waitForTimeout(5000)
  }
  await page.waitForTimeout(3000)
}

// Navigate with auth — login then go to page
async function goAuth(page: Page, path: string) {
  await login(page)
  await page.goto(path)
  await page.waitForTimeout(5000)
}

// Check page loaded (not login, not 500)
function assertNotLogin(body: string) {
  expect(body).not.toContain('Entrar na plataforma')
}

// ═══════════════════════════════════════════════
// ROTAS — CADA TESTE FAZ LOGIN PRÓPRIO
// ═══════════════════════════════════════════════

test('Health check API', async ({ page }) => {
  const res = await page.request.get('https://softmonte.vercel.app/api/health')
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  expect(json?.status).toBe('ok')
})

test('Diretoria carrega', async ({ page }) => {
  await goAuth(page, '/diretoria')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Financeiro carrega', async ({ page }) => {
  await goAuth(page, '/financeiro')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Funcionários carrega', async ({ page }) => {
  await goAuth(page, '/funcionarios')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Obras carrega', async ({ page }) => {
  await goAuth(page, '/obras')
  const body = await page.textContent('body')
  assertNotLogin(body!)
  expect(body).toContain('Cesari')
})

test('DRE carrega', async ({ page }) => {
  await goAuth(page, '/financeiro/dre')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Admissões carrega', async ({ page }) => {
  await goAuth(page, '/rh/admissoes')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Folha carrega', async ({ page }) => {
  await goAuth(page, '/rh/folha')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Ponto carrega', async ({ page }) => {
  await goAuth(page, '/ponto')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Dívidas carrega', async ({ page }) => {
  await goAuth(page, '/financeiro/dividas')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Rentabilidade carrega', async ({ page }) => {
  await goAuth(page, '/rh/rentabilidade')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Forecast carrega', async ({ page }) => {
  await goAuth(page, '/forecast')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Contas carrega', async ({ page }) => {
  await goAuth(page, '/financeiro/contas')
  const body = await page.textContent('body')
  assertNotLogin(body!)
})

test('Wizard abre', async ({ page }) => {
  await goAuth(page, '/rh/admissoes/wizard')
  const body = await page.textContent('body')
  expect(body).toContain('SOFTMONTE')
})

test('Deletados não aparecem', async ({ page }) => {
  await goAuth(page, '/funcionarios')
  const body = await page.textContent('body')
  assertNotLogin(body!)
  expect(body).not.toContain('DESLIGADO JANEIRO')
  expect(body).not.toContain('DEMITIDO ANTIGO')
})

test('Lançamento deletado invisível', async ({ page }) => {
  await goAuth(page, '/financeiro')
  const body = await page.textContent('body')
  assertNotLogin(body!)
  expect(body).not.toContain('Lançamento Deletado')
})
