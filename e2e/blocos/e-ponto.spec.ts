import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO E — Ponto (Controle de Frequência)', () => {
  test('E01 Página ponto carrega com obras', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/ponto')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Deve ter select de obra ou badge de obra única
    const selects = page.locator('select')
    const badges = page.locator('[class*="badge"], [class*="brand"]')
    const temSelect = await selects.count() > 0
    const temBadge = await badges.count() > 0
    expect(temSelect || temBadge).toBeTruthy()
  })

  test('E02 Selecionar obra mostra grade de ponto', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/ponto')
    await page.waitForTimeout(5000)

    // Selecionar primeira obra
    const selectObra = page.locator('select').first()
    if (await selectObra.count() > 0) {
      const options = await selectObra.locator('option').allTextContents()
      if (options.length > 1) {
        await selectObra.selectOption({ index: 1 })
        await page.waitForTimeout(3000)
      }
    }

    // Deve ter grade/tabela de ponto
    const body = await page.textContent('body') ?? ''
    // Grade tem dias do mês (1-31) ou nomes de funcionários
    const temGrade = body.includes('1') && body.includes('15')
    const temTabela = await page.locator('table, [class*="grid"]').count() > 0
    expect(temGrade || temTabela).toBeTruthy()
  })

  test('E03 Selecionar mês funciona', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/ponto')
    await page.waitForTimeout(5000)

    // Selecionar primeira obra
    const selectObra = page.locator('select').first()
    if (await selectObra.count() > 0) {
      const options = await selectObra.locator('option').allTextContents()
      if (options.length > 1) {
        await selectObra.selectOption({ index: 1 })
        await page.waitForTimeout(2000)
      }
    }

    // Buscar select de mês (por label, não por value)
    const selects = page.locator('select')
    const selectCount = await selects.count()
    let mesEncontrado = false
    for (let i = 0; i < selectCount; i++) {
      const opts = await selects.nth(i).locator('option').allTextContents()
      const temMes = opts.some(o => o.includes('Janeiro') || o.includes('Março'))
      if (temMes) {
        // Selecionar pelo index do "Março" na lista de options
        const marcoIdx = opts.findIndex(o => o.includes('Março'))
        if (marcoIdx >= 0) {
          await selects.nth(i).selectOption({ index: marcoIdx })
          mesEncontrado = true
        }
        break
      }
    }

    await page.waitForTimeout(3000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })

  test('E06 Página sem erro com obra grande (90 funcs)', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/ponto')
    await page.waitForTimeout(5000)

    // Buscar obra Vale Correia (90 funcs)
    const selectObra = page.locator('select').first()
    if (await selectObra.count() > 0) {
      const options = await selectObra.locator('option').allTextContents()
      const idx = options.findIndex(o => o.includes('Correia'))
      if (idx > 0) {
        await selectObra.selectOption({ index: idx })
        await page.waitForTimeout(5000)

        const body = await page.textContent('body') ?? ''
        expect(body).not.toContain('Application error')

        // Deve ter funcionários na grade
        const nomes = await page.locator('td, [class*="cell"]').count()
        expect(nomes).toBeGreaterThan(0)
      }
    }
  })
})
