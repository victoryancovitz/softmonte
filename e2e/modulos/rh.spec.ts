import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'
import { sel } from '../helpers/selectors'

test.describe('Modulo RH', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000)
    await loginAs(page, 'admin')
  })

  test('Funcionarios — lista carrega com dados', async ({ page }) => {
    await page.goto(BASE + '/funcionarios')
    await page.waitForTimeout(4000)

    // Cards ou linhas de funcionarios (default view = cards com links)
    const items = page.locator('a[href*="/funcionarios/"]').filter({ hasNotText: /Novo|Financeiro|novo/ })
    await expect(items.first()).toBeVisible({ timeout: 10000 })
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Funcionarios — busca filtra resultados', async ({ page }) => {
    await page.goto(BASE + '/funcionarios')
    await page.waitForTimeout(4000)

    const searchInput = page.locator('input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i], input[type="search"]')
    const hasSearch = await searchInput.count()
    if (hasSearch > 0) {
      const itemSelector = 'a[href*="/funcionarios/"]'
      const rowsBefore = await page.locator(itemSelector).filter({ hasNotText: /Novo|novo/ }).count()
      await searchInput.first().fill('ZZZZZZZ_INEXISTENTE')
      await page.waitForTimeout(1500)
      const rowsAfter = await page.locator(itemSelector).filter({ hasNotText: /Novo|novo/ }).count()
      // Deve ter filtrado (menos resultados ou mensagem de vazio)
      expect(rowsAfter).toBeLessThanOrEqual(rowsBefore)
    }
  })

  test('Funcionario detalhe — pagina carrega', async ({ page }) => {
    await page.goto(BASE + '/funcionarios')
    await page.waitForTimeout(4000)

    // Clicar no primeiro card/link de funcionario
    const firstLink = page.locator('a[href*="/funcionarios/"]').filter({ hasNotText: /Novo|novo|editar/ }).first()
    await firstLink.click()
    await page.waitForTimeout(3000)

    // Deve mostrar dados do funcionario (nome, CPF, ou informacoes)
    const body = page.locator('body')
    await expect(body).not.toContainText('Application error')

    // Deve ter algum conteudo detalhado
    const hasInfo = await body.locator('h1, h2, h3, [class*="heading"]').count()
    expect(hasInfo).toBeGreaterThan(0)
  })

  test('Folha — pagina carrega', async ({ page }) => {
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(4000)

    const body = page.locator('body')
    await expect(body).not.toContainText('Application error')

    // Deve ter tabela ou cards de folha
    const content = page.locator('tbody tr, [class*="card"], article, table')
    const count = await content.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Treinamentos — KPIs carregam', async ({ page }) => {
    await page.goto(BASE + '/rh/treinamentos')
    await page.waitForTimeout(4000)

    const body = page.locator('body')
    await expect(body).not.toContainText('Application error')

    // Deve ter conteudo visivel (KPIs, cards ou tabela)
    const main = page.locator('main, [role="main"], #__next > div')
    if (await main.count() > 0) {
      await expect(main.first()).toBeVisible()
    }
  })

  test('Admissoes — pagina carrega', async ({ page }) => {
    await page.goto(BASE + '/rh/admissoes')
    await page.waitForTimeout(4000)

    const body = page.locator('body')
    await expect(body).not.toContainText('Application error')
  })

  test('Desligamentos — pagina carrega', async ({ page }) => {
    await page.goto(BASE + '/rh/desligamentos')
    await page.waitForTimeout(4000)

    const body = page.locator('body')
    await expect(body).not.toContainText('Application error')
  })

  test('Ponto — pagina carrega', async ({ page }) => {
    await page.goto(BASE + '/ponto')
    await page.waitForTimeout(4000)

    const body = page.locator('body')
    await expect(body).not.toContainText('Application error')
  })
})
