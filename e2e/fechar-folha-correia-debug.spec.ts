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

test('DEBUG — fechar Vale Correia com captura de erros', async ({ page }) => {
  test.setTimeout(180000)

  // Capturar tudo
  const logs: string[] = []
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`))

  const apiErrors: { url: string; status: number; body: string }[] = []
  page.on('response', async (res) => {
    if (res.url().includes('supabase') && res.status() >= 400) {
      const body = await res.text().catch(() => '(no body)')
      apiErrors.push({ url: res.url().slice(-100), status: res.status(), body: body.slice(0, 500) })
    }
  })

  await login(page)
  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(4000)

  // Selecionar Vale Correia
  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()
  const idx = options.findIndex(o => o.includes('Correia'))
  if (idx < 0) {
    console.log(`  ❌ Vale Correia não encontrada`)
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
  await page.waitForTimeout(2000)

  // Screenshot antes
  await page.screenshot({ path: 'e2e/screenshots/correia-debug-1-pre.png', fullPage: true })

  // Status da página antes de clicar
  const preBody = await page.textContent('body') ?? ''
  const temBtnFechar = await page.locator('button:has-text("Fechar folha")').count()
  const temFechada = preBody.includes('Fechada')
  console.log(`  📊 PRE: botão Fechar=${temBtnFechar}, texto Fechada=${temFechada}`)

  if (temBtnFechar === 0) {
    console.log(`  ❌ Sem botão "Fechar folha"`)
    // Verificar se já está fechada
    if (temFechada) console.log(`  ℹ️ Parece já estar fechada`)
    // Dump de erros
    const errors = logs.filter(l => l.includes('[error]') || l.includes('[PAGE_ERROR]'))
    if (errors.length > 0) {
      console.log(`\n  🐛 Erros (${errors.length}):`)
      errors.forEach(e => console.log(`    ${e.slice(0, 200)}`))
    }
    return
  }

  // Clicar fechar
  await page.locator('button:has-text("Fechar folha")').click()
  console.log(`  ⏳ Clicou em Fechar folha...`)

  // Aguardar processamento
  await page.waitForTimeout(30000)
  await page.screenshot({ path: 'e2e/screenshots/correia-debug-2-pos.png', fullPage: true })

  const postBody = await page.textContent('body') ?? ''

  // Modal de divergência?
  if (postBody.includes('Divergência') || postBody.includes('composição') || postBody.includes('divergen')) {
    console.log(`  ⚠️ Modal de divergência detectado`)
    await page.screenshot({ path: 'e2e/screenshots/correia-debug-3-modal.png', fullPage: true })
    const btnMesmoAssim = page.locator('button:has-text("Fechar folha mesmo assim")')
    const btnCount = await btnMesmoAssim.count()
    console.log(`  Botão "mesmo assim": ${btnCount}`)
    if (btnCount > 0) {
      await btnMesmoAssim.click()
      console.log(`  ⏳ Confirmou fechamento...`)
      await page.waitForTimeout(30000)
      await page.screenshot({ path: 'e2e/screenshots/correia-debug-4-final.png', fullPage: true })
    }
  }

  // Toasts
  const toasts = await page.locator('[data-sonner-toast], [class*="toast"], [role="alert"], [role="status"]').allTextContents()
  if (toasts.length > 0) console.log(`  📋 Toasts: ${toasts.join(' | ')}`)

  // Console errors
  const errors = logs.filter(l => l.includes('[error]') || l.includes('[PAGE_ERROR]'))
  if (errors.length > 0) {
    console.log(`\n  🐛 Console errors (${errors.length}):`)
    errors.slice(0, 10).forEach(e => console.log(`    ${e.slice(0, 300)}`))
  }

  // API errors
  if (apiErrors.length > 0) {
    console.log(`\n  🔴 API errors (${apiErrors.length}):`)
    apiErrors.slice(0, 5).forEach(r => console.log(`    ${r.status} ${r.url}\n      ${r.body.slice(0, 300)}`))
  }

  // Resultado
  const finalBody = await page.textContent('body') ?? ''
  console.log(`\n  📊 RESULTADO:`)
  console.log(`    Texto "Fechada" na página: ${finalBody.includes('Fechada')}`)
  console.log(`    Texto "erro" na página: ${finalBody.toLowerCase().includes('erro')}`)
  console.log(`    Texto "sucesso" na página: ${finalBody.toLowerCase().includes('sucesso')}`)
})
