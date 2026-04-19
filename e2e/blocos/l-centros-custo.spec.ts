import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO L — Centros de Custo', () => {
  // TODO: L01 Criar CC administrativo
  // TODO: L02 Custos fixos gerar
  // TODO: L03 Transferir equipamento
  // TODO: L04 Merge CC duplicado
  // TODO: L05 Merge com auto-referência
  // TODO: L06 DRE por CC
  // TODO: L07 Rateio configurar

  test('L01 Página centros de custo carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/cc')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
