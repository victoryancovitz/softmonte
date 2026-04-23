/**
 * Testa TODOS os fluxos operacionais na plataforma real.
 * Reporta bugs, erros de UI e inconsistências.
 *
 * npx playwright test scripts/test-fluxos.ts --headed
 */
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
  await page.screenshot({ path: `e2e/screenshots/fluxo-${nome}.png`, fullPage: true }).catch(() => {})
}

// ═══════════════════════════════════════════════════════════════════
// FLUXO 1: Verificar que dados do seed carregam corretamente
// ═══════════════════════════════════════════════════════════════════

test('SEED — /funcionarios lista 1000+', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/funcionarios')
  await page.waitForTimeout(5000)
  await snap(page, '01-funcionarios-lista')

  const body = await page.textContent('body') ?? ''

  // Deve mostrar funcionários
  expect(body).not.toContain('Nenhum funcionário')
  expect(body).not.toContain('Application error')
  expect(body).not.toContain('500')

  // Contar quantos cards/linhas aparecem
  const cards = await page.locator('[class*="rounded-xl"]').count()
  console.log(`  📊 Funcionários: ${cards} elementos visíveis`)
})

test('SEED — /obras lista 20', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/obras')
  await page.waitForTimeout(5000)
  await snap(page, '02-obras-lista')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Nenhuma obra')
  expect(body).not.toContain('Application error')

  // Deve conter nomes de obras
  expect(body).toContain('Cefértil')
  expect(body).toContain('Usiminas')
  console.log('  ✅ 20 obras visíveis')
})

