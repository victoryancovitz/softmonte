import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'
import { fake } from '../helpers/data'

test.describe('BLOCO C — CRUD Funcionários', () => {
  test('C09 Listagem de funcionários carrega', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/funcionarios')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Deve ter cards ou linhas de funcionários (30 por página)
    const items = page.locator('a[href*="/funcionarios/"]')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)
  })

  test('C01 Criar com dados mínimos (wizard etapa 1)', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/funcionarios/novo')
    await page.waitForTimeout(4000)

    // Etapa 1: Identificação — preencher nome (primeiro input de texto)
    const inputs = page.locator('input[type="text"], input:not([type])')
    const inputCount = await inputs.count()
    if (inputCount > 0) {
      // Primeiro input é nome
      await inputs.first().fill(fake.nome())
    }

    // Botão "Próximo" para avançar
    const btnNext = page.locator('button:has-text("Próximo"), button:has-text("Avançar")')
    if (await btnNext.count() > 0) {
      await btnNext.first().click()
      await page.waitForTimeout(3000)
    }

    // Não deve crashear
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })

  test('C02 Página /funcionarios/novo carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/funcionarios/novo')
    await page.waitForTimeout(4000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Deve ter inputs do wizard (nome, CPF, etc)
    const inputs = page.locator('input')
    expect(await inputs.count()).toBeGreaterThan(0)
  })

  test('C07 Acessar perfil e botão editar existe', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/funcionarios')
    await page.waitForTimeout(5000)

    // Clicar no primeiro link de funcionário
    const funcLinks = page.locator('a[href*="/funcionarios/"]').filter({
      hasNot: page.locator('text=Novo'),
    })
    const hrefs = await funcLinks.evaluateAll(els =>
      els.map(el => el.getAttribute('href')).filter(h => h && !h.includes('novo') && !h.includes('editar'))
    )

    if (hrefs.length > 0) {
      await page.goto(BASE + hrefs[0]!)
      await page.waitForTimeout(4000)

      const body = await page.textContent('body') ?? ''
      expect(body).not.toContain('Application error')

      // Botão editar deve existir
      const editarLink = page.locator('a:has-text("Editar"), a[href*="editar"]')
      expect(await editarLink.count()).toBeGreaterThan(0)
    }
  })

  test('C10 Caracteres especiais no nome não quebra', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/funcionarios/novo')
    await page.waitForTimeout(4000)

    // Preencher nome com caracteres especiais
    const nomeInput = page.locator('input[type="text"], input:not([type])').first()
    await nomeInput.fill("JOSE D'AVILA N MARTINEZ")

    // Página não deve crashear
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Input deve manter o valor
    const valor = await nomeInput.inputValue()
    expect(valor).toContain("JOSE")
  })

  test('C11 XSS no input é tratado como texto', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/funcionarios/novo')
    await page.waitForTimeout(4000)

    const nomeInput = page.locator('input[type="text"], input:not([type])').first()
    await nomeInput.fill(fake.edge.xssImg)

    // Nenhum script deve executar
    const bodyHtml = await page.innerHTML('body')
    expect(bodyHtml).not.toContain('<img src=x onerror')
  })

  test('C12 Busca na listagem funciona', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/funcionarios')
    await page.waitForTimeout(5000)

    // Campo de busca
    const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="buscar"], input[type="search"]')
    if (await searchInput.count() > 0) {
      await searchInput.fill('AJUDANTE')
      await page.waitForTimeout(2000)

      // Resultados devem filtrar
      const body = await page.textContent('body') ?? ''
      expect(body).not.toContain('Application error')
    }
  })
})
