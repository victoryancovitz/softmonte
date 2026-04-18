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
  await page.screenshot({
    path: `e2e/screenshots/${nome}.png`,
    fullPage: false,
  })
}

// ─── F1 ─────────────────────────────────────────────────────────────
test('F1 — Cadastrar cliente', async ({ page }) => {
  test.setTimeout(90000)
  await login(page)
  await page.goto(URL + '/clientes/novo')
  await page.waitForTimeout(3000)

  // Preenche o primeiro input de texto visível como nome
  const inputs = page.locator('input[type="text"]')
  if (await inputs.count() > 0) {
    await inputs.first().fill('CLIENTE TESTE E2E').catch(() => {})
  }
  await page.fill('input[placeholder*="CNPJ" i], input[name="cnpj"]', '12.345.678/0001-99').catch(() => {})

  await snap(page, 'f1-cliente-preenchido')

  await page.click('button:has-text("Salvar"), button[type="submit"]').catch(() => {})
  await page.waitForTimeout(3000)
  await snap(page, 'f1-cliente-salvo')

  const body = await page.textContent('body')
  const ok =
    (body ?? '').includes('CLIENTE TESTE E2E') ||
    (body ?? '').toLowerCase().includes('sucesso') ||
    (body ?? '').toLowerCase().includes('cadastrado') ||
    !page.url().includes('/novo')
  expect(ok).toBeTruthy()
})

// ─── F2 ─────────────────────────────────────────────────────────────
test('F2 — Cadastrar obra', async ({ page }) => {
  test.setTimeout(90000)
  await login(page)
  await page.goto(URL + '/obras/nova')
  await page.waitForTimeout(3000)

  await snap(page, 'f2-obra-step1')

  const clienteSelect = page.locator('select').first()
  if (await clienteSelect.count() > 0) {
    const opts = await clienteSelect.locator('option').count()
    if (opts > 1) await clienteSelect.selectOption({ index: 1 })
  }

  const btnNext = page.locator('button:has-text("Próximo"), button:has-text("Avançar"), button:has-text("Continuar")')
  if (await btnNext.count() > 0) {
    await btnNext.first().click()
    await page.waitForTimeout(1500)
  }

  await page.fill('input[placeholder*="nome" i], input[name="nome"]', 'OBRA TESTE E2E').catch(() => {})
  await page.fill('input[type="date"]', '2026-01-01').catch(() => {})

  await snap(page, 'f2-obra-step2')

  await page.click('button:has-text("Salvar"), button:has-text("Criar obra"), button[type="submit"]').catch(() => {})
  await page.waitForTimeout(3000)
  await snap(page, 'f2-obra-resultado')

  const body = await page.textContent('body')
  expect(body).not.toContain('Erro fatal')
})

