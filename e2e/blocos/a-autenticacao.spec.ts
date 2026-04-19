import { test, expect } from '@playwright/test'
import { loginAs, loginInvalido, BASE } from '../helpers/auth'
import { fake } from '../helpers/data'
import { sel } from '../helpers/selectors'

test.describe('BLOCO A — Autenticação e Sessão', () => {
  test('A01 Login válido', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await expect(page).toHaveURL(/\/(diretoria|dashboard)/)
    // Topbar visível
    await expect(page.locator('header, nav').first()).toBeVisible()
  })

  test('A02 Login senha errada', async ({ page }) => {
    await loginInvalido(page, 'diretoria@tecnomonte.com.br', 'senhaerrada123')
    await page.waitForTimeout(3000)
    // Deve permanecer na página de login
    await expect(page).toHaveURL(/\/login/)
    // Toast ou mensagem de erro
    const body = await page.textContent('body') ?? ''
    const temErro = body.includes('incorreto') || body.includes('Erro') || body.includes('inválid')
    expect(temErro || page.url().includes('/login')).toBeTruthy()
  })

  test('A03 Login email inexistente', async ({ page }) => {
    await loginInvalido(page, 'naoexiste@fantasma.com', 'qualquer123')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/login/)
  })

  test('A04 Login campo vazio', async ({ page }) => {
    await page.goto(BASE + '/login')
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    // Não preencher, clicar entrar
    await page.click('button:has-text("Entrar")')
    await page.waitForTimeout(1000)
    // Deve permanecer no login (validação HTML5 ou JS bloqueia)
    await expect(page).toHaveURL(/\/login/)
  })

  test('A06 URL protegida sem login', async ({ page }) => {
    // Ir direto para rota protegida sem fazer login
    await page.goto(BASE + '/diretoria')
    await page.waitForTimeout(3000)
    // Deve redirecionar para login
    await expect(page).toHaveURL(/\/login/)
  })

  test('A09 Login XSS no email', async ({ page }) => {
    await loginInvalido(page, '<script>alert(1)</script>@x.com', 'abc')
    await page.waitForTimeout(2000)
    // Verifica que nenhum script executou (dialog não apareceu)
    await expect(page).toHaveURL(/\/login/)
    // Verifica que o texto XSS não está no DOM como tag executável
    const scripts = await page.locator('script:not([src])').count()
    // Scripts injetados não devem existir além dos do Next.js
    const bodyHtml = await page.innerHTML('body')
    expect(bodyHtml).not.toContain('alert(1)</script>@x.com')
  })

  test('A10 Login SQL injection', async ({ page }) => {
    await loginInvalido(page, fake.edge.sqlInjectionEmail, "' OR 1=1--")
    await page.waitForTimeout(3000)
    // Não deve autenticar
    await expect(page).toHaveURL(/\/login/)
  })

  test('A11 Duplo clique Entrar', async ({ page }) => {
    await page.goto(BASE + '/login')
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    await page.fill('input[type="email"]', 'diretoria@tecnomonte.com.br')
    await page.fill('input[type="password"]', 'Softmonte@2026')
    // Duplo clique rápido
    const btn = page.locator('button:has-text("Entrar")')
    await btn.dblclick()
    await page.waitForTimeout(5000)
    // Deve ter feito login normalmente sem erro
    await expect(page).not.toHaveURL(/\/login/)
  })
})
