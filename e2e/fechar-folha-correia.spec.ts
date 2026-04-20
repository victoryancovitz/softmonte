import { test, Page } from '@playwright/test'

const URL = 'https://softmonte.vercel.app'

async function login(page: Page) {
  await page.goto(URL + '/login')
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', 'diretoria@tecnomonte.com.br')
  await page.fill('input[type="password"]', 'Softmonte@2026')
  await page.click('button:has-text("Entrar")')
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(2000)
}

test('FOLHA — fechar Vale Correia TC-04 março', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)
  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(4000)

  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()
  // Buscar especificamente "Correia"
  const idx = options.findIndex(o => o.includes('Correia'))
  if (idx < 0) {
    console.log(`  ❌ Vale Correia não encontrada. Opções: ${options.slice(0, 5).join(', ')}`)
    return
  }
  await selectObra.selectOption({ index: idx })
  console.log(`  ✅ Obra: ${options[idx]}`)
  await page.waitForTimeout(1000)

  // Mês = Março
  const selects = page.locator('select')
  const selectCount = await selects.count()
  for (let i = 1; i < selectCount; i++) {
    const opts = await selects.nth(i).locator('option').allTextContents()
    if (opts.some(o => o.includes('Março') || o.includes('Janeiro'))) {
      await selects.nth(i).selectOption({ label: 'Março' })
      console.log(`  ✅ Mês: Março`)
      break
    }
  }
  await page.waitForTimeout(1000)

  const btnFechar = page.locator('button:has-text("Fechar folha")')
  if (await btnFechar.count() === 0) {
    console.log(`  ℹ️ Botão não encontrado — folha pode já estar fechada`)
    return
  }

  await btnFechar.click()
  console.log(`  ⏳ Fechando folha Vale Correia...`)
  await page.waitForTimeout(25000)

  let body = await page.textContent('body') ?? ''
  if (body.includes('Divergência') || body.includes('composição')) {
    console.log(`  ⚠️ Modal de divergência — confirmando...`)
    const btnMesmoAssim = page.locator('button:has-text("Fechar folha mesmo assim")')
    if (await btnMesmoAssim.count() > 0) {
      await btnMesmoAssim.click()
      await page.waitForTimeout(25000)
    }
  }

  body = await page.textContent('body') ?? ''
  const toasts = await page.locator('[data-sonner-toast], [class*="toast"], [role="alert"]').allTextContents()
  if (toasts.length > 0) console.log(`  📋 Toasts: ${toasts.join(' | ')}`)

  if (body.includes('Fechada') || body.includes('fechada')) {
    console.log(`  ✅ FOLHA FECHADA: Vale Correia`)
  } else {
    await page.screenshot({ path: 'e2e/screenshots/folha-vale-correia.png' })
    console.log(`  ⚠️ Status incerto — ver screenshot`)
  }
})
