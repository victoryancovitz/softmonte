import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://wzmkifutluyqzqefrbpp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// IDs fixos
const CC_FALLBACK = 'a81017df-c125-4193-bbe8-c44f92a4132a' // ADM-999
const CC_MATRIZ = '86a8ea3c-a4de-4ad8-82bd-57231356d0e1' // ADM-001
const ANDREIA_ID = 'fc51a131-3dbc-4a73-a2e2-b2483e1776dc'

const MAPA_CONTAS = {
  'ITAÚ': '4fd554a2-3203-4671-836e-aead881e3d86',
  'ITAÚ MATRIZ': '4fd554a2-3203-4671-836e-aead881e3d86',
  'ITAÚ - MATRIZ (CG)': '4fd554a2-3203-4671-836e-aead881e3d86',
  'ITAÚ - FILIAL (CG)': '1180e422-cc86-4d24-92a5-f6e1d33ed451',
  'ITAÚ FILIAL': '1180e422-cc86-4d24-92a5-f6e1d33ed451',
  'SANTANDER': '84e5b0e9-cbfa-4403-a8fc-9d426b698cf6',
  'DAYCOVAL': '2799ac7d-9fa1-49a6-97c6-d6ab292c4a79',
  'DAYCOVAL (CG)': '2799ac7d-9fa1-49a6-97c6-d6ab292c4a79',
  'SAFRA': '1865dc27-4694-4499-9494-bb798046566c',
  'BTG': 'dabc3206-623c-4ea6-9e74-633612706746',
  'BTG PACTUAL': 'dabc3206-623c-4ea6-9e74-633612706746',
  'BRADESCO': '991c7b62-6943-4ab4-a502-b0a5fc037e07',
  'BRADESCO - MONTTEC': '991c7b62-6943-4ab4-a502-b0a5fc037e07',
  'DINHEIRO': '1179a5b2-d4b0-4468-ba0d-4a08f3a6e3da',
  'CARTÃO DE CRÉDITO': 'bdc9720b-5d8c-4e0a-b8ba-82586c005962',
  'CARTÃO': 'bdc9720b-5d8c-4e0a-b8ba-82586c005962',
  'PAGAMENTOS (ANDREIA)': 'bdc9720b-5d8c-4e0a-b8ba-82586c005962',
}

function resolverConta(banco) {
  if (!banco) return null
  const b = banco.toString().trim().toUpperCase()
  return MAPA_CONTAS[b] || MAPA_CONTAS[b.split(' -')[0]] || MAPA_CONTAS[b.split(' (')[0]] || null
}

function parseMes(mes) {
  if (!mes) return { mes: 1, ano: 2026 }
  const s = mes.toString().trim()
  const m = s.match(/(\d{1,2})\/?(\d{4})/)
  if (m) return { mes: parseInt(m[1]), ano: parseInt(m[2]) }
  return { mes: 1, ano: 2026 }
}

function parseData(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    // Excel serial date
    const d = new Date((val - 25569) * 86400000)
    return d.toISOString().split('T')[0]
  }
  return val.toString().slice(0, 10)
}

// Classificadores
function isDistribuicaoLucro(cat, sub, forn) {
  const c = (cat || '').toUpperCase()
  const s = (sub || '').toUpperCase()
  const f = (forn || '').toUpperCase()
  if (c.includes('MOVIMENTAÇÃO FINANCEIRA') && (s.includes('RETIRADA DE SÓCIA') || s.includes('APORTE DE SÓCIA'))) return true
  if (f.includes('ANDREIA') && (c.includes('PARTICULAR') || s.includes('PARTICULAR'))) return true
  if (s.includes('REEMBOLSO') && f.includes('ANDREIA')) return true
  return false
}

function isDivida(cat, sub) {
  const c = (cat || '').toUpperCase()
  const s = (sub || '').toUpperCase()
  if (c === 'FINANCEIRO' && (s.includes('REFINANCIAMENTO') || s.includes('EMPRÉSTIMO') || s.includes('JUROS DE MORA'))) return true
  if (s.includes('REFINANCIA')) return true
  if (c === 'JURÍDICO' && s.includes('ACORDOS')) return true
  if (c === 'ENCARGOS TRABALHISTAS' && s.includes('PARCELAMENTO')) return true
  return false
}

function isTransferencia(cat, cc) {
  const c = (cat || '').toUpperCase()
  const centro = (cc || '').toUpperCase()
  return c.includes('TRANSFERÊNCIA ENTRE CONTAS') || centro.includes('TRANSFERÊNCIA ENTRE CONTAS')
}

function isBloqueio(sub, desc) {
  const s = (sub || '').toUpperCase()
  const d = (desc || '').toUpperCase()
  return s.includes('BLOQUEIO JUDICIAL') || s.includes('DESBLOQUEIO JUDICIAL') || d.includes('BLOQUEIO')
}

