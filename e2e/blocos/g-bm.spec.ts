import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO G — Boletim de Medição', () => {
  // TODO: G01 Criar BM
  // TODO: G02 BM sem funcionários no período
  // TODO: G03 Aprovar BM
  // TODO: G04 Aprovar BM → verifica lançamento
  // TODO: G05 Exportar Excel
  // TODO: G06 BM com capitalização diferente
  // TODO: G07 Editar BM aprovado

  test('G01 Página nova BM carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/boletins/nova')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})
