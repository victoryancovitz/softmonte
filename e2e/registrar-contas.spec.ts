import { test, expect } from '@playwright/test'

const CONTAS = [
  { token: 'conv-encarregado-test-2026', email: 'encarregado@tecnomonte.com.br', role: 'encarregado' },
  { token: 'conv-rh-test-2026', email: 'rh@tecnomonte.com.br', role: 'rh' },
  { token: 'conv-financeiro-test-2026', email: 'financeiro@tecnomonte.com.br', role: 'financeiro' },
  { token: 'conv-engenheiro-test-2026', email: 'engenheiro@tecnomonte.com.br', role: 'engenheiro' },
  { token: 'conv-funcionario-test-2026', email: 'funcionario@tecnomonte.com.br', role: 'funcionario' },
]

const SENHA = 'Softmonte@2026'

test.describe.configure({ mode: 'serial' })

for (const conta of CONTAS) {
  test(`Registrar conta: ${conta.role} (${conta.email})`, async ({ page }) => {
    // 1. Visit the invitation URL
    await page.goto(`/convite/${conta.token}`, { waitUntil: 'networkidle' })

    // 2. Wait for the welcome screen ("boas_vindas") — click "Criar minha conta"
    const btnCriarMinha = page.getByRole('button', { name: /criar minha conta/i })
    await expect(btnCriarMinha).toBeVisible({ timeout: 15000 })
    await btnCriarMinha.click()

    // 3. Now on the "cadastro" form — fill email if empty, fill password + confirm
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible({ timeout: 5000 })

    // Email should already be pre-filled, but let's make sure
    const emailValue = await emailInput.inputValue()
    if (!emailValue) {
      await emailInput.fill(conta.email)
    }

    // Fill password
    const passwordInputs = page.locator('input[type="password"]')
    await passwordInputs.nth(0).fill(SENHA)
    await passwordInputs.nth(1).fill(SENHA)

    // 4. Click "Criar conta" submit button
    const btnCriar = page.getByRole('button', { name: /^criar conta$/i })
    await expect(btnCriar).toBeEnabled({ timeout: 3000 })
    await btnCriar.click()

    // 5. Wait for success screen
    const successHeading = page.getByText('Conta criada com sucesso')
    await expect(successHeading).toBeVisible({ timeout: 20000 })

    console.log(`[OK] ${conta.role} — ${conta.email} registrado com sucesso`)
  })
}
