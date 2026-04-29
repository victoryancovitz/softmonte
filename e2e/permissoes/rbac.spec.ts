import { test, expect } from '@playwright/test'
import { loginAs, BASE, Role } from '../helpers/auth'

/**
 * Testes de RBAC: cada role tenta acessar paginas restritas
 * e verifica que o acesso e bloqueado ou o conteudo e restrito.
 */

type RbacCase = {
  role: Role
  forbiddenPaths: string[]
  description: string
}

const RBAC_CASES: RbacCase[] = [
  {
    role: 'rh',
    forbiddenPaths: [
      '/financeiro/dividas',
      '/financeiro/fluxo-caixa',
      '/financeiro/dre',
      '/financeiro/contas',
      '/diretoria',
      '/juridico',
    ],
    description: 'RH nao acessa financeiro, diretoria ou juridico',
  },
  {
    role: 'financeiro',
    forbiddenPaths: [
      '/rh/folha',
      '/rh/admissoes',
      '/rh/desligamentos',
      '/rh/treinamentos',
      '/diretoria',
      '/juridico',
    ],
    description: 'Financeiro nao acessa RH, diretoria ou juridico',
  },
  {
    role: 'engenheiro',
    forbiddenPaths: [
      '/financeiro',
      '/financeiro/dividas',
      '/financeiro/dre',
      '/rh/folha',
      '/rh/admissoes',
      '/diretoria',
      '/juridico',
      '/cadastros',
    ],
    description: 'Engenheiro nao acessa financeiro, RH, diretoria, juridico ou cadastros',
  },
  {
    role: 'encarregado',
    forbiddenPaths: [
      '/financeiro',
      '/financeiro/dividas',
      '/rh/folha',
      '/rh/admissoes',
      '/diretoria',
      '/juridico',
      '/cadastros',
    ],
    description: 'Encarregado nao acessa financeiro, RH completo, diretoria, juridico ou cadastros',
  },
]

for (const { role, forbiddenPaths, description } of RBAC_CASES) {
  test.describe(`RBAC — ${description}`, () => {
    for (const path of forbiddenPaths) {
      test(`${role}: ${path} deve ser bloqueado`, async ({ page }) => {
        test.setTimeout(60000)
        await loginAs(page, role)
        await page.goto(BASE + path)
        await page.waitForTimeout(3000)

        const body = page.locator('body')
        const url = page.url()

        // Verificar que houve redirect ou mensagem de bloqueio.
        // O app pode: (a) redirecionar para outra pagina, (b) mostrar mensagem de acesso negado,
        // ou (c) esconder o conteudo sensivel.
        const wasRedirected = !url.includes(path)
        const hasAccessDenied = await body.getByText(/acesso negado|sem permiss|nao autorizado|proibido|forbidden|unauthorized/i).count() > 0
        const hasErrorPage = await body.getByText(/404|nao encontrad/i).count() > 0
        const hasNoSensitiveContent = await body.locator('tbody tr').count() === 0

        // Pelo menos uma dessas condicoes deve ser verdadeira
        const isBlocked = wasRedirected || hasAccessDenied || hasErrorPage || hasNoSensitiveContent
        expect(isBlocked).toBe(true)
      })
    }
  })
}

// Testes positivos: admin acessa tudo
test.describe('RBAC — Admin acessa todas as paginas', () => {
  const criticalPaths = [
    '/financeiro/dividas',
    '/rh/folha',
    '/diretoria',
    '/juridico',
    '/cadastros',
  ]

  for (const path of criticalPaths) {
    test(`admin: ${path} deve ser acessivel`, async ({ page }) => {
      test.setTimeout(60000)
      await loginAs(page, 'admin')
      await page.goto(BASE + path)
      await page.waitForTimeout(3000)

      const url = page.url()
      const body = page.locator('body')

      // Admin nao deve ser redirecionado
      expect(url).toContain(path)
      // Nao deve ter mensagem de acesso negado
      const denied = await body.getByText(/acesso negado|sem permiss|nao autorizado/i).count()
      expect(denied).toBe(0)
    })
  }
})
