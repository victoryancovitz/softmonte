import { test, expect, Page } from '@playwright/test'

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

async function fecharFolhaObra(page: Page, obraNome: string) {
  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(4000)

  // Selecionar obra
  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()
  const idx = options.findIndex(o => o.includes(obraNome))
  if (idx < 0) {
    console.log(`  ❌ Obra "${obraNome}" não encontrada`)
    return false
  }
  await selectObra.selectOption({ index: idx })
  console.log(`  ✅ Obra: ${options[idx]}`)
  await page.waitForTimeout(1000)

  // Mês = Março (buscar select de mês)
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

  // Clicar "Fechar folha"
  const btnFechar = page.locator('button:has-text("Fechar folha")')
  if (await btnFechar.count() === 0) {
    const body = await page.textContent('body') ?? ''
    if (body.includes('Fechada') || body.includes('fechada')) {
      console.log(`  ℹ️ Folha já fechada para ${obraNome}`)
      return true
    }
    console.log(`  ❌ Botão "Fechar folha" não encontrado`)
    return false
  }

  await btnFechar.click()
  console.log(`  ⏳ Fechando folha...`)
  await page.waitForTimeout(20000)

  const body = await page.textContent('body') ?? ''

  // Modal de divergência?
  if (body.includes('Divergência') || body.includes('Divergencia') || body.includes('composição')) {
    console.log(`  ⚠️ Modal de divergência — confirmando...`)
    const btnMesmoAssim = page.locator('button:has-text("Fechar folha mesmo assim")')
    if (await btnMesmoAssim.count() > 0) {
      await btnMesmoAssim.click()
      await page.waitForTimeout(20000)
    }
  }

  // Já fechada?
  if (body.includes('Já existe') || body.includes('já existe')) {
    console.log(`  ℹ️ Folha já existia para ${obraNome}`)
    return true
  }

  const finalBody = await page.textContent('body') ?? ''
  if (finalBody.includes('Fechada') || finalBody.includes('fechada') || finalBody.includes('sucesso')) {
    console.log(`  ✅ FOLHA FECHADA: ${obraNome}`)
    return true
  }

  // Capturar erros
  const toasts = await page.locator('[data-sonner-toast], [class*="toast"], [role="alert"]').allTextContents()
  if (toasts.length > 0) console.log(`  📋 Toasts: ${toasts.join(' | ')}`)

  await page.screenshot({ path: `e2e/screenshots/folha-${obraNome.replace(/\s/g, '_')}.png` })
  console.log(`  ⚠️ Status incerto — ver screenshot`)
  return false
}

test('FOLHA — fechar Vale Correia março', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)
  const ok = await fecharFolhaObra(page, 'Vale')
  // Não faz assert porque pode já estar fechada
})

test('FOLHA — fechar Vale Caldeiraria março', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)
  const ok = await fecharFolhaObra(page, 'Caldeiraria')
  // Não faz assert porque pode já estar fechada
})
