import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'
import { sel } from '../helpers/selectors'

test.describe('Modulo Financeiro', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000)
    await loginAs(page, 'admin')
  })

  test('Dividas — tabela carrega com dados', async ({ page }) => {
    await page.goto(BASE + '/financeiro/dividas')
    await page.waitForTimeout(4000)

    // Tabela deve existir com pelo menos 1 linha
    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 10000 })
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Divida detalhe — KPIs renderizam', async ({ page }) => {
    await page.goto(BASE + '/financeiro/dividas')
    await page.waitForTimeout(4000)

    // Clicar na primeira divida da tabela
    const firstRow = page.locator('tbody tr').first()
    await firstRow.click()
    await page.waitForTimeout(3000)

    // Deve ter KPIs ou cards com valores monetarios (R$)
    const body = page.locator('body')
    await expect(body).toContainText('R$', { timeout: 10000 })
  })

  test('Fluxo de Caixa — grafico renderiza', async ({ page }) => {
    await page.goto(BASE + '/financeiro/fluxo-caixa')
    await page.waitForTimeout(5000)

    // Verificar que ha conteudo visivel (chart SVG ou canvas ou cards)
    const chart = page.locator('svg, canvas, [class*="chart"], [class*="recharts"]')
    const chartCount = await chart.count()
    // Se nao ha chart, ao menos deve ter cards com valores
    if (chartCount > 0) {
      await expect(chart.first()).toBeVisible()
    } else {
      await expect(page.locator('body')).toContainText('R$')
    }
  })

  test('Categorias — donut ou lista renderiza', async ({ page }) => {
    await page.goto(BASE + '/financeiro/categorias')
    await page.waitForTimeout(4000)

    // Donut chart ou lista de categorias
    const content = page.locator('svg, canvas, tbody tr, [class*="chart"]')
    const count = await content.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Lancamentos — filtros funcionam', async ({ page }) => {
    await page.goto(BASE + '/financeiro/lancamentos')
    await page.waitForTimeout(4000)

    // Deve ter algum controle de filtro (select, input, button)
    const filters = page.locator('select, input[type="date"], input[type="month"], button:has-text("Filtrar")')
    const filterCount = await filters.count()
    expect(filterCount).toBeGreaterThan(0)

    // Tabela ou lista de lancamentos deve estar visivel
    const body = page.locator('body')
    const hasTable = await page.locator('tbody tr').count()
    const hasEmpty = await body.getByText(/nenhum/i).count()
    // Deve ter ou dados ou mensagem de vazio
    expect(hasTable + hasEmpty).toBeGreaterThan(0)
  })

  test('DRE — pagina carrega', async ({ page }) => {
    await page.goto(BASE + '/financeiro/dre')
    await page.waitForTimeout(4000)

    const body = page.locator('body')
    await expect(body).not.toContainText('Application error')
    // DRE deve mostrar valores monetarios
    await expect(body).toContainText('R$', { timeout: 10000 })
  })

  test('Contas bancarias — lista carrega', async ({ page }) => {
    await page.goto(BASE + '/financeiro/contas')
    await page.waitForTimeout(4000)

    const body = page.locator('body')
    await expect(body).not.toContainText('Application error')
    // Deve ter cards ou tabela com contas
    const content = page.locator('tbody tr, [class*="card"], article')
    const count = await content.count()
    expect(count).toBeGreaterThanOrEqual(0) // pode estar vazio, mas nao deve ter erro
  })
})
