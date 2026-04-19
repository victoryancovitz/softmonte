import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO N — WhatsApp', () => {
  // TODO: N01 Página config
  // TODO: N02 Painel vazio
  // TODO: N03 Confirmar token inválido
  // TODO: N04 Confirmar CPF errado 3x
  // TODO: N05 API send sem auth
  // TODO: N06 Webhook sem assinatura

  test('N01 Página WhatsApp carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/whatsapp')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
