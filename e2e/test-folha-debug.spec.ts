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

test('FOLHA DEBUG — fechar com captura de erros', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)

  // Capturar todos os console.log/error do browser
  const consoleMessages: string[] = []
  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => consoleMessages.push(`[PAGE ERROR] ${err.message}`))

  // Capturar respostas de API
  const apiResponses: { url: string; status: number; body: string }[] = []
  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('supabase') && response.status() >= 400) {
      const body = await response.text().catch(() => '(no body)')
      apiResponses.push({ url: url.slice(-80), status: response.status(), body: body.slice(0, 300) })
    }
  })

  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(4000)

  // Selecionar Usiminas Parada Geral
  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()
  const usiIdx = options.findIndex(o => o.includes('Usiminas') && o.includes('Parada'))
  if (usiIdx > 0) {
    await selectObra.selectOption({ index: usiIdx })
    console.log(`  ✅ Obra: ${options[usiIdx]}`)
  } else {
    console.log(`  ❌ Usiminas não encontrada. Opções: ${options.slice(0, 5).join(', ')}`)
    return
  }

  // Março 2026
  const selects = page.locator('select')
  const selectCount = await selects.count()
  console.log(`  Selects na página: ${selectCount}`)

  // O select de mês pode ser o 2º ou 3º
  for (let i = 1; i < selectCount; i++) {
    const opts = await selects.nth(i).locator('option').allTextContents()
    if (opts.some(o => o.includes('Março') || o.includes('Janeiro'))) {
      await selects.nth(i).selectOption({ label: 'Março' })
      console.log(`  ✅ Mês selecionado via select ${i}`)
      break
    }
  }

  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'e2e/screenshots/debug-folha-1-pre.png' })

  // Clicar "Fechar folha"
  const btnFechar = page.locator('button:has-text("Fechar folha")')
  const btnCount = await btnFechar.count()
  console.log(`  Botões "Fechar folha": ${btnCount}`)

  if (btnCount > 0) {
    await btnFechar.click()
    console.log('  ⏳ Clicou em Fechar folha, aguardando...')

    // Aguardar resposta (sucesso ou modal ou erro)
    await page.waitForTimeout(20000)

    await page.screenshot({ path: 'e2e/screenshots/debug-folha-2-pos.png' })

    // Verificar se apareceu modal de divergência
    const bodyText = await page.textContent('body') ?? ''
    if (bodyText.includes('Divergência') || bodyText.includes('Divergencia') || bodyText.includes('composição') || bodyText.includes('composicao')) {
      console.log('  ⚠️ Modal de divergência de composição apareceu!')
      await page.screenshot({ path: 'e2e/screenshots/debug-folha-3-modal.png' })

      // Clicar "Fechar folha mesmo assim"
      const btnMesmoAssim = page.locator('button:has-text("Fechar folha mesmo assim")')
      if (await btnMesmoAssim.count() > 0) {
        await btnMesmoAssim.click()
        console.log('  ⏳ Clicou em "Fechar mesmo assim"...')
        await page.waitForTimeout(20000)
        await page.screenshot({ path: 'e2e/screenshots/debug-folha-4-final.png' })
      }
    }

    // Procurar toasts
    const toastElements = page.locator('[data-sonner-toast], [class*="toast"], [role="status"]')
    const toastCount = await toastElements.count()
    if (toastCount > 0) {
      const toastTexts = await toastElements.allTextContents()
      console.log(`  🔔 Toasts (${toastCount}): ${toastTexts.join(' | ')}`)
    }
  }

  // Reportar console errors
  const errors = consoleMessages.filter(m => m.includes('[error]') || m.includes('[PAGE ERROR]'))
  if (errors.length > 0) {
    console.log(`\n  🐛 Console errors (${errors.length}):`)
    errors.slice(0, 5).forEach(e => console.log(`    ${e.slice(0, 200)}`))
  }

  // Reportar API errors
  if (apiResponses.length > 0) {
    console.log(`\n  🔴 API errors (${apiResponses.length}):`)
    apiResponses.slice(0, 5).forEach(r => console.log(`    ${r.status} ${r.url}\n      ${r.body.slice(0, 150)}`))
  }

  // Verificar se folha realmente fechou
  await page.waitForTimeout(2000)
  const finalBody = await page.textContent('body') ?? ''
  const temFolhaFechada = finalBody.includes('Fechada') && finalBody.includes('Usiminas')
  const temErro = finalBody.includes('Erro:') || finalBody.includes('erro ao')
  console.log(`\n  📊 Resultado final:`)
  console.log(`    Folha listada como fechada: ${temFolhaFechada}`)
  console.log(`    Erro visível: ${temErro}`)
})