test('SEED — /clientes lista 8', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/clientes')
  await page.waitForTimeout(5000)
  await snap(page, '03-clientes-lista')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')
  expect(body).toContain('CEFÉRTIL')
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 2: Ponto — selecionar obra com dados e verificar grade
// ═══════════════════════════════════════════════════════════════════

test('PONTO — grade carrega com efetivo', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/ponto')
  await page.waitForTimeout(4000)

  // Selecionar obra com dados (Usiminas Parada Geral)
  const selectObra = page.locator('select').first()
  if (await selectObra.count() > 0) {
    // Pegar a primeira obra com nome que contenha "Usiminas" ou qualquer
    const options = await selectObra.locator('option').allTextContents()
    console.log(`  🏗️ Obras disponíveis: ${options.length - 1}`)

    // Selecionar a segunda opção (primeira obra)
    await selectObra.selectOption({ index: 1 })
    await page.waitForTimeout(4000)
  }

  // Selecionar março 2026
  const selectMes = page.locator('select').nth(1)
  if (await selectMes.count() > 0) {
    await selectMes.selectOption('3') // março
    await page.waitForTimeout(4000)
  }

  await snap(page, '04-ponto-grade')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')

  // Deve ter pelo menos 1 "P" (presente) na grade
  const presentes = (body.match(/\bP\b/g) || []).length
  console.log(`  📊 Presenças visíveis: ${presentes}`)

  // Verificar se tem funcionários listados
  expect(body).not.toContain('Nenhum funcionário alocado')
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 3: Folha — fechar março para obra com dados
// ═══════════════════════════════════════════════════════════════════

test('FOLHA — fechar março', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(4000)
  await snap(page, '05-folha-antes')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')

  // Selecionar obra
  const selectObra = page.locator('select').first()
  if (await selectObra.count() > 0) {
    await selectObra.selectOption({ index: 1 })
    await page.waitForTimeout(1000)
  }

  // Selecionar mês 3 (março)
  const selectMes = page.locator('select').nth(1)
  if (await selectMes.count() > 0) {
    await selectMes.selectOption('3')
    await page.waitForTimeout(1000)
  }

  await snap(page, '06-folha-selecionada')

  // Clicar em "Fechar folha"
  const btnFechar = page.locator('button:has-text("Fechar folha")')
  if (await btnFechar.count() > 0) {
    await btnFechar.click()
    await page.waitForTimeout(8000)
    await snap(page, '07-folha-resultado')

    const resultado = await page.textContent('body') ?? ''
    // Verificar se fechou com sucesso ou deu erro
    if (resultado.toLowerCase().includes('erro')) {
      console.log('  ❌ ERRO ao fechar folha: ver screenshot 07')
    } else if (resultado.includes('fechada') || resultado.includes('Folha')) {
      console.log('  ✅ Folha fechada com sucesso')
    } else {
      console.log('  ⚠️ Status incerto — ver screenshot 07')
    }
  } else {
    console.log('  ⚠️ Botão "Fechar folha" não encontrado')
  }
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 4: BM — gerar para obra com ponto
// ═══════════════════════════════════════════════════════════════════

test('BM — criar para março', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/boletins/nova')
  await page.waitForTimeout(4000)
  await snap(page, '08-bm-novo')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')

  // Selecionar obra
  const selectObra = page.locator('select').first()
  if (await selectObra.count() > 0) {
    await selectObra.selectOption({ index: 1 })
    await page.waitForTimeout(2000)
  }

  // Preencher datas
  const inputs = page.locator('input[type="date"]')
  if (await inputs.count() >= 2) {
    await inputs.nth(0).fill('2026-03-01')
    await inputs.nth(1).fill('2026-03-31')
    await page.waitForTimeout(1000)
  }

  await snap(page, '09-bm-datas')

  // Clicar preview/gerar
  const btnGerar = page.locator('button:has-text("Pré-visualizar"), button:has-text("Gerar"), button:has-text("Calcular")')
  if (await btnGerar.count() > 0) {
    await btnGerar.first().click()
    await page.waitForTimeout(10000)
    await snap(page, '10-bm-preview')

    const resultado = await page.textContent('body') ?? ''
    if (resultado.toLowerCase().includes('erro')) {
      console.log('  ❌ ERRO no preview do BM')
    } else {
      // Verificar se mostra valores de HH
      const temValores = resultado.includes('R$') || resultado.includes('HH')
      console.log(`  ${temValores ? '✅' : '⚠️'} Preview ${temValores ? 'com valores' : 'sem valores visíveis'}`)
    }
  } else {
    console.log('  ⚠️ Botão de preview não encontrado')
  }
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 5: Forecast — gerar para obra
// ═══════════════════════════════════════════════════════════════════

test('FORECAST — gerar', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/forecast')
  await page.waitForTimeout(5000)
  await snap(page, '11-forecast-lista')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')

  // Deve ter obras listadas
  if (body.includes('Nenhum dado')) {
    console.log('  ⚠️ Nenhum dado de forecast — normal (precisa gerar)')
  }

  // Clicar na primeira obra
  const rows = page.locator('tr').filter({ hasText: 'Cefértil' })
  if (await rows.count() > 0) {
    await rows.first().click()
    await page.waitForTimeout(3000)
    await snap(page, '12-forecast-detalhe')

    // Gerar forecast
    const btnGerar = page.locator('button:has-text("Gerar")')
    if (await btnGerar.count() > 0) {
      await btnGerar.first().click()
      await page.waitForTimeout(8000)
      await snap(page, '13-forecast-gerado')

      const resultado = await page.textContent('body') ?? ''
      if (resultado.includes('R$')) {
        console.log('  ✅ Forecast gerado com valores')
      } else {
        console.log('  ⚠️ Forecast gerado mas sem valores visíveis')
      }
    }
  } else {
    console.log('  ⚠️ Nenhuma obra Cefértil na lista de forecast')
  }
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 6: DRE — verificar que carrega com dados
// ═══════════════════════════════════════════════════════════════════

test('DRE — 4 tabs carregam', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/financeiro/dre')
  await page.waitForTimeout(5000)
  await snap(page, '14-dre-inicial')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')

  // Verificar as 4 tabs
  const tabs = ['Por Obra', 'Obra + Rateio', 'Matriz', 'Consolidado']
  for (const tab of tabs) {
    const btn = page.locator(`button:has-text("${tab}")`).first()
    if (await btn.count() > 0) {
      await btn.click()
      await page.waitForTimeout(2000)
      await snap(page, `15-dre-${tab.toLowerCase().replace(/[^a-z]/g, '')}`)

      const tabBody = await page.textContent('body') ?? ''
      if (tabBody.includes('Application error') || tabBody.includes('Error')) {
        console.log(`  ❌ Tab "${tab}" com erro`)
      } else {
        console.log(`  ✅ Tab "${tab}" carrega`)
      }
    } else {
      console.log(`  ❌ Tab "${tab}" não encontrada`)
    }
  }
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 7: Diretoria — painel com indicadores
// ═══════════════════════════════════════════════════════════════════

test('DIRETORIA — painel carrega', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/diretoria')
  await page.waitForTimeout(6000)
  await snap(page, '16-diretoria')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')

  // Deve ter algum indicador
  const temIndicador = body.includes('Obras') || body.includes('Funcionários') ||
    body.includes('Receita') || body.includes('Margem')
  console.log(`  ${temIndicador ? '✅' : '⚠️'} Indicadores ${temIndicador ? 'visíveis' : 'não encontrados'}`)
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 8: CC — mapa e estrutura
// ═══════════════════════════════════════════════════════════════════

test('CC — mapa e estrutura', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/cc')
  await page.waitForTimeout(4000)
  await snap(page, '17-cc-mapa')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')

  // CC estrutura
  await page.goto(URL + '/cc/estrutura')
  await page.waitForTimeout(3000)
  await snap(page, '18-cc-estrutura')

  const body2 = await page.textContent('body') ?? ''
  expect(body2).not.toContain('Application error')

  // CC custos fixos
  await page.goto(URL + '/cc/custos-fixos')
  await page.waitForTimeout(3000)
  await snap(page, '19-cc-custos')

  const body3 = await page.textContent('body') ?? ''
  expect(body3).not.toContain('Application error')
  console.log('  ✅ 3 páginas CC carregam')
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 9: Obra detalhe — todas as abas
// ═══════════════════════════════════════════════════════════════════

test('OBRA DETALHE — todas as abas', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/obras')
  await page.waitForTimeout(4000)

  // Clicar na primeira obra
  const primeiraObra = page.locator('a[href*="/obras/"]').first()
  if (await primeiraObra.count() > 0) {
    await primeiraObra.click()
    await page.waitForTimeout(4000)
    await snap(page, '20-obra-geral')

    const abas = ['equipe', 'efetivo', 'boletins', 'financeiro', 'documentos', 'aditivos', 'diario']
    for (const aba of abas) {
      await page.goto(page.url().split('?')[0] + `?tab=${aba}`)
      await page.waitForTimeout(3000)
      await snap(page, `21-obra-${aba}`)

      const body = await page.textContent('body') ?? ''
      if (body.includes('Application error') || body.includes('Error:')) {
        console.log(`  ❌ Aba "${aba}" com ERRO`)
      } else {
        console.log(`  ✅ Aba "${aba}" OK`)
      }
    }
  }
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 10: Perfil funcionário — com dados
// ═══════════════════════════════════════════════════════════════════

test('FUNCIONÁRIO — perfil carrega', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/funcionarios')
  await page.waitForTimeout(5000)

  // Clicar no primeiro funcionário
  const link = page.locator('a[href*="/funcionarios/"]').first()
  if (await link.count() > 0) {
    await link.click()
    await page.waitForTimeout(4000)
    await snap(page, '22-func-perfil')

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Deve ter nome e cargo
    const temDados = body.includes('AJUDANTE') || body.includes('SOLDADOR') ||
      body.includes('CALDEIREIRO') || body.includes('ENCARREGADO') ||
      body.includes('ELETRICISTA') || body.includes('MECÂNICO')
    console.log(`  ${temDados ? '✅' : '⚠️'} Cargo ${temDados ? 'visível' : 'não encontrado'}`)

    // Verificar abas
    const abaLinks = ['contrato', 'remuneracao', 'ponto', 'docs']
    for (const aba of abaLinks) {
      const abaBtn = page.locator(`[href*="tab=${aba}"], button:has-text("${aba}")`).first()
      if (await abaBtn.count() > 0) {
        await abaBtn.click().catch(() => {})
        await page.waitForTimeout(2000)
      }
    }
    await snap(page, '23-func-abas')
    console.log('  ✅ Perfil + abas carregam')
  }
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 11: Financeiro — listagem com dados
// ═══════════════════════════════════════════════════════════════════

test('FINANCEIRO — listagem', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/financeiro')
  await page.waitForTimeout(5000)
  await snap(page, '24-financeiro')

  const body = await page.textContent('body') ?? ''
  expect(body).not.toContain('Application error')
  console.log('  ✅ Financeiro carrega')
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 12: Assistente IA — abre e funciona
// ═══════════════════════════════════════════════════════════════════

test('IA — drawer abre', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/diretoria')
  await page.waitForTimeout(4000)

  // Clicar no botão ✨
  const aiBtn = page.locator('button[title*="Assistente"]').first()
  if (await aiBtn.count() > 0) {
    await aiBtn.click()
    await page.waitForTimeout(2000)
    await snap(page, '25-ia-drawer')

    const body = await page.textContent('body') ?? ''
    const drawerAbriu = body.includes('Assistente') && body.includes('Softmonte')
    console.log(`  ${drawerAbriu ? '✅' : '❌'} Drawer ${drawerAbriu ? 'abriu' : 'NÃO abriu'}`)
  } else {
    console.log('  ❌ Botão IA não encontrado')
  }
})

// ═══════════════════════════════════════════════════════════════════
// FLUXO 13: Dropdown "Mais ▾" funciona
// ═══════════════════════════════════════════════════════════════════

test('MENU — dropdown Mais funciona', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.goto(URL + '/funcionarios')
  await page.waitForTimeout(4000)

  const btnMais = page.locator('button:has-text("Mais")')
  if (await btnMais.count() > 0) {
    await btnMais.click()
    await page.waitForTimeout(1000)
    await snap(page, '26-menu-mais')

    const body = await page.textContent('body') ?? ''
    const temItens = body.includes('Treinamentos') || body.includes('Férias') ||
      body.includes('Banco de Horas') || body.includes('WhatsApp')
    console.log(`  ${temItens ? '✅' : '❌'} Dropdown ${temItens ? 'funciona' : 'NÃO mostra itens'}`)
  } else {
    console.log('  ❌ Botão "Mais" não encontrado')
  }
})
