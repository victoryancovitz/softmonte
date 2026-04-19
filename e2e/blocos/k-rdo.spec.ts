import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO K — RDO (Diário de Obra)', () => {
  // TODO: K01 Criar RDO
  // TODO: K02 Importar Excel
  // TODO: K03 Workflow aprovação
  // TODO: K04 Assinatura digital
  // TODO: K05 Exportar PDF
  // TODO: K06 Ocorrência com claim

  test('K01 Página diário de obra carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/obras')
    await page.waitForTimeout(4000)
    // Navega para a primeira obra com tab diário
    const link = page.locator('a[href*="/obras/"]').first()
    if (await link.count() > 0) {
      const href = await link.getAttribute('href') ?? ''
      await page.goto(BASE + href + '?tab=diario')
      await page.waitForTimeout(4000)
    }
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
