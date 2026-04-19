import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO I — Desligamento', () => {
  // TODO: I01 Iniciar desligamento
  // TODO: I02 Wizard 8 etapas
  // TODO: I03 Concluir desligamento
  // TODO: I04 Func desligado no ponto
  // TODO: I05 Perfil desligado
  // TODO: I06 Desligamento duplicado

  test('I01 Página desligamentos carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/desligamentos')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
