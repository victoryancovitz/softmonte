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
// 1. CLIENTES — 5 novos
// ═══════════════════════════════════════════════════════════════
test('POP 1 — Criar 5 clientes', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const clientes = [
    { nome: 'PETROBRAS REPLAN', razao: 'Petróleo Brasileiro S.A.', cnpj: '33.000.167/0001-01', cidade: 'Paulínia', estado: 'SP' },
    { nome: 'ARCELOR MITTAL TUBARÃO', razao: 'ArcelorMittal Brasil S.A.', cnpj: '17.469.701/0001-77', cidade: 'Serra', estado: 'ES' },
    { nome: 'SAMARCO MINERAÇÃO', razao: 'Samarco Mineração S.A.', cnpj: '16.628.281/0001-61', cidade: 'Mariana', estado: 'MG' },
    { nome: 'ELDORADO CELULOSE', razao: 'Eldorado Brasil Celulose S.A.', cnpj: '07.401.436/0001-54', cidade: 'Três Lagoas', estado: 'MS' },
    { nome: 'CENIBRA', razao: 'Celulose Nipo-Brasileira S.A.', cnpj: '42.278.796/0001-99', cidade: 'Belo Oriente', estado: 'MG' },
  ]

  for (const c of clientes) {
    await page.goto(URL + '/clientes/novo')
    await page.waitForTimeout(3000)

    const inputs = page.locator('input[type="text"]')
    await inputs.nth(0).fill(c.nome)     // Nome
    await inputs.nth(1).fill(c.razao)     // Razão social
    await inputs.nth(2).fill(c.cnpj)      // CNPJ
    await inputs.nth(3).fill(c.cidade)    // Endereço (skip) → Cidade
    // inputs 3=endereco, 4=cidade, 5=estado
    if (await inputs.count() >= 6) {
      await inputs.nth(4).fill(c.cidade)
      await inputs.nth(5).fill(c.estado)
    }

    await page.click('button:has-text("Criar cliente")')
    await page.waitForTimeout(4000)
    console.log(`  ✅ Cliente: ${c.nome}`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 2. FORNECEDORES — 5 novos
// ═══════════════════════════════════════════════════════════════
test('POP 2 — Criar 5 fornecedores', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)
  await page.goto(URL + '/compras/fornecedores')
  await page.waitForTimeout(4000)

  const fornecedores = [
    { nome: 'Casa do Soldador MG', cat: 'Material', contato: 'João Silva', email: 'vendas@casadosoldador.com.br', tel: '(31) 3333-1111' },
    { nome: 'EPI Center Campinas', cat: 'EPI', contato: 'Maria Santos', email: 'epi@epicenter.com.br', tel: '(19) 4444-2222' },
    { nome: 'Translog Fretamento', cat: 'Transporte', contato: 'Pedro Costa', email: 'frete@translog.com.br', tel: '(31) 5555-3333' },
    { nome: 'Refeitório Industrial BH', cat: 'Alimentação', contato: 'Ana Oliveira', email: 'contato@refeitoriobh.com.br', tel: '(31) 6666-4444' },
    { nome: 'Caldeiraria Precisão', cat: 'Serviços', contato: 'Carlos Ferreira', email: 'orcamento@caldprecisao.com.br', tel: '(31) 7777-5555' },
  ]

  for (const f of fornecedores) {
    // Clicar "Novo Fornecedor"
    const btnNovo = page.locator('button:has-text("Novo"), button:has-text("Fornecedor")')
    if (await btnNovo.count() > 0) {
      await btnNovo.first().click()
      await page.waitForTimeout(1000)
    }

    // Nome (primeiro input visível no form)
    const nomeInput = page.locator('input[type="text"]').first()
    await nomeInput.fill(f.nome)

    // Categoria select
    const selects = page.locator('select')
    for (let i = 0; i < await selects.count(); i++) {
      const opts = await selects.nth(i).locator('option').allTextContents()
      if (opts.some(o => o.includes('Material') || o.includes('EPI'))) {
        await selects.nth(i).selectOption({ label: f.cat })
        break
      }
    }

    // Email
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.count() > 0) await emailInput.first().fill(f.email)

    // Telefone
    const telInputs = page.locator('input[type="text"]')
    // Preencher contato e tel nos inputs restantes
    const count = await telInputs.count()
    for (let i = 1; i < count; i++) {
      const val = await telInputs.nth(i).inputValue()
      if (!val) {
        await telInputs.nth(i).fill(f.contato)
        if (i + 1 < count) {
          const nextVal = await telInputs.nth(i+1).inputValue()
          if (!nextVal) await telInputs.nth(i+1).fill(f.tel)
        }
        break
      }
    }

    await page.click('button:has-text("Salvar")')
    await page.waitForTimeout(3000)
    console.log(`  ✅ Fornecedor: ${f.nome}`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 3. FALTAS/ATESTADOS — 10 via /faltas/nova
// ═══════════════════════════════════════════════════════════════
test('POP 3 — Registrar 10 faltas/atestados', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const faltas = [
    { tipo: 'atestado_medico', dias: '3', obs: 'Gripe forte — repouso 3 dias', cid: 'J11', medico: 'Dr. Carlos Mendes', crm: 'CRM-MG 45123' },
    { tipo: 'falta_injustificada', dias: '1', obs: 'Não compareceu sem aviso prévio' },
    { tipo: 'atestado_medico', dias: '2', obs: 'Dor lombar aguda', cid: 'M54.5', medico: 'Dra. Ana Souza', crm: 'CRM-MG 32456' },
    { tipo: 'falta_justificada', dias: '1', obs: 'Falecimento de familiar' },
    { tipo: 'suspensao', dias: '3', obs: 'Suspensão disciplinar' },
    { tipo: 'atestado_medico', dias: '5', obs: 'Cirurgia joelho', cid: 'S83.5', medico: 'Dr. Roberto Alves', crm: 'CRM-MG 67890' },
    { tipo: 'folga_compensatoria', dias: '1', obs: 'Compensação banco de horas' },
    { tipo: 'falta_injustificada', dias: '2', obs: 'Ausência sem justificativa 2 dias' },
    { tipo: 'atestado_medico', dias: '1', obs: 'Consulta odontológica', cid: 'K02.1', medico: 'Dr. Paulo Dente', crm: 'CRO-MG 12345' },
    { tipo: 'atestado_acidente', dias: '15', obs: 'Acidente trabalho — corte mão. CAT emitida.', cid: 'S61.0', medico: 'Dr. Emergência', crm: 'CRM-MG 99999' },
  ]

  for (let i = 0; i < faltas.length; i++) {
    const f = faltas[i]
    await page.goto(URL + '/faltas/nova')
    await page.waitForTimeout(3000)

    // Selecionar funcionário (primeiro select)
    const selects = page.locator('select')
    const funcSelect = selects.first()
    const funcOpts = await funcSelect.locator('option').allTextContents()
    if (funcOpts.length > 1) {
      await funcSelect.selectOption({ index: Math.min(i + 1, funcOpts.length - 1) })
    }
    await page.waitForTimeout(500)

    // Data
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count() > 0) {
      const d = new Date(); d.setDate(d.getDate() - (i * 3 + 1))
      await dateInputs.first().fill(d.toISOString().split('T')[0])
    }

    // Tipo (buscar select que tem as opções de falta)
    const selectCount = await selects.count()
    for (let s = 0; s < selectCount; s++) {
      const opts = await selects.nth(s).locator('option').allTextContents()
      if (opts.some(o => o.includes('injustificada') || o.includes('Atestado') || o.includes('atestado'))) {
        await selects.nth(s).selectOption(f.tipo)
        break
      }
    }
    await page.waitForTimeout(500)

    // Dias descontados
    const numInputs = page.locator('input[type="number"]')
    if (await numInputs.count() > 0) await numInputs.first().fill(f.dias)

    // Campos de atestado (aparecem condicionalmente)
    if (f.cid) {
      const cidInput = page.locator('input[placeholder*="CID"], input[placeholder*="cid"]')
      if (await cidInput.count() > 0) await cidInput.fill(f.cid)
    }
    if (f.medico) {
      const medInput = page.locator('input[placeholder*="médico"], input[placeholder*="medico"]')
      if (await medInput.count() > 0) await medInput.fill(f.medico)
    }
    if (f.crm) {
      const crmInput = page.locator('input[placeholder*="CRM"], input[placeholder*="crm"]')
      if (await crmInput.count() > 0) await crmInput.fill(f.crm)
    }

    // Observação
    const textarea = page.locator('textarea')
    if (await textarea.count() > 0) await textarea.first().fill(f.obs)

    await page.click('button:has-text("Registrar")')
    await page.waitForTimeout(3000)
    console.log(`  ✅ Falta ${i+1}: ${f.tipo}`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 4. ESTOQUE — 8 itens via /estoque/novo
// ═══════════════════════════════════════════════════════════════
test('POP 4 — Criar 8 itens de estoque', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const itens = [
    { codigo: 'UI-ELD-001', nome: 'Eletrodo E7018 3,25mm Lote Abril', cat: 'Consumivel', qtd: '500', min: '100', un: 'kg' },
    { codigo: 'UI-EPI-001', nome: 'Luva Vaqueta Cano Longo', cat: 'EPI', qtd: '200', min: '50', un: 'pares' },
    { codigo: 'UI-MAT-001', nome: 'Chapa A36 12,5mm 1200x6000', cat: 'Material', qtd: '15', min: '5', un: 'un' },
    { codigo: 'UI-FER-001', nome: 'Esmerilhadeira Angular 7" Bosch', cat: 'Ferramenta', qtd: '12', min: '3', un: 'un' },
    { codigo: 'UI-EPI-002', nome: 'Capacete MSA V-Gard Branco', cat: 'EPI', qtd: '80', min: '20', un: 'un' },
    { codigo: 'UI-CON-001', nome: 'Disco de Corte 7" Norton', cat: 'Consumivel', qtd: '300', min: '80', un: 'un' },
    { codigo: 'UI-MAT-002', nome: 'Tubo SCH40 A106 4"', cat: 'Material', qtd: '60', min: '15', un: 'un' },
    { codigo: 'UI-EPI-003', nome: 'Cinto Segurança Paraquedista', cat: 'EPI', qtd: '25', min: '5', un: 'un' },
  ]

  for (const item of itens) {
    await page.goto(URL + '/estoque/novo')
    await page.waitForTimeout(3000)

    // Código e Nome (primeiros inputs de texto)
    const textInputs = page.locator('input[type="text"], input:not([type])')
    await textInputs.nth(0).fill(item.codigo)
    await textInputs.nth(1).fill(item.nome)

    // Categoria (select com EPI/Material/etc)
    const selects = page.locator('select')
    for (let s = 0; s < await selects.count(); s++) {
      const opts = await selects.nth(s).locator('option').allTextContents()
      if (opts.some(o => o === 'EPI' || o === 'Material' || o === 'Consumivel')) {
        await selects.nth(s).selectOption(item.cat)
        break
      }
    }

    // Quantidade e mínima
    const numInputs = page.locator('input[type="number"]')
    if (await numInputs.count() >= 2) {
      await numInputs.nth(0).fill(item.qtd)
      await numInputs.nth(1).fill(item.min)
    }

    // Unidade
    for (let s = 0; s < await selects.count(); s++) {
      const opts = await selects.nth(s).locator('option').allTextContents()
      if (opts.some(o => o === 'un' || o === 'kg' || o === 'pares')) {
        await selects.nth(s).selectOption(item.un)
        break
      }
    }

    await page.click('button:has-text("Salvar item"), button:has-text("Salvar")')
    await page.waitForTimeout(3000)
    console.log(`  ✅ Estoque: ${item.nome}`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 5. FINANCEIRO — 6 lançamentos via /financeiro/novo
// ═══════════════════════════════════════════════════════════════
test('POP 5 — Criar 6 lançamentos financeiros', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const lancamentos = [
    { receita: false, nome: 'Aluguel container escritório abril', valor: '4500' },
    { receita: false, nome: 'Combustível frota abril', valor: '8750' },
    { receita: false, nome: 'Alimentação coletiva abril', valor: '45000' },
    { receita: false, nome: 'Transporte fretado abril', valor: '32000' },
    { receita: true, nome: 'Receita medição Usiminas fevereiro', valor: '185000' },
    { receita: false, nome: 'Locação guindaste 50t 15 dias', valor: '67500' },
  ]

  for (const l of lancamentos) {
    await page.goto(URL + '/financeiro/novo')
    await page.waitForTimeout(3000)

    // Tipo toggle
    if (l.receita) {
      const btnReceita = page.locator('button:has-text("Receita")')
      if (await btnReceita.count() > 0) await btnReceita.click()
    }

    // Obra (primeiro select)
    const selects = page.locator('select')
    if (await selects.count() > 0) {
      const opts = await selects.first().locator('option').allTextContents()
      if (opts.length > 1) await selects.first().selectOption({ index: 1 })
    }

    // Descrição (input text)
    const textInputs = page.locator('input[type="text"]')
    if (await textInputs.count() > 0) await textInputs.first().fill(l.nome)

    // Valor (number input)
    const numInputs = page.locator('input[type="number"]')
    if (await numInputs.count() > 0) await numInputs.first().fill(l.valor)

    // Data competência (date input)
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count() > 0) await dateInputs.first().fill('2026-04-01')
    if (await dateInputs.count() > 1) await dateInputs.nth(1).fill('2026-04-15')

    await page.click('button:has-text("Salvar lançamento"), button:has-text("Salvar")')
    await page.waitForTimeout(3000)
    console.log(`  ✅ ${l.receita ? 'Receita' : 'Despesa'}: ${l.nome}`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 6. DESLIGAMENTOS — 3 via /rh/desligamentos/novo
// ═══════════════════════════════════════════════════════════════
test('POP 6 — Criar 3 desligamentos', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const tipos = ['demissao_sem_justa_causa', 'pedido_demissao', 'termino_contrato']
  const motivos = [
    'Redução de quadro — fim da parada programada',
    'Funcionário solicitou desligamento — proposta outra empresa',
    'Término contrato experiência 45+45 dias',
  ]

  for (let i = 0; i < tipos.length; i++) {
    await page.goto(URL + '/rh/desligamentos/novo')
    await page.waitForTimeout(4000)

    // Selecionar funcionário (primeiro select)
    const selects = page.locator('select')
    const funcOpts = await selects.first().locator('option').allTextContents()
    if (funcOpts.length > 1) {
      await selects.first().selectOption({ index: i + 1 })
      await page.waitForTimeout(1000)
    }

    // Tipo (segundo select)
    if (await selects.count() > 1) {
      const tipoOpts = await selects.nth(1).locator('option').allTextContents()
      if (tipoOpts.some(o => o.includes('justa') || o.includes('Sem'))) {
        await selects.nth(1).selectOption(tipos[i])
      }
    }

    // Data saída
    const dateInputs = page.locator('input[type="date"]')
    if (await dateInputs.count() > 0) await dateInputs.first().fill('2026-04-30')

    // Motivo
    const textarea = page.locator('textarea')
    if (await textarea.count() > 0) await textarea.first().fill(motivos[i])

    await page.click('button:has-text("Criar"), button:has-text("Desligamento")')
    await page.waitForTimeout(4000)
    console.log(`  ✅ Desligamento ${i+1}: ${tipos[i]}`)
  }
})

// ═══════════════════════════════════════════════════════════════
// 7. COTAÇÕES — 3 via /compras/cotacoes
// ═══════════════════════════════════════════════════════════════
test('POP 7 — Criar 3 cotações', async ({ page }) => {
  test.setTimeout(300000)
  await login(page)

  const cotacoes = [
    'Eletrodos E7018 e E6013 para parada Usiminas — 500kg cada',
    'URGENTE: Chapas A36 12,5mm fabricação TQ-301',
    'EPI completo 30 novos colaboradores — botina, capacete, luva',
  ]

  for (let i = 0; i < cotacoes.length; i++) {
    await page.goto(URL + '/compras/cotacoes')
    await page.waitForTimeout(4000)

    const btnNova = page.locator('button:has-text("Nova"), button:has-text("Cotação")')
    if (await btnNova.count() > 0) {
      await btnNova.first().click()
      await page.waitForTimeout(1500)
    }

    // Obra
    const selects = page.locator('select')
    if (await selects.count() > 0) {
      const opts = await selects.first().locator('option').allTextContents()
      if (opts.length > 1) await selects.first().selectOption({ index: 1 })
    }

    // Descrição
    const textarea = page.locator('textarea')
    if (await textarea.count() > 0) await textarea.first().fill(cotacoes[i])

    // Prazo
    const dateInput = page.locator('input[type="date"]')
    if (await dateInput.count() > 0) await dateInput.first().fill('2026-04-25')

    await page.click('button:has-text("Criar")')
    await page.waitForTimeout(4000)
    console.log(`  ✅ Cotação ${i+1}`)
  }
})
