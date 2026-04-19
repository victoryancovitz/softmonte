import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO J — Financeiro', () => {
  // TODO: J01 Criar lançamento
  // TODO: J02 Filtrar por CC
  // TODO: J03 DRE por obra
  // TODO: J04 DRE consolidada
  // TODO: J05 Valor zero
  // TODO: J06 Valor negativo
  // TODO: J07 QuickCreate CC

  test('J01 Página financeiro carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/financeiro')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
