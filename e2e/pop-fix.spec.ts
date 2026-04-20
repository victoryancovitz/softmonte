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

// ═══════════════════════════════════════════════════════════════
// FORNECEDORES — via botão "Novo Fornecedor"
// ═══════════════════════════════════════════════════════════════
test('FIX — Criar 5 fornecedores', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const fornecedores = [
    'Casa do Soldador MG',
    'EPI Center Campinas',
    'Translog Fretamento',
    'Refeitório Industrial BH',
    'Caldeiraria Precisão',
  ]

  for (const nome of fornecedores) {
    await page.goto(URL + '/compras/fornecedores')
    await page.waitForTimeout(3000)

    await page.click('button:has-text("Novo Fornecedor")')
    await page.waitForTimeout(2000)

    // Após clicar, aparece form inline — pegar inputs visíveis
    const inputs = page.locator('input[type="text"]:visible')
    const inputCount = await inputs.count()
    console.log(`  Inputs visíveis: ${inputCount}`)

    if (inputCount > 0) {
      await inputs.first().fill(nome)
    }

    // Screenshot para ver o form
    await page.screenshot({ path: `e2e/screenshots/forn-${nome.replace(/\s/g, '_').slice(0, 15)}.png` })

    const btnSalvar = page.locator('button:has-text("Salvar"):visible')
    if (await btnSalvar.count() > 0) {
      await btnSalvar.click()
      await page.waitForTimeout(3000)
      console.log(`  ✅ Fornecedor: ${nome}`)
    } else {
      console.log(`  ❌ Botão salvar não encontrado para ${nome}`)
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// FALTAS — via /faltas/nova (select funcs, tipo select by label)
// ═══════════════════════════════════════════════════════════════
test('FIX — Registrar 10 faltas', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const tipos = [
    'Atestado Médico', 'Falta Injustificada', 'Atestado Médico',
    'Falta Justificada', 'Suspensão', 'Atestado Médico',
    'Folga Compensatória', 'Falta Injustificada', 'Atestado Médico', 'Atestado Acidente'
  ]
  const dias = ['3','1','2','1','3','5','1','2','1','15']

  for (let i = 0; i < 10; i++) {
    await page.goto(URL + '/faltas/nova')
    await page.waitForTimeout(3000)

    // select[0] = Funcionário
    const selects = page.locator('select')
    const funcOpts = await selects.nth(0).locator('option').allTextContents()
    await selects.nth(0).selectOption({ index: Math.min(i + 2, funcOpts.length - 1) })
    await page.waitForTimeout(500)

    // Data
    const dateInput = page.locator('input[type="date"]')
    const d = new Date(); d.setDate(d.getDate() - (i * 3 + 1))
    await dateInput.first().fill(d.toISOString().split('T')[0])

    // select[2] = Tipo (by label)
    await selects.nth(2).selectOption({ label: tipos[i] })
    await page.waitForTimeout(500)

    // Dias descontados
    const numInput = page.locator('input[type="number"]')
    if (await numInput.count() > 0) await numInput.first().fill(dias[i])

    // Campos condicionais de atestado (CID, médico, CRM)
    if (tipos[i].includes('Atestado')) {
      await page.waitForTimeout(500)
      const cidInput = page.locator('input[placeholder*="CID" i]')
      if (await cidInput.count() > 0) await cidInput.fill('J11')
      const medInput = page.locator('input[placeholder*="médico" i], input[placeholder*="Nome do" i]')
      if (await medInput.count() > 0) await medInput.fill('Dr. Carlos Mendes')
      const crmInput = page.locator('input[placeholder*="CRM" i]')
      if (await crmInput.count() > 0) await crmInput.fill('CRM-MG 45123')
    }

    // Observação (textarea pode aparecer)
    const textarea = page.locator('textarea:visible')
    if (await textarea.count() > 0) {
      await textarea.first().fill(`Registro de ${tipos[i].toLowerCase()} — ${dias[i]} dia(s)`)
    }

    await page.click('button:has-text("Registrar")')
    await page.waitForTimeout(3000)

    // Verificar redirect ou toast
    if (!page.url().includes('/nova')) {
      console.log(`  ✅ Falta ${i+1}: ${tipos[i]} — ${dias[i]} dia(s)`)
    } else {
      console.log(`  ⚠️ Falta ${i+1}: pode ter falhado — permaneceu na página`)
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// DESLIGAMENTOS — select tipo by label
// ═══════════════════════════════════════════════════════════════
test('FIX — Criar 3 desligamentos', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const tipos = ['Sem Justa Causa', 'Pedido de Demissão', 'Término de Contrato']
  const motivos = [
    'Redução de quadro — fim da parada programada',
    'Funcionário solicitou desligamento — proposta outra empresa',
    'Término contrato experiência 45+45 dias',
  ]

  for (let i = 0; i < tipos.length; i++) {
    await page.goto(URL + '/rh/desligamentos/novo')
    await page.waitForTimeout(4000)

    // select[0] = Funcionário
    const selects = page.locator('select')
    const funcOpts = await selects.nth(0).locator('option').allTextContents()
    // Pegar funcionário diferente a cada vez
    const funcIdx = Math.min((i + 1) * 50, funcOpts.length - 1)
    await selects.nth(0).selectOption({ index: funcIdx })
    await page.waitForTimeout(1000)

    // select[1] = Tipo (by label)
    await selects.nth(1).selectOption({ label: tipos[i] })
    await page.waitForTimeout(500)

    // Dates
    const dateInputs = page.locator('input[type="date"]')
    const dateCount = await dateInputs.count()
    for (let d = 0; d < dateCount; d++) {
      await dateInputs.nth(d).fill('2026-04-30')
    }

    // Motivo (textarea)
    const textarea = page.locator('textarea')
    if (await textarea.count() > 0) await textarea.first().fill(motivos[i])

    await page.click('button:has-text("Criar Desligamento")')
    await page.waitForTimeout(5000)

    const currentUrl = page.url()
    if (!currentUrl.includes('/novo')) {
      console.log(`  ✅ Desligamento ${i+1}: ${tipos[i]}`)
    } else {
      const body = await page.textContent('body') ?? ''
      if (body.includes('já possui') || body.includes('Erro')) {
        console.log(`  ⚠️ Desligamento ${i+1}: ${tipos[i]} — duplicado ou erro`)
      } else {
        console.log(`  ⚠️ Desligamento ${i+1}: ${tipos[i]} — status incerto`)
      }
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// COTAÇÕES — via botão "Nova Cotação"
// ═══════════════════════════════════════════════════════════════
test('FIX — Criar 3 cotações', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const descs = [
    'Eletrodos E7018 e E6013 para parada Usiminas — 500kg cada',
    'URGENTE: Chapas A36 12,5mm fabricação TQ-301',
    'EPI completo 30 novos colaboradores',
  ]

  for (let i = 0; i < descs.length; i++) {
    await page.goto(URL + '/compras/cotacoes')
    await page.waitForTimeout(4000)

    await page.click('button:has-text("Nova Cotação")')
    await page.waitForTimeout(2000)

    // Screenshot do form
    await page.screenshot({ path: `e2e/screenshots/cotacao-form-${i}.png`, fullPage: true })

    // Listar campos visíveis
    const textInputs = page.locator('input[type="text"]:visible, textarea:visible')
    const textCount = await textInputs.count()
    console.log(`  Campos texto visíveis: ${textCount}`)

    // Preencher descrição (textarea)
    const textarea = page.locator('textarea:visible')
    if (await textarea.count() > 0) {
      await textarea.first().fill(descs[i])
    }

    // Selects visíveis
    const visibleSelects = page.locator('select:visible')
    const selCount = await visibleSelects.count()
    if (selCount > 0) {
      const opts = await visibleSelects.first().locator('option').allTextContents()
      if (opts.length > 1) await visibleSelects.first().selectOption({ index: 1 })
    }

    // Date input
    const dateInputs = page.locator('input[type="date"]:visible')
    if (await dateInputs.count() > 0) await dateInputs.first().fill('2026-04-25')

    // Botão criar
    const btnCriar = page.locator('button:has-text("Criar"):visible')
    if (await btnCriar.count() > 0) {
      await btnCriar.first().click()
      await page.waitForTimeout(4000)
      console.log(`  ✅ Cotação ${i+1}: criada`)
    } else {
      console.log(`  ❌ Cotação ${i+1}: botão criar não encontrado`)
    }
  }
})