const RECORRENTES_MENSAIS = {
  'CONDOMÍNIO': 'aluguel', 'ATTUAL IMÓVEIS': 'aluguel', 'FIBRA ADMINISTRAÇÃO': 'aluguel',
  'DESKTOP INTERNET': 'internet', 'BIGNET': 'internet',
  'CLARO': 'telefone',
  'CONTABNEW': 'contabilidade',
  'EPP CONSUTORIA': 'assessoria', 'EDUARDO PINHEIRO': 'assessoria',
  'TECNOPONTO': 'sistema_ponto',
  'DR DO BEM': 'juridico',
  'SEM PARAR': 'sem_parar',
  'CPFL': 'energia',
}

function isRecorrente(forn) {
  const f = (forn || '').toUpperCase()
  for (const [pattern, tipo] of Object.entries(RECORRENTES_MENSAIS)) {
    if (f.includes(pattern.toUpperCase())) return { freq: 'mensal', tipo }
  }
  if (f.includes('TOKIO MARINE') || f.includes('BRADESCO SEGUROS')) return { freq: 'anual', tipo: 'seguro' }
  return null
}

// ── Main ──
async function main() {
  console.log('Lendo planilha...')
  const wb = XLSX.readFile('scripts/import/caixa.xlsx')
  const sheetName = wb.SheetNames.find(n => n.includes('BASE')) || wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Encontrar cabeçalho
  let headerIdx = -1
  for (let i = 0; i < 10; i++) {
    const row = data[i].map(v => String(v).toLowerCase().trim())
    if (row.some(v => v === 'mês' || v === 'mes' || v === 'data')) { headerIdx = i; break }
  }
  if (headerIdx < 0) { console.error('Cabeçalho não encontrado'); process.exit(1) }

  const headers = data[headerIdx].map(v => String(v).trim())
  const col = {}
  headers.forEach((h, i) => { if (h) col[h.toLowerCase()] = i })

  console.log(`Cabeçalho na linha ${headerIdx + 1}, colunas: ${Object.keys(col).join(', ')}`)

  // Coletar linhas válidas
  const linhas = []
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i]
    const cat = row[col['categoria']] || ''
    const ent = row[col['entradas']] || 0
    const sai = row[col['saídas']] || row[col['saidas']] || 0
    if (!cat && !ent && !sai) continue
    // Ignorar linhas de saldo
    const banco = String(row[col['banco']] || '').trim()
    if (banco.includes('Saldo') || banco.includes('Limite')) continue

    linhas.push({
      mes: row[col['mês']] || row[col['mes']] || '',
      data: row[col['data']],
      fornecedor: String(row[col['fornecedor']] || '').trim(),
      categoria: String(cat).trim(),
      subcategoria: String(row[col['subcategoria']] || '').trim(),
      descricao: String(row[col['descrição']] || row[col['descricao']] || '').trim(),
      centroCusto: String(row[col['centro de custo']] || '').trim(),
      banco: banco,
      entrada: typeof ent === 'number' ? ent : 0,
      saida: typeof sai === 'number' ? sai : 0,
    })
  }

  console.log(`${linhas.length} linhas válidas`)

  // Passo 1: Criar fornecedores faltantes
  const fornUnicos = [...new Set(linhas.map(l => l.fornecedor).filter(Boolean))]
  const { data: fornExistentes } = await supabase.from('fornecedores').select('id, nome').is('deleted_at', null)
  const fornMap = {}
  ;(fornExistentes || []).forEach(f => { fornMap[f.nome.toUpperCase()] = f.id })

  const fornNovos = fornUnicos.filter(f => !fornMap[f.toUpperCase()])
  if (fornNovos.length > 0) {
    const batch = fornNovos.map(nome => ({ nome, ativo: true }))
    const { data: criados, error } = await supabase.from('fornecedores').insert(batch).select('id, nome')
    if (error) console.error('Erro criando fornecedores:', error.message)
    ;(criados || []).forEach(f => { fornMap[f.nome.toUpperCase()] = f.id })
    console.log(`Fornecedores: ${fornNovos.length} novos criados`)
  }

  // Passo 2: Buscar CCs para matching
  const { data: ccsDB } = await supabase.from('centros_custo').select('id, nome, codigo').is('deleted_at', null)
  function matchCC(nomePlanilha) {
    if (!nomePlanilha) return CC_FALLBACK
    const n = nomePlanilha.toUpperCase().trim()
    if (n.includes('TRANSFERÊNCIA')) return CC_FALLBACK
    if (n.includes('TECNOMONTE') || n.includes('MATRIZ')) return CC_MATRIZ
    if (n.includes('PARTICULAR') || n.includes('ANDREIA')) return CC_FALLBACK
    // Tentar match direto
    const match = (ccsDB || []).find(cc => cc.nome.toUpperCase().includes(n) || n.includes(cc.nome.toUpperCase()))
    return match?.id || CC_FALLBACK
  }

  // Passo 3: Preparar lançamentos
  const lancamentos = []
  const recorrenciaPais = {} // chave: fornecedor+categoria → id do pai
  let stats = { receitas: 0, despesas: 0, distribuicoes: 0, dividas: 0, recorrentes: 0, transferencias: 0, bloqueios: 0, ambiguos: 0 }

  for (const l of linhas) {
    const { mes: compMes, ano: compAno } = parseMes(l.mes)
    const dt = parseData(l.data)
    const valor = l.entrada > 0 ? l.entrada : l.saida
    if (!valor || valor === 0) continue

    const tipo = l.entrada > 0 ? 'receita' : 'despesa'
    const contaId = resolverConta(l.banco)
    const ccId = matchCC(l.centroCusto)
    const fornId = fornMap[(l.fornecedor || '').toUpperCase()] || null
    const catCompleta = l.subcategoria ? `${l.categoria} / ${l.subcategoria}` : l.categoria

    const base = {
      tipo,
      nome: l.descricao || l.subcategoria || l.categoria || 'Sem descrição',
      categoria: catCompleta,
      valor: Math.abs(valor),
      status: 'pago',
      data_competencia: `${compAno}-${String(compMes).padStart(2, '0')}-01`,
      data_vencimento: dt || `${compAno}-${String(compMes).padStart(2, '0')}-15`,
      data_pagamento: dt || `${compAno}-${String(compMes).padStart(2, '0')}-15`,
      conta_id: contaId,
      centro_custo_id: ccId,
      fornecedor: l.fornecedor || null,
      fornecedor_id: fornId,
      observacao: l.descricao || null,
      is_provisao: false,
      origem: 'importado',
      competencia_mes: compMes,
      competencia_ano: compAno,
    }

    // Classificar
    if (isTransferencia(l.categoria, l.centroCusto)) {
      base.categoria = 'Transferência interna'
      base.tipo = 'despesa'
      stats.transferencias++
    } else if (isDistribuicaoLucro(l.categoria, l.subcategoria, l.fornecedor)) {
      base.categoria = 'Distribuição de Resultado'
      base.tipo = l.entrada > 0 ? 'receita' : 'despesa'
      stats.distribuicoes++
    } else if (isBloqueio(l.subcategoria, l.descricao)) {
      base.is_provisao = true
      base.status = 'em_aberto'
      base.categoria = 'Bloqueio Judicial - Trabalhista'
      stats.bloqueios++
    } else if (isDivida(l.categoria, l.subcategoria)) {
      base.categoria = 'Pagamento de Dívida'
      stats.dividas++
    } else if (tipo === 'receita') {
      stats.receitas++
    } else {
      stats.despesas++
    }

    // Recorrência
    const rec = isRecorrente(l.fornecedor)
    if (rec) {
      const chave = `${l.fornecedor.toUpperCase()}|${rec.tipo}`
      if (!recorrenciaPais[chave]) {
        base.is_recorrente = true
        base.frequencia = rec.freq
        base.valor_previsto = Math.abs(valor)
        base.alertar_dias_antes = 7
        base.variacao_max_pct = 20
        recorrenciaPais[chave] = true // será atualizado com ID real após insert
        stats.recorrentes++
      } else {
        base.is_recorrente = true
        base.frequencia = rec.freq
      }
    }

    if (!contaId) {
      base.origem = 'importado'
      stats.ambiguos++
    }

    lancamentos.push(base)
  }

  console.log(`\nPreparados ${lancamentos.length} lançamentos`)
  console.log(`  Receitas: ${stats.receitas}`)
  console.log(`  Despesas: ${stats.despesas}`)
  console.log(`  Distribuições de lucro: ${stats.distribuicoes}`)
  console.log(`  Dívidas: ${stats.dividas}`)
  console.log(`  Recorrentes: ${stats.recorrentes}`)
  console.log(`  Transferências: ${stats.transferencias}`)
  console.log(`  Bloqueios judiciais: ${stats.bloqueios}`)
  console.log(`  Ambíguos: ${stats.ambiguos}`)

  // Passo 4: Inserir em batches de 50
  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < lancamentos.length; i += BATCH) {
    const batch = lancamentos.slice(i, i + BATCH)
    const { error } = await supabase.from('financeiro_lancamentos').insert(batch)
    if (error) {
      console.error(`Erro no batch ${Math.floor(i/BATCH)+1}: ${error.message}`)
      // Tentar um por um para identificar o problemático
      for (const l of batch) {
        const { error: e2 } = await supabase.from('financeiro_lancamentos').insert(l)
        if (e2) console.error(`  Falha: ${l.nome} — ${e2.message}`)
        else inserted++
      }
    } else {
      inserted += batch.length
    }
    console.log(`Importados ${inserted}/${lancamentos.length}`)
  }

  console.log(`\n✅ Concluído: ${inserted} lançamentos importados`)
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1) })
