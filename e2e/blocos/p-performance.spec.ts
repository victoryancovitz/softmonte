import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO P — Performance e Escala', () => {
  // TODO: P01 Listagem 100+ funcs
  // TODO: P02 BM com 30 funcs
  // TODO: P03 DRE com 1000+ lançamentos
  // TODO: P04 API assistant streaming

  test('P01 Listagem funcionários carrega em tempo aceitável', async ({ page }) => {
    await loginAs(page, 'diretoria')
    const start = Date.now()
    await page.goto(BASE + '/funcionarios')
    await page.waitForTimeout(4000)
    const elapsed = Date.now() - start
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
    // Verifica que carregou em menos de 15 segundos
    expect(elapsed).toBeLessThan(15000)
  })
})
