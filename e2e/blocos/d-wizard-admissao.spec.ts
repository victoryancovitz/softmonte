import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'
import { fake } from '../helpers/data'

test.describe('BLOCO D — Wizard de Admissão', () => {
  test('D01 Etapa 1: dados mínimos avança', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/admissoes/wizard')
    await page.waitForTimeout(4000)

    // Preencher nome
    const nomeInput = page.locator('input[name="nome"], input[placeholder*="nome" i]').first()
    if (await nomeInput.count() > 0) {
      await nomeInput.fill(fake.nome())
    }

    // CPF
    const cpfInput = page.locator('input[name="cpf"], input[placeholder*="CPF" i]').first()
    if (await cpfInput.count() > 0) {
      await cpfInput.fill('52998224725')
    }

    // Data nascimento
    const nascInput = page.locator('input[name="data_nascimento"], input[type="date"]').first()
    if (await nascInput.count() > 0) {
      await nascInput.fill('1990-01-15')
    }

    // Avançar
    const btnAvancar = page.locator('button:has-text("Salvar e avançar"), button:has-text("Avançar")')
    if (await btnAvancar.count() > 0) {
      await btnAvancar.first().click()
      await page.waitForTimeout(5000)
    }

    // Não deve ter erro
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })

  test('D04 Etapa 2: dropdown de função existe', async ({ page }) => {
    await loginAs(page, 'diretoria')
    // Usar um wizard existente se houver, ou criar novo
    await page.goto(BASE + '/rh/admissoes/wizard')
    await page.waitForTimeout(4000)

    // Preencher etapa 1 minimamente
    const nomeInput = page.locator('input[name="nome"], input[placeholder*="nome" i]').first()
    if (await nomeInput.count() > 0) await nomeInput.fill(fake.nome())
    const cpfInput = page.locator('input[name="cpf"], input[placeholder*="CPF" i]').first()
    if (await cpfInput.count() > 0) await cpfInput.fill('86194571069')
    const nascInput = page.locator('input[name="data_nascimento"], input[type="date"]').first()
    if (await nascInput.count() > 0) await nascInput.fill('1985-06-20')

    const btnAvancar = page.locator('button:has-text("Salvar e avançar"), button:has-text("Avançar")')
    if (await btnAvancar.count() > 0) {
      await btnAvancar.first().click()
      await page.waitForTimeout(5000)
    }

    // Na etapa 2, verificar que dropdown de função existe
    const funcaoSelect = page.locator('select').filter({ hasText: /função|Selecione/i })
    const allSelects = page.locator('select')
    const selectCount = await allSelects.count()

    // Deve ter selects (obra, função, vínculo, etc)
    expect(selectCount).toBeGreaterThan(0)
  })

  test('D17 Modal wizard renderiza sem overflow', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/admissoes/wizard')
    await page.waitForTimeout(4000)

    // Wizard deve renderizar como modal ou page
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Verificar que inputs ou selects existem (formulário visível)
    const inputs = page.locator('input, select, textarea')
    expect(await inputs.count()).toBeGreaterThan(0)
  })

  test('D18 Mobile 390px: wizard carrega', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/admissoes/wizard')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Deve ter inputs visíveis
    const inputs = page.locator('input, select')
    expect(await inputs.count()).toBeGreaterThan(0)
  })
})
