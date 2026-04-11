import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import PrintButton from './PrintButton'

const MESES = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
const f2 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function valorPorExtenso(v: number): string {
  if (v === 0) return 'zero reais'
  const un = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dz = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const ct = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
  function g(n: number): string {
    if (n === 0) return ''
    if (n === 100) return 'cem'
    if (n < 20) return un[n]
    if (n < 100) return dz[Math.floor(n / 10)] + (n % 10 ? ' e ' + un[n % 10] : '')
    return ct[Math.floor(n / 100)] + (n % 100 ? ' e ' + g(n % 100) : '')
  }
  const inteiro = Math.floor(v)
  const centavos = Math.round((v - inteiro) * 100)
  let r = ''
  if (inteiro >= 1000) { r += g(Math.floor(inteiro / 1000)) + ' mil'; if (inteiro % 1000) r += ' ' + (inteiro % 1000 < 100 ? 'e ' : '') + g(inteiro % 1000) }
  else if (inteiro > 0) r = g(inteiro)
  r += inteiro === 1 ? ' real' : ' reais'
  if (centavos > 0) r += ' e ' + g(centavos) + (centavos === 1 ? ' centavo' : ' centavos')
  return r
}

export default async function HoleritePage({ params }: { params: { id: string; funcionarioId: string } }) {
  const supabase = createClient()
  const [{ data: fi }, { data: ff }, { data: func }, { data: empresa }] = await Promise.all([
    supabase.from('folha_itens').select('*').eq('folha_id', params.id).eq('funcionario_id', params.funcionarioId).maybeSingle(),
    supabase.from('folha_fechamentos').select('*, obras(nome, local)').eq('id', params.id).maybeSingle(),
    supabase.from('funcionarios').select('*, funcoes(nome)').eq('id', params.funcionarioId).maybeSingle(),
    supabase.from('empresa_config').select('*').limit(1).maybeSingle(),
  ])
  if (!fi || !ff || !func) notFound()

  const sal = Number(fi.salario_total || 0)
  const diasTrab = Number(fi.dias_trabalhados || 30)
  const salProp = diasTrab < 30 ? Math.round(sal * diasTrab / 30 * 100) / 100 : sal
  const insalPct = Number(func.insalubridade_pct || 0)
  const insalVal = insalPct > 0 ? Math.round(1518 * insalPct / 100 * 100) / 100 : 0
  const pericPct = Number(func.periculosidade_pct || 0)
  const pericVal = pericPct > 0 ? Math.round(sal * pericPct / 100 * 100) / 100 : 0
  const he50h = Number(fi.horas_extras_50 || 0)
  const he50v = Number(fi.valor_he_50 || 0)
  const he100h = Number(fi.horas_extras_100 || 0)
  const he100v = Number(fi.valor_he_100 || 0)
  const adNoturno = Number(fi.valor_adicional_noturno || 0)
  const vt = Number(func.vt_mensal || 0)
  const vr = Number(func.vr_diario || 0) * diasTrab
  const va = Number(func.va_mensal || 0)
  const plano = Number(func.plano_saude_mensal || 0)
  const inss = Number(fi.desconto_inss || 0)
  const irrf = Number(fi.desconto_irrf || 0)
  const descVT = Number(fi.outros_descontos || 0)
  const liquido = Number(fi.valor_liquido || 0)
  const baseFgts = salProp + he50v + he100v + insalVal + pericVal
  const fgtsMes = Math.round(baseFgts * 0.08 * 100) / 100
  const baseIrrf = sal - inss
  const inssRef = sal > 0 ? (inss / sal * 100).toFixed(2) : '0,00'
  const cidade = ff.obras?.local || empresa?.cidade || 'Paulínia'

  type Ev = { cod: string; desc: string; ref: string; venc: number; desc_val: number }
  const evs: Ev[] = []
  evs.push({ cod: '0001', desc: 'SALÁRIO MENSAL', ref: `${diasTrab},0000`, venc: salProp, desc_val: 0 })
  if (insalVal > 0) evs.push({ cod: '0010', desc: 'ADICIONAL DE INSALUBRIDADE', ref: `${insalPct.toFixed(2)}%`, venc: insalVal, desc_val: 0 })
  if (pericVal > 0) evs.push({ cod: '0020', desc: 'ADICIONAL DE PERICULOSIDADE', ref: `${pericPct.toFixed(2)}%`, venc: pericVal, desc_val: 0 })
  if (he50v > 0) evs.push({ cod: '0030', desc: 'HORA EXTRA 50%', ref: `${he50h.toFixed(2)}`, venc: he50v, desc_val: 0 })
  if (he100v > 0) evs.push({ cod: '0040', desc: 'HORA EXTRA 100%', ref: `${he100h.toFixed(2)}`, venc: he100v, desc_val: 0 })
  if (adNoturno > 0) evs.push({ cod: '0050', desc: 'ADICIONAL NOTURNO', ref: '', venc: adNoturno, desc_val: 0 })
  if (vt > 0) evs.push({ cod: '1010', desc: 'VALE TRANSPORTE', ref: '', venc: vt, desc_val: 0 })
  if (vr > 0) evs.push({ cod: '1020', desc: 'VALE REFEIÇÃO', ref: `${diasTrab}`, venc: vr, desc_val: 0 })
  if (va > 0) evs.push({ cod: '1030', desc: 'VALE ALIMENTAÇÃO', ref: '', venc: va, desc_val: 0 })
  if (plano > 0) evs.push({ cod: '1040', desc: 'PLANO DE SAÚDE', ref: '', venc: plano, desc_val: 0 })
  if (inss > 0) evs.push({ cod: '9860', desc: 'I.N.S.S.', ref: `${inssRef}`, venc: 0, desc_val: inss })
  if (irrf > 0) evs.push({ cod: '9870', desc: 'I.R.R.F.', ref: '', venc: 0, desc_val: irrf })
  if (descVT > 0) evs.push({ cod: '9880', desc: 'DESC. VALE TRANSPORTE', ref: '6,00%', venc: 0, desc_val: descVT })

  const totVenc = evs.reduce((s, e) => s + e.venc, 0)
  const totDesc = evs.reduce((s, e) => s + e.desc_val, 0)
  const dtPg = ff.data_pagamento_prevista ? new Date(ff.data_pagamento_prevista + 'T12:00') : new Date()

  const S: React.CSSProperties = { fontFamily: "'Courier New', monospace", fontSize: 9, color: '#000', lineHeight: 1.3 }
  const TB: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
  const TH: React.CSSProperties = { border: '1px solid #000', padding: '2px 4px', fontWeight: 700, fontSize: 8, textAlign: 'left', background: '#f3f4f6' }
  const TD: React.CSSProperties = { border: '1px solid #000', padding: '2px 4px', fontSize: 9 }
  const TDR: React.CSSProperties = { ...TD, textAlign: 'right' }

  return (
    <>
      <PrintButton />
      <style>{`
        @media print { nav,header,aside,.no-print,button{display:none!important} @page{size:A4 portrait;margin:8mm} body{margin:0} .hol{box-shadow:none!important;border:none!important;max-width:none!important} }
        @media screen { .hol{max-width:210mm;margin:20px auto;background:white;box-shadow:0 2px 12px rgba(0,0,0,.1);} }
      `}</style>

      <div className="hol" style={{ ...S, padding: 16 }}>
        {/* ══ BLOCO 1: RECIBO DE PAGAMENTO ══ */}
        <div style={{ border: '2px solid #000', padding: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #000', paddingBottom: 6, marginBottom: 8 }}>
            <div><div style={{ fontSize: 14, fontWeight: 900, color: '#0F3757' }}>TECNOMONTE</div><div style={{ fontSize: 8 }}>FABRICAÇÃO, MONTAGEM E MANUTENÇÃO INDUSTRIAL</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, fontWeight: 700 }}>RECIBO DE PAGAMENTO</div><div style={{ fontSize: 10, fontWeight: 700 }}>Valor R$ {f2(liquido)}</div></div>
          </div>
          <div style={{ fontSize: 9, lineHeight: 1.6 }}>
            <p>Recebi(emos) de <strong>TECNOMONTE FABRICAÇÃO, MONTAGEM E MANUTENÇÃO INDUSTRIAL</strong>.</p>
            <p>A importância de: <strong>{valorPorExtenso(liquido)}</strong></p>
            <p>Referente a {MESES[ff.mes]}/{ff.ano} — Salário {func.cargo}</p>
            {he50v > 0 && <p>70% HE {he50h}h R$ {f2(he50v)}</p>}
            {he100v > 0 && <p>100% HE {he100h}h R$ {f2(he100v)}</p>}
            <p style={{ marginTop: 8 }}>Por ser verdade, firmo o presente.</p>
            <p>{cidade}, {dtPg.getDate()} de {MESES[dtPg.getMonth() + 1]?.toLowerCase() || ''} de {dtPg.getFullYear()}</p>
            <div style={{ marginTop: 16, borderTop: '1px solid #000', width: '60%', paddingTop: 4, textAlign: 'center', fontSize: 8 }}>
              {func.nome}
            </div>
          </div>
        </div>

        {/* ══ BLOCO 2: FOLHA DE PAGAMENTO ══ */}
        <div style={{ border: '2px solid #000', padding: 10 }}>
          {/* Cabeçalho empresa */}
          <div style={{ borderBottom: '1px solid #000', paddingBottom: 4, marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 10 }}>0617 - TECNOMONTE FABRICACAO E MONTAGENS DE TAN</div>
            <div style={{ fontSize: 8 }}>{empresa?.endereco || 'AV PIO XII, 33'} - {empresa?.cidade || 'NOVA PAULÍNIA'} - {empresa?.estado || 'SP'} - CEP {empresa?.cep || '13140-289'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
              <span>{empresa?.cnpj || '31.045.857/0001-51'}</span>
              <span>{MESES[ff.mes]}/{ff.ano}  Data do Crédito: {dtPg.toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* Funcionário */}
          <div style={{ borderBottom: '1px solid #000', paddingBottom: 4, marginBottom: 6, fontSize: 9 }}>
            <strong>{func.matricula || '—'}</strong> - {func.nome}
          </div>

          {/* Tabela de eventos */}
          <table style={TB}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 40 }}>Cód.</th>
                <th style={TH}>Descrição</th>
                <th style={{ ...TH, width: 65, textAlign: 'center' }}>Referência</th>
                <th style={{ ...TH, width: 80, textAlign: 'right' }}>Vencimentos</th>
                <th style={{ ...TH, width: 80, textAlign: 'right' }}>Descontos</th>
              </tr>
            </thead>
            <tbody>
              {evs.map(e => (
                <tr key={e.cod}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 8 }}>{e.cod}</td>
                  <td style={TD}>{e.desc}</td>
                  <td style={{ ...TD, textAlign: 'center', fontSize: 8 }}>{e.ref}</td>
                  <td style={TDR}>{e.venc > 0 ? f2(e.venc) : ''}</td>
                  <td style={TDR}>{e.desc_val > 0 ? f2(e.desc_val) : ''}</td>
                </tr>
              ))}
              {/* Linhas vazias para preencher espaço */}
              {Array.from({ length: Math.max(0, 8 - evs.length) }).map((_, i) => (
                <tr key={`empty-${i}`}><td style={TD}>&nbsp;</td><td style={TD}></td><td style={TD}></td><td style={TDR}></td><td style={TDR}></td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: '#f3f4f6' }}>
                <td colSpan={3} style={{ ...TD, textAlign: 'right' }}>TOTAIS</td>
                <td style={TDR}>{f2(totVenc)}</td>
                <td style={TDR}>{f2(totDesc)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Rodapé: RG, cargo, banco */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: 4, marginTop: 4, fontSize: 8 }}>
            <div>
              <div>T.P.: MENSALISTA</div>
              <div>BCO.: {func.banco || '—'}</div>
              <div>CARGO: {func.cargo}</div>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 11, color: '#0F3757' }}>
              TOTAL LÍQUIDO: R$ {f2(liquido)}
            </div>
          </div>

          {/* Bases de cálculo */}
          <table style={{ ...TB, marginTop: 6, fontSize: 8 }}>
            <tbody>
              <tr>
                <td style={TD}><strong>Salário Base</strong><br/>{f2(Number(func.salario_base || 0))}</td>
                <td style={TD}><strong>Sal. Contr. INSS</strong><br/>{f2(sal)}</td>
                <td style={TD}><strong>Base Cálc. FGTS</strong><br/>{f2(baseFgts)}</td>
                <td style={TD}><strong>F.G.T.S. do Mês</strong><br/>{f2(fgtsMes)}</td>
              </tr>
              <tr>
                <td style={TD}><strong>Base Cálc. IRRF</strong><br/>{f2(baseIrrf)}</td>
                <td style={TD}><strong>Faixa IRRF</strong><br/>{irrf > 0 ? '7,50' : '0,00'}</td>
                <td colSpan={2} style={TD}></td>
              </tr>
            </tbody>
          </table>

          {/* Declaração */}
          <div style={{ borderTop: '2px solid #000', marginTop: 8, paddingTop: 6, fontSize: 8 }}>
            <p style={{ fontWeight: 700 }}>DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE RECIBO</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <span>DATA: ____/____/________</span>
              <span>ASSINATURA DO FUNCIONÁRIO: ________________________________</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8, textAlign: 'center', fontSize: 7, color: '#999' }}>
          Documento gerado pelo Softmonte em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </>
  )
}
