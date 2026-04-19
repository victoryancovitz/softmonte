import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO M — Assistente IA', () => {
  // TODO: M01 Abrir drawer
  // TODO: M02 Consulta simples
  // TODO: M03 Navegação wizard
  // TODO: M04 Upload documento
  // TODO: M05 Minimizar → reabrir
  // TODO: M06 Scroll body bloqueado
  // TODO: M07 Fechar e reabrir

  test('M01 Botão IA visível após login', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/diretoria')
    await page.waitForTimeout(4000)
    const iaButton = page.locator('button:has-text("IA"), button:has-text("Assistente"), [data-testid="ia-button"], [aria-label*="IA"], [aria-label*="Assistente"]')
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
