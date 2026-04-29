import { test, expect } from '@playwright/test'
import { loginAs, BASE, Role } from '../helpers/auth'

test.describe.configure({ mode: 'serial' })

/**
 * Varredura de smoke: navega em todas as paginas acessiveis por role
 * e verifica que nenhuma retorna erro 500 ou tela em branco.
 */

const PAGES_BY_ROLE: Record<string, string[]> = {
  admin: [
    '/financeiro',
    '/financeiro/dividas',
    '/financeiro/fluxo-caixa',
    '/financeiro/categorias',
    '/financeiro/dre',
    '/financeiro/contas',
    '/financeiro/lixeira',
    '/funcionarios',
    '/rh/folha',
    '/rh/admissoes',
    '/rh/desligamentos',
    '/ponto',
    '/rh/treinamentos',
    '/obras',
    '/boletins',
    '/juridico',
    '/juridico/processos',
    '/juridico/acordos',
    '/juridico/audiencias',
    '/diretoria',
    '/cadastros',
    '/cadastros/funcoes',
    '/clientes',
    '/cc',
    '/cc/estrutura',
  ],
  rh: [
    '/funcionarios',
    '/rh/folha',
    '/rh/admissoes',
    '/rh/desligamentos',
    '/ponto',
    '/rh/treinamentos',
    '/obras',
    '/boletins',
  ],
  financeiro: [
    '/financeiro',
    '/financeiro/dividas',
    '/financeiro/fluxo-caixa',
    '/financeiro/categorias',
    '/financeiro/dre',
    '/financeiro/contas',
    '/financeiro/lixeira',
    '/obras',
    '/boletins',
  ],
  engenheiro: [
    '/obras',
    '/boletins',
    '/ponto',
    '/funcionarios',
  ],
}

async function assertNoError(page: import('@playwright/test').Page, path: string) {
  const body = page.locator('body')
  await expect(body).not.toContainText('Application error', { timeout: 5000 })
  await expect(body).not.toContainText('500 Internal Server Error', { timeout: 2000 })
  await expect(body).not.toContainText('This page could not be found', { timeout: 2000 })

  // Page should have visible main content (not blank)
  const main = page.locator('main, [role="main"], #__next > div')
  const count = await main.count()
  if (count > 0) {
    await expect(main.first()).toBeVisible({ timeout: 5000 })
  }
}

for (const [role, pages] of Object.entries(PAGES_BY_ROLE)) {
  test.describe(`Varredura — ${role}`, () => {
    for (const path of pages) {
      test(`${role}: ${path} carrega sem erro`, async ({ page }) => {
        test.setTimeout(60000)
        await loginAs(page, role as Role)
        await page.goto(BASE + path)
        await page.waitForTimeout(3000)
        await assertNoError(page, path)
      })
    }
  })
}
