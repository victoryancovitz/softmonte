import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO H — Forecast', () => {
  // TODO: H01 Gerar forecast
  // TODO: H02 Meses parciais
  // TODO: H03 Regerar
  // TODO: H04 Limpar
  // TODO: H05 Obra sem composição
  // TODO: H06 Toggle checks
  // TODO: H07 Coluna dias úteis

  test('H01 Página forecast carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/forecast')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
