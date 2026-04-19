import { test, expect } from '@playwright/test'

const BASE = 'https://softmonte.vercel.app'
const SENHA = 'Softmonte@2026'

const CONTAS = [
  { token: 'a1b2c3d4-rh00-4e5f-6g7h-test20260419', email: 'rh@tecnomonte.com.br', role: 'rh' },
  { token: 'a1b2c3d4-eng0-4e5f-6g7h-test20260419', email: 'engenheiro@tecnomonte.com.br', role: 'engenheiro' },
]

test.describe.configure({ mode: 'serial' })

for (const conta of CONTAS) {
  test(`Registrar ${conta.role}`, async ({ page }) => {
    test.setTimeout(90000)

    // Capturar API responses
    const apiResponses: { url: string; status: number; body: string }[] = []
    page.on('response', async (res) => {
      if (res.url().includes('/api/auth')) {
        const body = await res.text().catch(() => '')
        apiResponses.push({ url: res.url(), status: res.status(), body: body.slice(0, 300) })
      }
    })

    // 1. Ir para convite
    await page.goto(`${BASE}/convite/${conta.token}`)
    await page.waitForTimeout(5000)

    // 2. Clicar "Criar minha conta"
    const btnCriarMinha = page.locator('button:has-text("Criar minha conta")')
    if (await btnCriarMinha.count() > 0) {
      await btnCriarMinha.click()
      await page.waitForTimeout(2000)
      console.log(`  ✅ Clicou "Criar minha conta"`)
    } else {
      console.log(`  ❌ Botão "Criar minha conta" não encontrado`)
      return
    }

    // 3. Preencher email (pode estar pre-preenchido)
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.count() > 0) {
      const val = await emailInput.inputValue()
      if (!val) await emailInput.fill(conta.email)
      console.log(`  Email: ${await emailInput.inputValue()}`)
    }

    // 4. Preencher senha e confirmar
    const passwordInputs = page.locator('input[type="password"]')
    const pwCount = await passwordInputs.count()
    console.log(`  Password fields: ${pwCount}`)

    if (pwCount >= 2) {
      await passwordInputs.nth(0).fill(SENHA)
      await page.waitForTimeout(500)
      await passwordInputs.nth(1).fill(SENHA)
      await page.waitForTimeout(500)
    }

    // 5. Screenshot antes de clicar
    await page.screenshot({ path: `e2e/screenshots/reg-${conta.role}-preclick.png`, fullPage: true })

    // 6. Verificar se botão está habilitado
    const btnCriar = page.locator('button:has-text("Criar conta")')
    const btnCount = await btnCriar.count()
    const btnEnabled = btnCount > 0 ? await btnCriar.isEnabled() : false
    console.log(`  Botão "Criar conta": count=${btnCount}, enabled=${btnEnabled}`)

    if (btnCount > 0 && btnEnabled) {
      await btnCriar.click()
      console.log(`  ⏳ Clicou "Criar conta", aguardando...`)
      await page.waitForTimeout(15000)
    } else if (btnCount > 0) {
      // Forçar clique mesmo disabled
      await btnCriar.click({ force: true })
      console.log(`  ⏳ Forçou clique no botão disabled`)
      await page.waitForTimeout(15000)
    }

    // 7. Screenshot final
    await page.screenshot({ path: `e2e/screenshots/reg-${conta.role}-result.png`, fullPage: true })

    // 8. Verificar resultado
    const finalBody = await page.textContent('body') ?? ''
    console.log(`  Resultado: ${finalBody.slice(0, 200)}`)

    // 9. API responses
    if (apiResponses.length > 0) {
      console.log(`  API responses:`)
      apiResponses.forEach(r => console.log(`    ${r.status} ${r.url.slice(-40)}: ${r.body.slice(0, 100)}`))
    } else {
      console.log(`  Nenhuma chamada API capturada`)
    }
  })
}
