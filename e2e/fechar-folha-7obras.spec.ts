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

const obras = [
  { fragment: 'Alto-Forno', label: 'HH CSN - Alto-Forno 3', alocados: 150 },
  { fragment: 'Laminação', label: 'HH Usiminas - Laminação', alocados: 90 },
  { fragment: 'Coqueria', label: 'HH CSN - Coqueria', alocados: 55 },
  { fragment: 'Braskem', label: 'HH Braskem - Parada PP3', alocados: 40 },
  { fragment: 'SE-03', label: 'HH Vale - Elétrica SE-03', alocados: 35 },
  { fragment: 'U-200', label: 'HH Replan - Tubulação U-200', alocados: 30 },
  { fragment: 'Secador', label: 'HH Klabin - Secador', alocados: 25 },
]

for (const obra of obras) {
  test(`Fechar folha Março 2026 — ${obra.label} (${obra.alocados} alocados)`, async ({ page }) => {
    test.setTimeout(180000)

    const logs: string[] = []
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
    page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`))

    // 1. Login
    await login(page)

    // 2. Go to /rh/folha
    await page.goto(URL + '/rh/folha')
    await page.waitForTimeout(4000)

    // 3. Select obra
    const selectObra = page.locator('select').first()
    const options = await selectObra.locator('option').allTextContents()
    const idx = options.findIndex(o => o.includes(obra.fragment))
    if (idx === -1) {
      console.log(`  SKIP: Obra "${obra.fragment}" not found in options: ${options.join(', ')}`)
      return
    }
    await selectObra.selectOption({ index: idx })
    console.log(`  Obra selecionada: ${options[idx]}`)
    await page.waitForTimeout(1000)

    // 4. Select Março
    const selects = page.locator('select')
    let monthSelected = false
    for (let i = 1; i < await selects.count(); i++) {
      const opts = await selects.nth(i).locator('option').allTextContents()
      if (opts.some(o => o.includes('Março'))) {
        await selects.nth(i).selectOption({ label: opts.find(o => o.includes('Março'))! })
        monthSelected = true
        console.log(`  Mes: Março`)
        break
      }
    }
    if (!monthSelected) {
      console.log(`  SKIP: Março not found in month selects`)
      return
    }
    await page.waitForTimeout(1000)

    // 5. Click "Fechar folha"
    const btn = page.locator('button:has-text("Fechar folha")')
    const btnCount = await btn.count()
    console.log(`  Botao "Fechar folha" count: ${btnCount}`)
    if (btnCount === 0) {
      console.log(`  SKIP: No "Fechar folha" button — may already be closed`)
      return
    }
    await btn.first().click()
    console.log(`  Clicou "Fechar folha"...`)

    // 6. Wait 3-5 seconds for modal
    await page.waitForTimeout(5000)

    const body1 = await page.textContent('body') ?? ''
    if (body1.includes('Divergencia') || body1.includes('mesmo assim') || body1.includes('divergência') || body1.includes('divergencia')) {
      console.log(`  Modal de divergencia detectado!`)

      // 7. Click "Fechar folha mesmo assim"
      const btnMesmo = page.locator('button:has-text("Fechar folha mesmo assim")')
      if (await btnMesmo.count() > 0) {
        await btnMesmo.click()
        console.log(`  Confirmou "Fechar folha mesmo assim"`)
      } else {
        // Try alternative button texts
        const btnConfirm = page.locator('button:has-text("mesmo assim")')
        if (await btnConfirm.count() > 0) {
          await btnConfirm.first().click()
          console.log(`  Confirmou via botao "mesmo assim"`)
        }
      }
    }

    // 8. Wait for completion (up to 40 seconds)
    let result = 'TIMEOUT'
    for (let s = 5; s <= 40; s += 5) {
      await page.waitForTimeout(5000)
      const bodyNow = await page.textContent('body') ?? ''

      if (bodyNow.includes('fechada') || bodyNow.includes('Fechada') || bodyNow.includes('sucesso') || bodyNow.includes('Sucesso')) {
        result = 'SUCESSO'
        break
      }

      const toasts = await page.locator('[data-sonner-toast]').allTextContents()
      if (toasts.some(t => t.toLowerCase().includes('erro'))) {
        result = `ERRO: ${toasts.join(' | ')}`
        break
      }
      if (toasts.some(t => t.toLowerCase().includes('sucesso') || t.toLowerCase().includes('fechada'))) {
        result = 'SUCESSO (toast)'
        break
      }

      console.log(`  ${s}s: aguardando...`)
    }

    // 9. Log result
    console.log(`  RESULTADO ${obra.label}: ${result}`)

    // Dump errors
    const errors = logs.filter(l => l.includes('[error]') || l.includes('[PAGE_ERROR]'))
    if (errors.length > 0) {
      console.log(`  Erros (${errors.length}):`)
      errors.slice(0, 5).forEach(e => console.log(`    ${e.slice(0, 250)}`))
    }
  })
}
