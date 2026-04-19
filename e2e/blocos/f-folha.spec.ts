import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO F — Folha de Pagamento', () => {
  // TODO: F01 Fechar folha
  // TODO: F02 Fechar folha duplicada
  // TODO: F03 Folha sem dados de ponto
  // TODO: F04 Folha com func salário zero
  // TODO: F05 Composição divergente
  // TODO: F06 Reverter folha
  // TODO: F07 Holerite individual
  // TODO: F08 Cálculo INSS progressivo

  test('F01 Fechar folha carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
