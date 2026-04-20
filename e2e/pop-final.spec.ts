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

test('FINAL — Criar 5 fornecedores via UI', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const nomes = ['Casa do Soldador MG', 'EPI Center Campinas', 'Translog Fretamento', 'Refeitório Industrial BH', 'Caldeiraria Precisão']

  for (const nome of nomes) {
    await page.goto(URL + '/compras/fornecedores')
    await page.waitForTimeout(3000)

    await page.click('button:has-text("Novo Fornecedor")')
    await page.waitForTimeout(2000)

    // Preencher via getByRole ou placeholder — debug qual input aparece
    const allInputs = page.locator('input:visible')
    const count = await allInputs.count()
    console.log(`  Inputs após "Novo Fornecedor": ${count}`)

    // Tentar preencher o primeiro input de texto visível (nome)
    for (let i = 0; i < count; i++) {
      const type = await allInputs.nth(i).getAttribute('type')
      if (type === 'text' || !type) {
        await allInputs.nth(i).fill(nome)
        console.log(`  Preencheu input[${i}] com "${nome}"`)
        break
      }
    }

    // Force enable e click do botão salvar
    const btnSalvar = page.locator('button:has-text("Salvar")')
    if (await btnSalvar.count() > 0) {
      // Esperar que fique enabled (o nome preenchido deveria habilitar)
      try {
        await btnSalvar.click({ timeout: 5000 })
        await page.waitForTimeout(3000)
        console.log(`  ✅ Fornecedor: ${nome}`)
      } catch {
        // Botão disabled — talvez não preencheu o campo certo
        console.log(`  ❌ Botão disabled — input não detectado corretamente`)
        await page.screenshot({ path: `e2e/screenshots/forn-fail-${nome.slice(0,10).replace(/\s/g,'_')}.png`, fullPage: true })
      }
    }
  }
})

test('FINAL — Registrar 10 faltas via UI', async ({ page }) => {
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

    const selects = page.locator('select')

    // Funcionário (select 0)
    const funcOpts = await selects.nth(0).locator('option').allTextContents()
    await selects.nth(0).selectOption({ index: Math.min(i + 2, funcOpts.length - 1) })
    await page.waitForTimeout(500)

    // Data
    const d = new Date(); d.setDate(d.getDate() - (i * 3 + 1))
    await page.locator('input[type="date"]').first().fill(d.toISOString().split('T')[0])

    // Tipo (select 2)
    await selects.nth(2).selectOption({ label: tipos[i] })
    await page.waitForTimeout(500)

    // Dias
    const numInput = page.locator('input[type="number"]')
    if (await numInput.count() > 0) await numInput.first().fill(dias[i])

    // Campos atestado — usar getByRole para evitar strict mode
    if (tipos[i].includes('Atestado')) {
      await page.waitForTimeout(500)
      const cidField = page.getByPlaceholder('Ex: J11')
      if (await cidField.count() > 0) await cidField.fill('J11')

      const medField = page.getByPlaceholder('Nome do médico')
      if (await medField.count() > 0) await medField.fill('Dr. Carlos Mendes')

      const crmField = page.getByPlaceholder('CRM do médico')
      if (await crmField.count() > 0) await crmField.fill('CRM-MG 45123')
    }

    // Observação
    const textarea = page.locator('textarea:visible')
    if (await textarea.count() > 0) {
      await textarea.first().fill(`Registro ${tipos[i].toLowerCase()} — ${dias[i]} dia(s)`)
    }

    await page.click('button:has-text("Registrar")')
    await page.waitForTimeout(3000)

    if (!page.url().includes('/nova')) {
      console.log(`  ✅ Falta ${i+1}: ${tipos[i]}`)
    } else {
      console.log(`  ⚠️ Falta ${i+1}: permaneceu na página (pode ter salvado)`)
    }
  }
})
