import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO O — Responsividade e UI', () => {
  // TODO: O01 Mobile 390px: login
  // TODO: O02 Mobile: menu hamburger
  // TODO: O03 Mobile: wizard
  // TODO: O04 Desktop 1920px: tabelas
  // TODO: O05 Dropdown "Mais ▾"
  // TODO: O06 Zoom 200%

  test('O01 Login em viewport mobile carrega sem erro', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/diretoria')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
