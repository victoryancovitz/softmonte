import { test, expect } from '@playwright/test'

const BASE = 'https://softmonte.vercel.app'
const SENHA = 'Softmonte@2026'

const CONTAS = [
  { token: 'a1b2c3d4-rh00-4e5f-6g7h-test20260419', email: 'rh@tecnomonte.com.br', role: 'rh' },
  { token: 'a1b2c3d4-eng0-4e5f-6g7h-test20260419', email: 'engenheiro@tecnomonte.com.br', role: 'engenheiro' },
]

test.describe.configure({ mode: 'serial' })

for (const conta of CONTAS) {
  test(`Registrar ${conta.role} (${conta.email})`, async ({ page }) => {
    test.setTimeout(60000)

    // 1. Ir para convite
    await page.goto(`${BASE}/convite/${conta.token}`)
    await page.waitForTimeout(5000)

    // Screenshot para debug
    await page.screenshot({ path: `e2e/screenshots/convite-${conta.role}-1.png`, fullPage: true })

    const body = await page.textContent('body') ?? ''
    console.log(`  Página: ${body.slice(0, 200)}...`)

    // 2. Se tem botão "Criar minha conta", clicar
    const btnCriarMinha = page.locator('button:has-text("Criar minha conta")')
    if (await btnCriarMinha.count() > 0) {
      await btnCriarMinha.click()
      await page.waitForTimeout(2000)
    }

    // 3. Preencher form
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.count() > 0) {
      const val = await emailInput.inputValue()
      if (!val) await emailInput.fill(conta.email)
    }

    const passwordInputs = page.locator('input[type="password"]')
    const pwCount = await passwordInputs.count()
    if (pwCount >= 2) {
      await passwordInputs.nth(0).fill(SENHA)
      await passwordInputs.nth(1).fill(SENHA)
    } else if (pwCount === 1) {
      await passwordInputs.nth(0).fill(SENHA)
    }

    await page.screenshot({ path: `e2e/screenshots/convite-${conta.role}-2.png`, fullPage: true })

    // 4. Clicar criar
    const btnCriar = page.locator('button:has-text("Criar conta")')
    if (await btnCriar.count() > 0) {
      await btnCriar.click()
      await page.waitForTimeout(10000)
    }

    await page.screenshot({ path: `e2e/screenshots/convite-${conta.role}-3.png`, fullPage: true })

    const finalBody = await page.textContent('body') ?? ''
    if (finalBody.includes('sucesso') || finalBody.includes('login') || finalBody.includes('criada')) {
      console.log(`  ✅ ${conta.role} registrado`)
    } else if (finalBody.includes('inválido') || finalBody.includes('expirou') || finalBody.includes('já foi')) {
      console.log(`  ❌ ${conta.role}: convite inválido/usado — ${finalBody.slice(0, 100)}`)
    } else {
      console.log(`  ⚠️ ${conta.role}: status incerto`)
    }
  })
}
