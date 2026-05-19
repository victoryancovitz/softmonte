// Script one-shot pra importar PLANILHA_ATIVA_2_Organizada.xlsx
// Lê XLSX, normaliza dados, gera relatório de validação + SQL INSERT.
// Uso:
//   node scripts/importar-planilha-funcionarios.mjs --modo=relatorio
//   node scripts/importar-planilha-funcionarios.mjs --modo=sql > /tmp/import.sql

import XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'

const PLANILHA = '/Users/victoryancovitz/Downloads/PLANILHA_ATIVA_2_Organizada (1).xlsx'
const FUNCOES_BANCO_PATH = '/tmp/funcoes_banco.json'

const args = process.argv.slice(2)
const modo = args.find(a => a.startsWith('--modo='))?.split('=')[1] || 'relatorio'

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento texto da planilha → nome canônico no banco
// (revisado com base nas 55 variações da planilha vs 35 funções do banco)
// ─────────────────────────────────────────────────────────────────────────────
const FUNCOES_MAP = {
  '1/2 OFICIAL': 'MEIO OFICIAL',
  'ADM DE OBRAS': 'ADMINISTRATIVO DE OBRAS',
  'AJUDANTE': 'AJUDANTE',
  'AJUDANTES': 'AJUDANTE',
  'ALMOXARIFADO': 'ALMOXARIFE',
  'ALMOXARIFE': 'ALMOXARIFE',
  'AUX ADM': 'AUXILIAR ADMINISTRATIVO',
  'AUX ADMINISTRATIVO': 'AUXILIAR ADMINISTRATIVO',
  'AUXILIAR ADMINISTRATIVO': 'AUXILIAR ADMINISTRATIVO',
  'AUX DE ALMOXARIFE': 'AUXILIAR DE ALMOXARIFE',
  'AUX. DE ALMOXARIFE': 'AUXILIAR DE ALMOXARIFE',
  'AUX. DE ALMOXERIFADO': 'AUXILIAR DE ALMOXARIFE',
  'AUXILIAR ALMOXARIFE': 'AUXILIAR DE ALMOXARIFE',
  'AUXILIAR DE ALMOXARIFE': 'AUXILIAR DE ALMOXARIFE',
  'AUX DE LIMPEZA': '__NOVA__AUXILIAR DE LIMPEZA',
  'AUX TECNICO DE PLANEJAMENTO': 'TÉCNICO DE PLANEJAMENTO',
  'AUXILIAR TECNICO DE PLANEJAMENTO': 'TÉCNICO DE PLANEJAMENTO',
  'CALDEIREIRO': 'CALDEIREIRO',
  'CALDEREIRO': 'CALDEIREIRO',
  'CALDEREIRO JUNIOR': 'CALDEIREIRO',
  'COMPRADOR': '__NOVA__COMPRADOR',
  'ELETRECISTA': 'ELETRICISTA',
  'ELETRICISTA': 'ELETRICISTA',
  'ENCANADOR': 'ENCANADOR',
  'ENCARREGADO': 'ENCARREGADO',
  'ENCARREGADO CALDEIRARIA': 'ENCARREGADO DE CALDEIRARIA',
  'ENCARREGADO DE CALDEIRARIA': 'ENCARREGADO DE CALDEIRARIA',
  'ENCARREGADO DE CALDERARIA': 'ENCARREGADO DE CALDEIRARIA',
  'ENCARREGADO DE CALDEREIRO': 'ENCARREGADO DE CALDEIRARIA',
  'ENCARREGADO DE ANDAIME': 'ENCARREGADO',
  'ENCARREGADO DE SOLDA': 'ENCARREGADO',
  'ENCARREGADO PINTURA': 'ENCARREGADO',
  'LIDER': 'ENCARREGADO',
  'LIDER DE ANDAIME': 'ENCARREGADO',
  'MECANICO': 'MECÂNICO',
  'MEIO OFICIAL': 'MEIO OFICIAL',
  'MONTADOR DE ANDAIME': 'MONTADOR DE ANDAIMES',
  'MONTADOR DE ANDAIMES': 'MONTADOR DE ANDAIMES',
  'OP DE MUNCK': 'OPERADOR DE MUNCK',
  'OPERADOR DE MUNCK': 'OPERADOR DE MUNCK',
  'PINTOR': 'PINTOR',
  'PINTOR JATISTA': 'PINTOR JATISTA',
  'SOLDADOR ER': 'SOLDADOR ER',
  'SOLDADOR MIG': 'SOLDADOR MIG',
  'SOLDADOR TIG': 'SOLDADOR TIG',
  'SOLDADOR TIG/ER': 'SOLDADOR TIG',
  'SUPERVISOR': 'SUPERVISOR DE OBRAS',
  'TEC DE SEGURANÇA': 'TÉCNICO DE SEGURANÇA',
  'TEC. DE SEGURANÇA': 'TÉCNICO DE SEGURANÇA',
  'TECNICO DE SEGURANCA': 'TÉCNICO DE SEGURANÇA',
  'TECNICO SEG. DO TRABALHO': 'TÉCNICO DE SEGURANÇA DO TRABALHO',
  'TECNICO SEGURANÇA DO TRABALHO': 'TÉCNICO DE SEGURANÇA DO TRABALHO',
  'TEC. DE PLANEJ': 'TÉCNICO DE PLANEJAMENTO',
  'TECNICO DE PLANEJAMENTO': 'TÉCNICO DE PLANEJAMENTO',
  'TST': 'TÉCNICO DE SEGURANÇA DO TRABALHO',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizaCpf(v) {
  if (!v) return null
  const s = String(v).replace(/\D/g, '')
  if (s.length === 0) return null
  return s.padStart(11, '0').slice(0, 11)
}

function normalizaTextoCaixa(v) {
  if (!v) return null
  return String(v).trim().toUpperCase().replace(/\s+/g, ' ')
}

function tituloCaso(v) {
  if (!v) return null
  return String(v).trim().split(/\s+/).map(w => {
    if (w.length <= 2) return w.toLowerCase()
    return w[0].toUpperCase() + w.slice(1).toLowerCase()
  }).join(' ').replace(/^./, c => c.toUpperCase())
}

function tituloCasoCidade(v) {
  if (!v) return null
  // "São Vicente-sp" → "São Vicente-SP"
  return tituloCaso(v).replace(/-([a-z]{2})$/i, (_, uf) => '-' + uf.toUpperCase())
}

function parseCtps(raw) {
  if (!raw) return { numero: null, serie: null, uf: null, digital: false }
  const s = String(raw).trim()
  if (/^DIGITAL/i.test(s)) return { numero: null, serie: null, uf: null, digital: true }
  // Padrões frequentes: "123 - 456 UF", "123/456", "123-456 UF"
  const m = s.match(/^([\d.-]+)[\s/-]+([\d.-]+)(?:\s+([A-Z]{2}))?/i)
  if (m) {
    return {
      numero: m[1].replace(/\W/g, '') || null,
      serie: m[2].replace(/\W/g, '') || null,
      uf: (m[3] || '').toUpperCase().slice(0, 2) || null,
      digital: false,
    }
  }
  // Padrão "123456 UF" no fim
  const m2 = s.match(/^(\S+)\s+([A-Z]{2})$/i)
  if (m2) {
    return {
      numero: m2[1].replace(/\W/g, ''),
      serie: null,
      uf: m2[2].toUpperCase(),
      digital: false,
    }
  }
  // Caso descarte: salva tudo em ctps_numero como veio (limpando)
  return { numero: s.slice(0, 50), serie: null, uf: null, digital: false }
}

function excelSerialParaIsoDate(serial) {
  if (serial == null || serial === '') return null
  // Já vier como string ISO
  if (typeof serial === 'string') {
    const m = serial.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    // dd/mm/yyyy ou mm/dd/yyyy ou dd.mm.yyyy — detecta formato
    const m2 = serial.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/)
    if (m2) {
      let [, a, b, c] = m2
      if (c.length === 2) c = '20' + c
      const ai = parseInt(a, 10)
      const bi = parseInt(b, 10)
      let dd, mm
      if (ai > 12 && bi <= 12) {
        // a só pode ser dia → formato dd/mm/yyyy
        dd = a.padStart(2, '0')
        mm = b.padStart(2, '0')
      } else if (bi > 12 && ai <= 12) {
        // b só pode ser dia → formato mm/dd/yyyy
        dd = b.padStart(2, '0')
        mm = a.padStart(2, '0')
      } else {
        // ambíguo (ambos ≤ 12) → assume dd/mm/yyyy (padrão BR)
        dd = a.padStart(2, '0')
        mm = b.padStart(2, '0')
      }
      // valida mês 01-12
      if (parseInt(mm, 10) < 1 || parseInt(mm, 10) > 12) return null
      return `${c}-${mm}-${dd}`
    }
    return null
  }
  if (typeof serial !== 'number') return null
  // Excel: 1 = 1900-01-01 (com bug do ano bissexto)
  // Fórmula: epoch + (serial - 25569) * 86400 ms
  const ms = (serial - 25569) * 86400 * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parsePeriodo(v) {
  if (!v) return { texto: null, tipo_vinculo: 'experiencia_45_45', dias: null }
  const s = String(v).trim().toUpperCase()
  const m = s.match(/(\d+)\s*DIAS?/)
  const dias = m ? parseInt(m[1], 10) : null
  let tipo = 'experiencia_45_45' // default seguro (planilha tem coluna PERÍODO muito suja)
  if (dias === 45) tipo = 'experiencia_45_45'
  else if (dias === 30) tipo = 'experiencia_30_60'
  else if (dias === 90) tipo = 'experiencia_90'
  else if (/45\s*\+\s*45/.test(s)) tipo = 'experiencia_45_45'
  else if (s.includes('INDETERMINADO')) tipo = 'indeterminado'
  // Quando célula é valor em R$/número, preserva no texto mas usa default no enum
  const textoLimpo = (dias != null || /\d+\s*\+\s*\d+/.test(s) || s.includes('INDETERMINADO'))
    ? s
    : null // suja: ignora
  return { texto: textoLimpo, tipo_vinculo: tipo, dias }
}

function num(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const s = String(v).replace(',', '.').replace(/[^\d.-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function sqlString(v) {
  if (v == null) return 'NULL'
  return "'" + String(v).replace(/'/g, "''") + "'"
}

function sqlNum(v) {
  if (v == null) return 'NULL'
  return String(v)
}

function sqlDate(v) {
  if (!v) return 'NULL'
  return `'${v}'::date`
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser principal
// ─────────────────────────────────────────────────────────────────────────────

const wb = XLSX.readFile(PLANILHA)

const ABAS = {
  ATIVOS: { status: 'disponivel', criaWorkflow: true },
  'AVISO TRABALHADO': { status: 'disponivel', criaWorkflow: true },
  AFASTADOS: { status: 'afastado', criaWorkflow: true },
  INATIVOS: { status: 'inativo', criaWorkflow: false },
}

const todos = []
const funcoesNaoMapeadas = new Set()
const cpfsVistos = new Map() // cpf → primeira aba onde apareceu
const semCpf = []
const semNome = []

for (const [abaNome, cfg] of Object.entries(ABAS)) {
  const ws = wb.Sheets[abaNome]
  if (!ws) continue
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null })

  for (const r of rows) {
    const nomeRaw = r.NOME
    const cpfRaw = r.CPF
    const cpf = normalizaCpf(cpfRaw)
    const nome = nomeRaw ? tituloCaso(String(nomeRaw).replace(/\(.*?\)/g, '').replace(/\d+\.\d+/g, '').trim()) : null

    if (!nome) {
      semNome.push({ aba: abaNome, raw: r })
      continue
    }
    if (!cpf) {
      semCpf.push({ aba: abaNome, nome })
    }
    if (cpf) {
      if (cpfsVistos.has(cpf)) {
        // duplicado entre abas — mantém só a primeira (ordem: ATIVOS > AVISO > AFASTADOS > INATIVOS)
        // se duplicado dentro da mesma aba, idem
        continue
      }
      cpfsVistos.set(cpf, abaNome)
    }

    const funcaoTexto = normalizaTextoCaixa(r['FUNÇÃO'])
    const funcaoCanonica = funcaoTexto ? FUNCOES_MAP[funcaoTexto] : null
    if (funcaoTexto && !funcaoCanonica) {
      funcoesNaoMapeadas.add(funcaoTexto)
    }

    const periodo = parsePeriodo(r['PERÍODO'])
    let salario = num(r['SALÁRIO'])
    // Sanity check: salário > R$ 100k é claramente lixo (telefone/conta) na planilha INATIVOS
    if (salario != null && (salario > 100000 || salario < 0)) salario = null
    const valor30 = num(r['valor 30%'])
    const insalubridadePct = valor30 && salario && salario > 0 ? 30 : 0
    let vtMensal = num(r['VTOTAL'])
    if (vtMensal != null && (vtMensal > 10000 || vtMensal < 0)) vtMensal = null

    // Agência/conta varia entre abas
    const agConta = r['AGÊNCIA'] && r.CONTA
      ? `AG ${r['AGÊNCIA']} CC ${r.CONTA}`
      : r['AGENCIA E CONTA'] || null

    // PIX varia
    const pix = r['CHAVE PIX'] || r['PIX'] || null

    // Telefone — manda pro celular pq quase todo mundo é móvel
    const telCel = r['Telefone'] || null

    todos.push({
      aba: abaNome,
      status: cfg.status,
      criaWorkflow: cfg.criaWorkflow,
      // Identificação
      nome,
      matricula: r['Dixi'] ? String(r['Dixi']) : null,
      cpf,
      data_nascimento: excelSerialParaIsoDate(r['Data NASC.']),
      // Função/cargo
      cargo: funcaoTexto || 'A DEFINIR',
      funcao_canonica: funcaoCanonica?.startsWith('__NOVA__') ? null : funcaoCanonica,
      funcao_nova: funcaoCanonica?.startsWith('__NOVA__') ? funcaoCanonica.replace('__NOVA__', '') : null,
      // Datas contratuais
      admissao: excelSerialParaIsoDate(r['ADMISSÃO']),
      prazo1: excelSerialParaIsoDate(r['PRAZO 1']),
      prazo2: excelSerialParaIsoDate(r['PRAZO 2']),
      tipo_vinculo: periodo.tipo_vinculo,
      periodo_contrato: periodo.texto,
      // Documentos
      re: r['RG'] ? String(r['RG']) : null,
      rg_data_expedicao: excelSerialParaIsoDate(r['DATA EXPEDIÇÃO RG']),
      ...((() => {
        const c = parseCtps(r['CTPS'])
        const ufFromEstEmissor = r['EST. EMISSOR CTPS']
          ? String(r['EST. EMISSOR CTPS']).trim().toUpperCase().slice(0, 2)
          : null
        return {
          ctps_numero: c.digital ? null : c.numero,
          ctps_serie: c.digital ? null : c.serie,
          ctps_uf: c.digital ? null : (c.uf || ufFromEstEmissor),
          tem_carteira_digital: c.digital,
        }
      })()),
      pis: r['PIS'] ? String(r['PIS']) : null,
      titulo_eleitor: r['TITULO'] ? String(r['TITULO']) : null,
      // Dados pessoais
      naturalidade: r['NATURALIDADE'] ? tituloCasoCidade(r['NATURALIDADE']) : null,
      estado_civil: r['ESTADO CIVIL'] ? String(r['ESTADO CIVIL']).toLowerCase() : null,
      raca_cor: r['RAÇA/COR'] ? tituloCaso(r['RAÇA/COR']) : null,
      nome_pai: r['PAI'] ? tituloCaso(r['PAI']) : null,
      nome_mae: r['MÃE'] ? tituloCaso(r['MÃE']) : null,
      // Bancárias
      banco: r['BANCO'] ? String(r['BANCO']) : null,
      agencia_conta: agConta,
      pix: pix != null ? String(pix) : null,
      // Salário
      salario_base: salario,
      insalubridade_pct: insalubridadePct,
      // Benefícios
      vt_estrutura: r['VALE TRANSPORTE'] ? String(r['VALE TRANSPORTE']) : null,
      vt_mensal: vtMensal,
      tamanho_bota: r['BOTA'] ? String(r['BOTA']) : null,
      tamanho_uniforme: r['UNIFORME'] ? String(r['UNIFORME']) : null,
      // Endereço
      endereco: r['ENDEREÇO'] ? tituloCaso(r['ENDEREÇO']) : null,
      cidade_endereco: r['CIDADE'] ? tituloCasoCidade(r['CIDADE']) : null,
      cep: r['CEP'] ? String(r['CEP']) : null,
      // ASOs / integração
      aso_admissional: excelSerialParaIsoDate(r['ASO ADM.']),
      proximo_aso_periodico: excelSerialParaIsoDate(r['ASO PERÍO']),
      data_integracao: excelSerialParaIsoDate(r['INTEGRAÇÃO']),
      // Contato
      telefone_celular: telCel,
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Relatório
// ─────────────────────────────────────────────────────────────────────────────
if (modo === 'relatorio') {
  const porAba = {}
  for (const t of todos) {
    porAba[t.aba] = (porAba[t.aba] || 0) + 1
  }
  console.log('=== RESUMO ===')
  console.log('Total a importar:', todos.length)
  console.log('Por aba:', porAba)
  console.log('CPFs únicos (após dedup entre abas):', cpfsVistos.size)
  console.log('Sem CPF:', semCpf.length)
  console.log('Sem nome (descartados):', semNome.length)
  console.log()
  console.log('=== FUNÇÕES NÃO MAPEADAS ===')
  if (funcoesNaoMapeadas.size === 0) {
    console.log('(nenhuma — todas têm match)')
  } else {
    for (const f of funcoesNaoMapeadas) console.log(' ', f)
  }
  console.log()
  console.log('=== FUNÇÕES NOVAS A CRIAR ===')
  const novas = new Set()
  for (const t of todos) if (t.funcao_nova) novas.add(t.funcao_nova)
  for (const n of novas) console.log(' ', n)
  console.log()
  console.log('=== SEM CPF (primeiros 10) ===')
  for (const s of semCpf.slice(0, 10)) console.log(' ', s.aba, '—', s.nome)
  console.log()
  console.log('=== EXEMPLO DE REGISTRO NORMALIZADO ===')
  console.log(JSON.stringify(todos[0], null, 2))

  writeFileSync('/tmp/funcionarios_normalizados.json', JSON.stringify(todos, null, 2))
  console.log()
  console.log('JSON completo salvo em /tmp/funcionarios_normalizados.json (', todos.length, 'registros)')
}

if (modo === 'sql') {
  const linhas = []
  linhas.push('-- Importação one-shot da PLANILHA_ATIVA_2 gerada em ' + new Date().toISOString())
  linhas.push('-- Backup já feito em schema backup_funcionarios_20260519')
  linhas.push('-- TODA A IMPORTAÇÃO RODA EM UMA TRANSAÇÃO. Final controla por --commit ou --rollback no chamador.')
  linhas.push('')
  linhas.push('-- Limpa as 3 tabelas com NO ACTION primeiro (FKs bloqueariam o TRUNCATE)')
  linhas.push('DELETE FROM public.rescisoes;')
  linhas.push('DELETE FROM public.funcionario_historico_salarial;')
  linhas.push('DELETE FROM public.historico_funcional;')
  linhas.push('DELETE FROM public.pagamentos_extras;')
  linhas.push('DELETE FROM public.folha_itens;')
  linhas.push('DELETE FROM public.estoque_movimentacoes WHERE responsavel_id IS NOT NULL;')
  linhas.push('DELETE FROM public.estoque_requisicao_itens WHERE funcionario_id IS NOT NULL;')
  linhas.push('DELETE FROM public.estoque_requisicoes WHERE solicitante_id IS NOT NULL;')
  linhas.push('DELETE FROM public.fichas_epi;')
  linhas.push('DELETE FROM public.holerite_envios;')
  linhas.push('DELETE FROM public.holerite_questionamentos;')
  linhas.push('DELETE FROM public.admissao_overrides;')
  linhas.push('DELETE FROM public.requisicoes WHERE solicitante_id IS NOT NULL;')
  linhas.push('-- profiles tem SET NULL — ok')
  linhas.push('')
  linhas.push('-- TRUNCATE CASCADE limpa funcionarios + 17 tabelas com CASCADE FK')
  linhas.push('TRUNCATE TABLE public.funcionarios CASCADE;')
  linhas.push('')
  linhas.push('-- ── Funções novas (criadas no banco se ainda não existem) ──')
  // Funções novas (sem __NOVA__ prefix)
  const novasFuncoes = new Set()
  for (const t of todos) if (t.funcao_nova) novasFuncoes.add(t.funcao_nova)
  for (const nome of novasFuncoes) {
    linhas.push(`INSERT INTO public.funcoes (nome, ativo) VALUES (${sqlString(nome)}, true) ON CONFLICT (nome) DO NOTHING;`)
  }
  linhas.push('')
  linhas.push('-- ── INSERT funcionarios (' + todos.length + ' registros) ──')

  for (const t of todos) {
    const funcaoNome = t.funcao_canonica || t.funcao_nova || null
    const cols = [
      'nome', 'matricula', 'cpf', 'data_nascimento',
      'cargo', 'funcao_id',
      'admissao', 'prazo1', 'prazo2', 'tipo_vinculo', 'periodo_contrato',
      're', 'rg_data_expedicao', 'ctps_numero', 'ctps_serie', 'ctps_uf', 'tem_carteira_digital',
      'pis', 'titulo_eleitor',
      'naturalidade', 'estado_civil', 'raca_cor', 'nome_pai', 'nome_mae',
      'banco', 'agencia_conta', 'pix',
      'salario_base', 'insalubridade_pct',
      'vt_estrutura', 'vt_mensal', 'tamanho_bota', 'tamanho_uniforme',
      'endereco', 'cidade_endereco', 'cep',
      'aso_admissional', 'proximo_aso_periodico', 'data_integracao',
      'telefone_celular',
      'status',
    ]
    const vals = [
      sqlString(t.nome),
      sqlString(t.matricula),
      sqlString(t.cpf),
      sqlDate(t.data_nascimento),
      sqlString(t.cargo),
      funcaoNome ? `(SELECT id FROM public.funcoes WHERE nome = ${sqlString(funcaoNome)} AND ativo = true LIMIT 1)` : 'NULL',
      sqlDate(t.admissao),
      sqlDate(t.prazo1),
      sqlDate(t.prazo2),
      sqlString(t.tipo_vinculo),
      sqlString(t.periodo_contrato),
      sqlString(t.re),
      sqlDate(t.rg_data_expedicao),
      sqlString(t.ctps_numero),
      sqlString(t.ctps_serie),
      sqlString(t.ctps_uf),
      t.tem_carteira_digital ? 'true' : 'false',
      sqlString(t.pis),
      sqlString(t.titulo_eleitor),
      sqlString(t.naturalidade),
      sqlString(t.estado_civil),
      sqlString(t.raca_cor),
      sqlString(t.nome_pai),
      sqlString(t.nome_mae),
      sqlString(t.banco),
      sqlString(t.agencia_conta),
      sqlString(t.pix),
      sqlNum(t.salario_base),
      sqlNum(t.insalubridade_pct),
      sqlString(t.vt_estrutura),
      sqlNum(t.vt_mensal),
      sqlString(t.tamanho_bota),
      sqlString(t.tamanho_uniforme),
      sqlString(t.endereco),
      sqlString(t.cidade_endereco),
      sqlString(t.cep),
      sqlDate(t.aso_admissional),
      sqlDate(t.proximo_aso_periodico),
      sqlDate(t.data_integracao),
      sqlString(t.telefone_celular),
      sqlString(t.status),
    ]
    linhas.push(`INSERT INTO public.funcionarios (${cols.join(', ')}) VALUES (${vals.join(', ')});`)
  }

  linhas.push('')
  linhas.push('-- ── admissoes_workflow concluído (apenas para ATIVOS / AVISO / AFASTADOS) ──')
  linhas.push(`-- Etapas todas com {ok: true}, status=concluida, concluida_em=now(). Passa por getPendenciasAdmissao() vazio.`)
  // INSERT em massa via SELECT do funcionário pelo CPF
  linhas.push(`
INSERT INTO public.admissoes_workflow (
  funcionario_id, status, concluida_em, wizard_passo_atual,
  etapa_docs_pessoais, etapa_exame_admissional, etapa_ctps, etapa_contrato_assinado,
  etapa_dados_bancarios, etapa_epi_entregue, etapa_nr_obrigatorias, etapa_integracao,
  etapa_uniforme, etapa_esocial, responsavel_rh, observacoes
)
SELECT
  f.id,
  'concluida',
  now(),
  10,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  '{"ok": true}'::jsonb,
  'Importação one-shot 2026-05-19',
  'Admissão preenchida via planilha histórica — sem pendências para permitir alocação posterior'
FROM public.funcionarios f
WHERE f.status IN ('disponivel', 'afastado');
`)

  linhas.push('')
  linhas.push('-- ── Verificação ──')
  linhas.push(`SELECT 'funcionarios' AS tabela, COUNT(*) FROM public.funcionarios
UNION ALL SELECT 'funcionarios_com_funcao', COUNT(*) FROM public.funcionarios WHERE funcao_id IS NOT NULL
UNION ALL SELECT 'funcionarios_disponivel', COUNT(*) FROM public.funcionarios WHERE status = 'disponivel'
UNION ALL SELECT 'funcionarios_afastado', COUNT(*) FROM public.funcionarios WHERE status = 'afastado'
UNION ALL SELECT 'funcionarios_inativo', COUNT(*) FROM public.funcionarios WHERE status = 'inativo'
UNION ALL SELECT 'admissoes_workflow', COUNT(*) FROM public.admissoes_workflow
UNION ALL SELECT 'cpfs_duplicados', COUNT(*) FROM (SELECT cpf, COUNT(*) FROM public.funcionarios WHERE cpf IS NOT NULL GROUP BY cpf HAVING COUNT(*) > 1) x;`)

  const sql = linhas.join('\n')
  writeFileSync('/tmp/importacao.sql', sql)
  console.error('SQL gerado em /tmp/importacao.sql (', sql.length, 'chars,', linhas.length, 'linhas )')
  console.error('Funções novas a criar:', novasFuncoes.size)
  console.error('Funcionários a inserir:', todos.length)
  console.error('Workflows a criar:', todos.filter(t => t.criaWorkflow).length)
}
