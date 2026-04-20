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

test('FOLHA CORREIA v3 — screenshots intermediários', async ({ page }) => {
  test.setTimeout(240000)

  const logs: string[] = []
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`))

  await login(page)
  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(4000)

  // Selecionar Correia
  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()
  const idx = options.findIndex(o => o.includes('Correia'))
  await selectObra.selectOption({ index: idx })
  console.log(`  ✅ Obra: ${options[idx]}`)
  await page.waitForTimeout(1000)

  // Mês = Março
  const selects = page.locator('select')
  for (let i = 1; i < await selects.count(); i++) {
    const opts = await selects.nth(i).locator('option').allTextContents()
    if (opts.some(o => o.includes('Março'))) {
      await selects.nth(i).selectOption({ label: 'Março' })
      break
    }
  }
  await page.waitForTimeout(1000)

  // Clicar Fechar folha
  const btn = page.locator('button:has-text("Fechar folha")')
  const btnCount = await btn.count()
  console.log(`  Botão count: ${btnCount}`)
  if (btnCount === 0) {
    console.log('  ❌ Sem botão - pode estar já fechada')
    return
  }

  await btn.click()
  console.log('  ⏳ Clicou...')

  // Screenshots a cada 3 segundos por 60 segundos
  for (let s = 3; s <= 60; s += 3) {
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `e2e/screenshots/correia-v3-${s}s.png` })

    const body = await page.textContent('body') ?? ''

    // Detectar modal
    if (body.includes('Divergencia') || body.includes('mesmo assim')) {
      console.log(`  ⚠️ Modal detectado em ${s}s!`)

      // Clicar "Fechar folha mesmo assim"
      const btnMesmo = page.locator('button:has-text("Fechar folha mesmo assim")')
      if (await btnMesmo.count() > 0) {
        await btnMesmo.click()
        console.log(`  ⏳ Confirmou em ${s}s`)
        await page.waitForTimeout(40000)
        await page.screenshot({ path: `e2e/screenshots/correia-v3-final.png` })
      }
      break
    }

    // Detectar sucesso
    if (body.includes('fechada:') || body.includes('sucesso')) {
      console.log(`  ✅ Sucesso detectado em ${s}s!`)
      break
    }

    // Detectar erro toast
    const toasts = await page.locator('[data-sonner-toast]').allTextContents()
    if (toasts.some(t => t.includes('Erro'))) {
      console.log(`  ❌ Erro em ${s}s: ${toasts.join(' | ')}`)
      break
    }

    console.log(`  ${s}s: aguardando... (btn disabled=${await btn.isDisabled().catch(() => 'N/A')})`)
  }

  // Dump errors
  const errors = logs.filter(l => l.includes('[error]') || l.includes('[PAGE_ERROR]'))
  if (errors.length > 0) {
    console.log(`\n  🐛 Erros (${errors.length}):`)
    errors.slice(0, 5).forEach(e => console.log(`    ${e.slice(0, 250)}`))
  }

  // Final check DB
  console.log('\n  📊 Final page text check:')
  const finalBody = await page.textContent('body') ?? ''
  console.log(`    Texto "Correia" + "Fechada": ${finalBody.includes('Correia') && finalBody.includes('Fechada')}`)
})