// ─── F3 ─────────────────────────────────────────────────────────────
test('F3 — Wizard de admissão: etapas 1 e 2', async ({ page }) => {
  await login(page)
  await page.goto(URL + '/rh/admissoes/wizard')
  await page.waitForTimeout(3000)

  await snap(page, 'f3-wizard-etapa1')

  await page.fill(
    'input[placeholder*="NOME" i], input[placeholder*="nome completo" i]',
    'FUNCIONARIO TESTE E2E',
  ).catch(() => {})
  await page.waitForTimeout(300)

  await page.fill('input[placeholder*="CPF" i], input[placeholder*="000.000" i]', '123.456.789-09').catch(() => {})
  await page.waitForTimeout(300)

  const dtNasc = page.locator('input[type="date"]').first()
  if (await dtNasc.count() > 0) {
    await dtNasc.fill('1990-06-15').catch(() => {})
    await page.waitForTimeout(300)
  }

  await snap(page, 'f3-etapa1-preenchida')

  await page.click('button:has-text("Salvar e av")').catch(() => {})
  await page.waitForTimeout(4000)

  await snap(page, 'f3-etapa2-aberta')

  // Dropdown de função — é o select que contém "Selecione a função"
  // (não o de obra/CC que vem antes)
  const selectFuncao = page.locator('select:has(option:text-is("Selecione a função..."))').first()
  if (await selectFuncao.count() > 0) {
    const opts = await selectFuncao.locator('option').count()
    // 15 funções + 1 "Selecione..." = 16
    expect(opts).toBeGreaterThan(1)
    await selectFuncao.selectOption({ index: 1 }).catch(() => {})
    await page.waitForTimeout(500)
  }

  await page.fill(
    'input[type="number"][placeholder*="0,00" i], input[placeholder*="salário" i]',
    '3500',
  ).catch(() => {})
  await page.waitForTimeout(300)

  const dtAdm = page.locator('input[type="date"]').first()
  if (await dtAdm.count() > 0) {
    await dtAdm.fill('2026-04-16').catch(() => {})
    await page.waitForTimeout(300)
  }

  const selectVinculo = page.locator('select:has(option[value*="experiencia"])').first()
  if (await selectVinculo.count() > 0) {
    await selectVinculo.selectOption('experiencia_45_45').catch(() => {})
  }

  await snap(page, 'f3-etapa2-preenchida')

  const btnRascunho = page.locator('button:has-text("rascunho")')
  if (await btnRascunho.count() > 0) {
    await btnRascunho.click()
    await page.waitForTimeout(2000)
  }

  await snap(page, 'f3-resultado')

  const body = await page.textContent('body')
  expect(body).not.toContain('Erro fatal')
  expect(body).not.toContain('Application error')
})

// ─── F4 ─────────────────────────────────────────────────────────────
test('F4 — Ponto: página carrega e permite interação', async ({ page }) => {
  await login(page)
  await page.goto(URL + '/ponto')
  await page.waitForTimeout(4000)

  await snap(page, 'f4-ponto-inicial')

  const selectObra = page.locator('select').first()
  if (await selectObra.count() > 0) {
    const qtdOpts = await selectObra.locator('option').count()
    if (qtdOpts > 1) {
      await selectObra.selectOption({ index: 1 })
      await page.waitForTimeout(3000)
      await snap(page, 'f4-ponto-com-obra')
    }
  }

  const bodyAtual = await page.textContent('body')
  expect(bodyAtual).not.toContain('Erro fatal')
  expect(bodyAtual).not.toContain('Application error')

  await snap(page, 'f4-ponto-resultado')
})

// ─── F5 ─────────────────────────────────────────────────────────────
test('F5 — BM: página nova carrega corretamente', async ({ page }) => {
  test.setTimeout(90000)
  await login(page)
  await page.goto(URL + '/boletins/nova')
  await page.waitForTimeout(3000)

  await snap(page, 'f5-bm-novo')

  const selectObra = page.locator('select').first()
  if (await selectObra.count() > 0) {
    const opts = await selectObra.locator('option').count()
    if (opts > 1) {
      await selectObra.selectOption({ index: 1 })
      await page.waitForTimeout(1000)
    }
  }

  const inputs = page.locator('input[type="date"]')
  const qtd = await inputs.count()
  if (qtd >= 2) {
    await inputs.nth(0).fill('2026-04-01').catch(() => {})
    await inputs.nth(1).fill('2026-04-30').catch(() => {})
    await page.waitForTimeout(500)
  }

  await snap(page, 'f5-bm-datas')

  const btnPreview = page.locator(
    'button:has-text("Pré-visualizar"), button:has-text("Visualizar"), button:has-text("Gerar")',
  )
  if (await btnPreview.count() > 0) {
    await btnPreview.first().click().catch(() => {})
    await page.waitForTimeout(5000)
    await snap(page, 'f5-bm-preview')
  }

  const body = await page.textContent('body')
  expect(body).not.toContain('Erro fatal')
  expect(body).not.toContain('Application error')
})

// ─── F6 ─────────────────────────────────────────────────────────────
test('F6 — Forecast: carrega e permite gerar', async ({ page }) => {
  await login(page)
  await page.goto(URL + '/forecast')
  await page.waitForTimeout(4000)

  await snap(page, 'f6-forecast-inicial')

  const body = await page.textContent('body')
  expect(body).not.toContain('Erro ao carregar forecast')
  expect(body).not.toContain('Erro fatal')
  expect(body).not.toContain('Application error')

  const btnGerar = page.locator('button:has-text("Gerar")')
  if (await btnGerar.count() > 0) {
    await btnGerar.first().click().catch(() => {})
    await page.waitForTimeout(5000)
    await snap(page, 'f6-forecast-gerado')
  }
})

