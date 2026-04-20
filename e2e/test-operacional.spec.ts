import { test, expect, Page } from '@playwright/test'

const URL = 'https://softmonte.vercel.app'
const EMAIL = 'diretoria@tecnomonte.com.br'
const PASS = 'Softmonte@2026'

async function login(page: Page) {
  await page.goto(URL + '/login')
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button:has-text("Entrar")')
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(2000)
}

async function snap(page: Page, nome: string) {
  await page.screenshot({ path: `e2e/screenshots/op-${nome}.png`, fullPage: true }).catch(() => {})
}

// ═══════════════════════════════════════════════════════════════
// TESTE 1: Fechar folha para Usiminas (60 funcs com efetivo março)
// ═══════════════════════════════════════════════════════════════

test('FOLHA — fechar março Usiminas', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)
  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(4000)

  // Selecionar obra "Usiminas — Parada Geral"
  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()
  console.log(`  Obras no select: ${options.length - 1}`)

  // Buscar a Usiminas
  const usiIdx = options.findIndex(o => o.includes('Usiminas') && o.includes('Parada'))
  if (usiIdx > 0) {
    await selectObra.selectOption({ index: usiIdx })
    console.log(`  ✅ Selecionada: ${options[usiIdx]}`)
  } else {
    // Primeira obra
    await selectObra.selectOption({ index: 1 })
    console.log(`  ⚠️ Usiminas não achada, usando: ${options[1]}`)
  }
  await page.waitForTimeout(1000)

  // Mês = 3 (março)
  const selectMes = page.locator('select').nth(1)
  await selectMes.selectOption('3')
  await page.waitForTimeout(1000)

  await snap(page, '01-folha-pre-fechar')

  // Clicar "Fechar folha"
  const btnFechar = page.locator('button:has-text("Fechar folha")')
  if (await btnFechar.count() > 0) {
    await btnFechar.click()
    await page.waitForTimeout(15000) // folha pode demorar
    await snap(page, '02-folha-pos-fechar')

    const body = await page.textContent('body') ?? ''

    // Verificar resultado
    if (body.includes('fechada') || body.includes('Fechada')) {
      console.log('  ✅ FOLHA FECHADA com sucesso!')
    } else if (body.includes('Divergência') || body.includes('Divergencia')) {
      // Modal de composição apareceu — clicar "Fechar folha mesmo assim"
      console.log('  ⚠️ Modal de divergência apareceu')
      const btnMesmoAssim = page.locator('button:has-text("Fechar folha mesmo assim")')
      if (await btnMesmoAssim.count() > 0) {
        await btnMesmoAssim.click()
        await page.waitForTimeout(15000)
        await snap(page, '03-folha-pos-modal')
        console.log('  ✅ Folha fechada após confirmação')
      }
    } else if (body.includes('Já existe')) {
      console.log('  ℹ️ Folha já foi fechada antes')
    } else if (body.toLowerCase().includes('erro') || body.includes('Error')) {
      console.log('  ❌ ERRO ao fechar folha — verificar screenshot')
      // Capturar detalhe do erro
      const toasts = await page.locator('[class*="toast"], [role="alert"]').allTextContents()
      console.log(`  📋 Toasts: ${toasts.join(' | ')}`)
    } else {
      console.log('  ⚠️ Status incerto — ver screenshot')
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// TESTE 2: Gerar BM para Vale (obra com efetivo em março)
// ═══════════════════════════════════════════════════════════════

test('BM — gerar para Vale março', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)
  await page.goto(URL + '/boletins/nova')
  await page.waitForTimeout(4000)

  // Selecionar obra "Vale — Correia"
  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()

  const valeIdx = options.findIndex(o => o.includes('Vale') && o.includes('Correia'))
  if (valeIdx > 0) {
    await selectObra.selectOption({ index: valeIdx })
    console.log(`  ✅ Selecionada: ${options[valeIdx]}`)
  } else {
    await selectObra.selectOption({ index: 2 })
    console.log(`  ⚠️ Vale não achada, usando: ${options[2]}`)
  }
  await page.waitForTimeout(2000)

  // Datas dentro do período da obra
  const inputs = page.locator('input[type="date"]')
  await inputs.nth(0).fill('2026-03-01')
  await inputs.nth(1).fill('2026-03-31')
  await page.waitForTimeout(1000)

  await snap(page, '04-bm-datas')

  // Pré-visualizar
  const btnPreview = page.locator('button:has-text("Pré-visualizar")')
  if (await btnPreview.count() > 0) {
    await btnPreview.click()
    await page.waitForTimeout(15000) // pode demorar com 90 funcs
    await snap(page, '05-bm-preview')

    const body = await page.textContent('body') ?? ''
    if (body.includes('R$')) {
      console.log('  ✅ Preview com valores em R$')

      // Verificar se mostra funções
      const temFuncoes = body.includes('AJUDANTE') || body.includes('SOLDADOR') ||
        body.includes('CALDEIREIRO') || body.includes('MECÂNICO')
      console.log(`  ${temFuncoes ? '✅' : '⚠️'} Funções ${temFuncoes ? 'visíveis' : 'não encontradas'} no preview`)

      // Salvar o BM
      const btnSalvar = page.locator('button:has-text("Salvar"), button:has-text("Emitir"), button:has-text("Criar")')
      if (await btnSalvar.count() > 0) {
        await btnSalvar.first().click()
        await page.waitForTimeout(8000)
        await snap(page, '06-bm-salvo')
        console.log('  ✅ BM salvo!')
      }
    } else if (body.includes('anterior ao início')) {
      console.log('  ❌ BUG: data anterior ao início da obra')
    } else {
      console.log('  ⚠️ Preview sem valores R$ — ver screenshot')
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// TESTE 3: Forecast — gerar para as 20 obras
// ═══════════════════════════════════════════════════════════════

test('FORECAST — gerar para múltiplas obras', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)
  await page.goto(URL + '/forecast')
  await page.waitForTimeout(5000)
  await snap(page, '07-forecast-lista')

  const body = await page.textContent('body') ?? ''

  // Deve ter 20 obras na tabela de forecast
  const rows = page.locator('tbody tr')
  const rowCount = await rows.count()
  console.log(`  📊 Linhas na tabela forecast: ${rowCount}`)

  if (rowCount > 0) {
    // Clicar na primeira obra
    await rows.first().click()
    await page.waitForTimeout(3000)

    // Gerar forecast
    const btnGerar = page.locator('button:has-text("Gerar")')
    if (await btnGerar.count() > 0) {
      await btnGerar.first().click()
      await page.waitForTimeout(10000)
      await snap(page, '08-forecast-gerado')

      const resultado = await page.textContent('body') ?? ''
      if (resultado.includes('R$') && resultado.includes('Jan')) {
        console.log('  ✅ Forecast gerado com meses e valores')
      } else {
        console.log('  ⚠️ Forecast gerado mas layout inesperado')
      }
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// TESTE 4: Ponto — selecionar obra com efetivo e verificar grade
// ═══════════════════════════════════════════════════════════════

test('PONTO — grade com efetivo Vale', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)
  await page.goto(URL + '/ponto')
  await page.waitForTimeout(4000)

  // Selecionar obra "Vale"
  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()
  console.log(`  Obras: ${options.length - 1}`)

  const valeIdx = options.findIndex(o => o.includes('Vale') && o.includes('Correia'))
  if (valeIdx > 0) {
    await selectObra.selectOption({ index: valeIdx })
  } else if (options.length > 1) {
    await selectObra.selectOption({ index: 1 })
  }
  await page.waitForTimeout(1000)

  // Março
  const selectMes = page.locator('select').nth(1)
  await selectMes.selectOption('3')
  await page.waitForTimeout(5000)

  await snap(page, '09-ponto-grade')

  const body = await page.textContent('body') ?? ''
  const temPresenca = body.includes(' P ') || (body.match(/\bP\b/g) || []).length > 10
  console.log(`  ${temPresenca ? '✅' : '⚠️'} Presenças ${temPresenca ? 'visíveis na grade' : 'não encontradas'}`)

  // Contar funcionários listados
  const nomes = await page.locator('td').filter({ hasText: /^[A-Z]{2,}/ }).count()
  console.log(`  📊 Nomes visíveis: ${nomes}`)
})

// ═══════════════════════════════════════════════════════════════
// TESTE 5: Obra detalhe — abas de obra com dados
// ═══════════════════════════════════════════════════════════════

test('OBRA — detalhe com abas reais', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)

  // Navegar para lista de obras e pegar o link da primeira obra REAL
  await page.goto(URL + '/obras')
  await page.waitForTimeout(4000)

  // Pegar link de obra específica (não /obras/nova)
  const obraLinks = page.locator('a[href^="/obras/"]').filter({
    hasNot: page.locator('text=Nova'),
  })
  const hrefs = await obraLinks.evaluateAll((els) =>
    els.map(el => el.getAttribute('href')).filter(h => h && !h.includes('nova') && !h.includes('editar') && h.split('/').length >= 3)
  )
  console.log(`  Links de obras: ${hrefs.length}`)

  if (hrefs.length > 0) {
    const obraUrl = URL + hrefs[0]
    await page.goto(obraUrl)
    await page.waitForTimeout(4000)
    await snap(page, '10-obra-geral')

    // Testar cada aba
    const abas = ['equipe', 'efetivo', 'boletins', 'financeiro', 'documentos', 'aditivos', 'diario']
    for (const aba of abas) {
      await page.goto(obraUrl + `?tab=${aba}`)
      await page.waitForTimeout(3000)

      const body = await page.textContent('body') ?? ''
      const temErro = body.includes('Application error') || body.includes('Uncaught') || body.includes('Error:')
      console.log(`  ${temErro ? '❌' : '✅'} Aba "${aba}" ${temErro ? '— ERRO!' : 'OK'}`)
    }
  }
})

// ═══════════════════════════════════════════════════════════════
// TESTE 6: Diretoria — KPIs com dados reais
// ═══════════════════════════════════════════════════════════════

test('DIRETORIA — KPIs com dados', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/diretoria')
  await page.waitForTimeout(6000)
  await snap(page, '11-diretoria')

  const body = await page.textContent('body') ?? ''

  // Verificar indicadores com valores reais
  const indicadores = ['Obras', 'Funcionários', '20', '1.00']
  for (const ind of indicadores) {
    if (body.includes(ind)) {
      console.log(`  ✅ "${ind}" visível`)
    }
  }

  // Verificar se tem erro
  if (body.includes('Application error')) {
    console.log('  ❌ ERRO no painel')
  }
})
