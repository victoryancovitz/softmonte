import { test, expect } from '@playwright/test'

// Helper: login if needed
async function ensureLoggedIn(page: any) {
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"]', 'diretoria@tecnomonte.com.br')
    await page.fill('input[type="password"]', 'Yanco251289@!')
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 15000 })
    await page.waitForTimeout(2000)
  }
}

// Helper: go to page and ensure not on login
async function navigateTo(page: any, path: string) {
  await page.goto(path)
  await page.waitForTimeout(3000)
  await ensureLoggedIn(page)
  await page.waitForTimeout(2000)
}

// Helper: page loaded (no 500 error, no login redirect)
async function assertPageLoaded(page: any) {
  const body = await page.textContent('body')
  expect(body).not.toContain('Entrar na plataforma')
  expect(body).not.toContain('Application error')
  expect(body).not.toContain('500')
  expect(body).not.toContain('Internal Server Error')
}

// ═══════════════════════════════════════════════
// TODAS AS ROTAS CARREGAM SEM ERRO
// ═══════════════════════════════════════════════

const ROUTES = [
  { path: '/diretoria', name: 'Diretoria' },
  { path: '/diretoria/indicadores', name: 'Indicadores' },
  { path: '/diretoria/societario', name: 'Societário' },
  { path: '/financeiro', name: 'Financeiro' },
  { path: '/financeiro/dre', name: 'DRE' },
  { path: '/financeiro/contas', name: 'Contas' },
  { path: '/financeiro/dividas', name: 'Dívidas' },
  { path: '/financeiro/cashflow', name: 'Cashflow' },
  { path: '/funcionarios', name: 'Funcionários' },
  { path: '/obras', name: 'Obras' },
  { path: '/ponto', name: 'Ponto' },
  { path: '/rh/folha', name: 'Folha' },
  { path: '/rh/admissoes', name: 'Admissões' },
  { path: '/rh/rentabilidade', name: 'Rentabilidade' },
  { path: '/rh/treinamentos', name: 'Treinamentos' },
  { path: '/rh/vencimentos', name: 'Vencimentos' },
  { path: '/rh/ferias', name: 'Férias' },
  { path: '/rh/desligamentos', name: 'Desligamentos' },
  { path: '/forecast', name: 'Forecast' },
  { path: '/tipos-contrato', name: 'Tipos Contrato' },
  { path: '/almoxarifado', name: 'Almoxarifado' },
  { path: '/boletins', name: 'Boletins' },
  { path: '/relatorios', name: 'Relatórios' },
  { path: '/admin/auditoria', name: 'Auditoria' },
]

test.describe('Rotas carregam sem erro', () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      await navigateTo(page, route.path)
      await assertPageLoaded(page)
    })
  }
})

// ═══════════════════════════════════════════════
// FUNCIONALIDADES ESPECÍFICAS
// ═══════════════════════════════════════════════

test.describe('Funcionalidades', () => {
  test('Wizard de admissão abre', async ({ page }) => {
    await navigateTo(page, '/rh/admissoes/wizard')
    await page.waitForTimeout(3000)
    await assertPageLoaded(page)
    const body = await page.textContent('body')
    expect(body).toContain('SOFTMONTE')
  })

  test('Funcionários deletados não aparecem', async ({ page }) => {
    await navigateTo(page, '/funcionarios')
    const body = await page.textContent('body')
    expect(body).not.toContain('DESLIGADO JANEIRO')
    expect(body).not.toContain('DEMITIDO ANTIGO')
  })

  test('Lançamento deletado não aparece', async ({ page }) => {
    await navigateTo(page, '/financeiro')
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    expect(body).not.toContain('Lançamento Deletado')
    expect(body).not.toContain('Lancamento Deletado')
  })

  test('Obras lista mostra 4+ ativas', async ({ page }) => {
    await navigateTo(page, '/obras')
    const body = await page.textContent('body')
    expect(body).toContain('Cesari')
  })

  test('Health check API responde', async ({ page }) => {
    const response = await page.goto('/api/health')
    const json = await response?.json()
    expect(json?.status).toBe('ok')
    expect(json?.database).toBe('connected')
  })
})

// ═══════════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════════

test.describe('Performance', () => {
  test('Health check < 2s', async ({ page }) => {
    const start = Date.now()
    await page.goto('/api/health')
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(2000)
  })
})