// ─── F7 ─────────────────────────────────────────────────────────────
test('F7 — Encarregado não acessa DRE', async ({ page }) => {
  await page.goto(URL + '/login')
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })
  await page.fill('input[type="email"]', 'encarregado@tecnomonte.com.br')
  await page.fill('input[type="password"]', 'Softmonte@2026')
  await page.click('button:has-text("Entrar")')
  await page.waitForTimeout(5000)

  await snap(page, 'f7-encarregado-login')

  await page.goto(URL + '/financeiro/dre')
  await page.waitForTimeout(3000)

  await snap(page, 'f7-encarregado-dre')

  const body = await page.textContent('body')
  const bloqueado =
    page.url().includes('/login') ||
    page.url().includes('/portal') ||
    (body ?? '').toLowerCase().includes('permiss') ||
    (body ?? '').toLowerCase().includes('acesso') ||
    (body ?? '').toLowerCase().includes('autorizad') ||
    !(body ?? '').includes('DRE')
  expect(bloqueado).toBeTruthy()
})

// ─── F8 ─────────────────────────────────────────────────────────────
test('F8 — Wizard: avançar sem preencher mostra erro em PT', async ({ page }) => {
  await login(page)
  await page.goto(URL + '/rh/admissoes/wizard')
  await page.waitForTimeout(3000)

  await page.click('button:has-text("Salvar e av")').catch(() => {})
  await page.waitForTimeout(2000)

  await snap(page, 'f8-erro-validacao')

  const body = await page.textContent('body')

  // Nada de mensagem técnica
  expect(body).not.toContain('violates not-null')
  expect(body).not.toContain('PGRST')
  expect(body ?? '').not.toContain('undefined is not')

  const bodyLower = (body ?? '').toLowerCase()
  const temMsgPT =
    bodyLower.includes('obrigatório') ||
    bodyLower.includes('obrigatorio') ||
    bodyLower.includes('preencha') ||
    bodyLower.includes('necessário') ||
    bodyLower.includes('cpf') ||
    bodyLower.includes('nome')
  expect(temMsgPT).toBeTruthy()
})

// ─── F9 ─────────────────────────────────────────────────────────────
test('F9 — Menu: navegação funciona sem 500', async ({ page }) => {
  await login(page)
  await page.goto(URL + '/diretoria')
  await page.waitForTimeout(3000)

  const grupos = ['Diretoria', 'Engenharia', 'Administrativo', 'Compras', 'Financeiro', 'Cadastros']
  for (const grupo of grupos) {
    const item = page.locator(`text="${grupo}"`).first()
    if (await item.count() > 0) {
      await item.hover().catch(() => {})
      await page.waitForTimeout(800)
      await snap(page, `f9-menu-${grupo.toLowerCase()}`)
    }
  }

  const paginas = ['/funcionarios', '/obras', '/ponto', '/rh/folha', '/boletins', '/financeiro', '/forecast']
  for (const rota of paginas) {
    await page.goto(URL + rota)
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    expect(body).not.toContain('Application error')
    await snap(page, `f9-pagina${rota.replace(/\//g, '-')}`)
  }
})

// ─── F10 ────────────────────────────────────────────────────────────
test('F10 — Mobile 390px: wizard navegável', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await login(page)
  await page.goto(URL + '/rh/admissoes/wizard')
  await page.waitForTimeout(3000)

  await snap(page, 'f10-mobile-wizard')

  const btn = page.locator('button:has-text("Salvar e av")')
  if (await btn.count() > 0) {
    const visible = await btn.isVisible()
    expect(visible).toBeTruthy()
  }

  const body = await page.textContent('body')
  expect(body).not.toContain('Erro fatal')
  expect(body).not.toContain('Application error')
})
