import { test, Page } from '@playwright/test'

const URL = 'https://softmonte.vercel.app'

async function login(page: Page) {
  await page.goto(URL + '/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', 'diretoria@tecnomonte.com.br')
  await page.fill('input[type="password"]', 'Softmonte@2026')
  await page.click('button:has-text("Entrar")')
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(2000)
}

test('DEBUG — criar 1 cliente', async ({ page }) => {
  test.setTimeout(60000)
  await login(page)
  await page.goto(URL + '/clientes/novo')
  await page.waitForTimeout(3000)

  // Listar todos os inputs na página
  const inputs = await page.locator('input').evaluateAll(els =>
    els.map(el => ({ name: el.getAttribute('name'), type: el.getAttribute('type'), placeholder: el.getAttribute('placeholder'), id: el.getAttribute('id') }))
  )
  console.log('  INPUTS:', JSON.stringify(inputs, null, 2))

  // Listar botões
  const buttons = await page.locator('button').allTextContents()
  console.log('  BUTTONS:', buttons)

  // Preencher nome (primeiro input de texto)
  const nomeInput = page.locator('input').first()
  await nomeInput.fill('TESTE CLIENTE DEBUG')
  console.log('  ✅ Nome preenchido')

  // Screenshot
  await page.screenshot({ path: 'e2e/screenshots/pop-debug-cliente.png', fullPage: true })

  // Clicar botão de salvar
  const btnSalvar = page.locator('button:has-text("Criar cliente"), button:has-text("Salvar"), button[type="submit"]')
  const btnCount = await btnSalvar.count()
  console.log(`  Botão salvar count: ${btnCount}`)
  if (btnCount > 0) {
    await btnSalvar.first().click()
    await page.waitForTimeout(5000)
    console.log(`  URL após salvar: ${page.url()}`)
  }
})
