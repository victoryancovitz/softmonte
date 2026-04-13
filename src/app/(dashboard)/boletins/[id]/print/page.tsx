import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import PrintTrigger from './PrintTrigger'
import { fmt } from '@/lib/cores'
const fmtN = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

const TIPO_VINCULO_LABEL: Record<string, string> = {
  normal: 'Hora Normal',
  extra_70: 'HE 70%',
  extra_100: 'HE 100%',
}

export default async function BMPrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: bm } = await supabase
    .from('boletins_medicao')
    .select('*, obras(id, nome, cliente, local)')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!bm) notFound()

  const { data: itens } = await supabase
    .from('bm_itens')
    .select('*')
    .eq('boletim_id', params.id)
    .order('ordem')

  // Pivot por função (mesma estrutura do Excel)
  type FuncaoLinha = {
    funcao: string
    efetivo: number
    carga_dia: number
    dia_hn: number
    dia_he70: number
    dia_he100: number
    hh_hn: number
    hh_he70: number
    hh_he100: number
    valor_hh_n: number
    valor_hh_70: number
    valor_hh_100: number
    valor_total: number
  }
  const pivotMap: Record<string, FuncaoLinha> = {}
  ;(itens ?? []).forEach((i: any) => {
    const key = (i.funcao_nome ?? '').toUpperCase()
    if (!pivotMap[key]) {
      pivotMap[key] = {
        funcao: i.funcao_nome ?? key,
        efetivo: Number(i.efetivo ?? 1),
        carga_dia: Number(i.carga_horaria_dia ?? 8),
        dia_hn: 0, dia_he70: 0, dia_he100: 0,
        hh_hn: 0, hh_he70: 0, hh_he100: 0,
        valor_hh_n: 0, valor_hh_70: 0, valor_hh_100: 0,
        valor_total: 0,
      }
    }
    const l = pivotMap[key]
    const dias = Number(i.dias ?? 0)
    const hh = Number(i.hh_total ?? 0)
    const vt = Number(i.valor_total ?? 0)
    const vhh = Number(i.valor_hh ?? 0)
    if (i.tipo_hora === 'normal') { l.dia_hn += dias; l.hh_hn += hh; if (vhh > 0) l.valor_hh_n = vhh }
    else if (i.tipo_hora === 'extra_70') { l.dia_he70 += dias; l.hh_he70 += hh; if (vhh > 0) l.valor_hh_70 = vhh }
    else if (i.tipo_hora === 'extra_100') { l.dia_he100 += dias; l.hh_he100 += hh; if (vhh > 0) l.valor_hh_100 = vhh }
    l.valor_total += vt
  })
  const linhas = Object.values(pivotMap).sort((a, b) => a.funcao.localeCompare(b.funcao))

  const totalGeral = linhas.reduce((s, l) => s + l.valor_total, 0)
  const totDiaHN = linhas.reduce((s, l) => s + l.dia_hn, 0)
  const totDiaHe70 = linhas.reduce((s, l) => s + l.dia_he70, 0)
  const totDiaHe100 = linhas.reduce((s, l) => s + l.dia_he100, 0)
  const totHHn = linhas.reduce((s, l) => s + l.hh_hn, 0)
  const totHH70 = linhas.reduce((s, l) => s + l.hh_he70, 0)
  const totHH100 = linhas.reduce((s, l) => s + l.hh_he100, 0)

  // === Presença: alocações + ponto_marcações (para Lançamentos e Calendário) ===
  const { data: alocsPeriodo } = await supabase
    .from('alocacoes')
    .select('funcionario_id, data_inicio, data_fim, funcionarios(id, nome, nome_guerra, cargo)')
    .eq('obra_id', bm.obras.id)
    .lte('data_inicio', bm.data_fim)
    .or(`data_fim.is.null,data_fim.gte.${bm.data_inicio}`)

  const funcIdsObra = (alocsPeriodo ?? []).map((a: any) => a.funcionario_id).filter(Boolean)
  let allPontoMarcs: any[] = []
  if (funcIdsObra.length > 0) {
    let off = 0
    while (true) {
      const { data: page } = await supabase
        .from('ponto_marcacoes')
        .select('funcionario_id, data')
        .in('funcionario_id', funcIdsObra)
        .gte('data', bm.data_inicio)
        .lte('data', bm.data_fim)
        .range(off, off + 999)
      if (!page || page.length === 0) break
      allPontoMarcs = allPontoMarcs.concat(page)
      if (page.length < 1000) break
      off += 1000
    }
  }

  type FuncPresenca = { nome: string; cargo: string; datas: Set<string> }
  const funcPresMap: Record<string, FuncPresenca> = {}
  ;(alocsPeriodo ?? []).forEach((a: any) => {
    const fid = a.funcionario_id
    if (!fid || !a.funcionarios || funcPresMap[fid]) return
    funcPresMap[fid] = {
      nome: a.funcionarios.nome_guerra || a.funcionarios.nome || '—',
      cargo: a.funcionarios.cargo || '—',
      datas: new Set(),
    }
  })
  allPontoMarcs.forEach((m: any) => {
    if (funcPresMap[m.funcionario_id]) funcPresMap[m.funcionario_id].datas.add(m.data)
  })

  // Simulated efetivo array
  const efetivoArr = Object.entries(funcPresMap).flatMap(([fid, fp]) =>
    Array.from(fp.datas).map(data => ({
      funcionario_id: fid,
      data,
      tipo_dia: (() => { const dow = new Date(data + 'T12:00').getDay(); return dow === 0 ? 'domingo_feriado' : dow === 6 ? 'sabado' : 'util' })(),
      nome: fp.nome,
      cargo: fp.cargo,
    }))
  )

  // Dates array for grid
  const datasArr: string[] = []
  const startDate = new Date(bm.data_inicio + 'T12:00')
  const endDate = new Date(bm.data_fim + 'T12:00')
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    datasArr.push(d.toISOString().split('T')[0])
  }

  // Lancamentos grid: funcao → data → count
  const funcoesAll = Array.from(new Set(efetivoArr.map(e => e.cargo).filter(Boolean))).sort()
  const gridFuncao: Record<string, Record<string, number>> = {}
  funcoesAll.forEach(f => { gridFuncao[f] = {} })
  efetivoArr.forEach(e => {
    const c = e.cargo
    if (!c) return
    gridFuncao[c][e.data] = (gridFuncao[c][e.data] ?? 0) + 1
  })

  // Calendario: per-employee presence
  const calFuncMap: Record<string, { nome: string; cargo: string; datas: Set<string> }> = {}
  efetivoArr.forEach(e => {
    if (!calFuncMap[e.funcionario_id]) {
      calFuncMap[e.funcionario_id] = { nome: e.nome, cargo: e.cargo, datas: new Set() }
    }
    calFuncMap[e.funcionario_id].datas.add(e.data)
  })
  const calFuncList = Object.values(calFuncMap).sort((a, b) => (a.cargo + a.nome).localeCompare(b.cargo + b.nome))

  const feriadosSet = new Set(efetivoArr.filter(e => e.tipo_dia === 'domingo_feriado').map(e => e.data))

  const dias = Math.ceil((new Date(bm.data_fim).getTime() - new Date(bm.data_inicio).getTime()) / 86400000) + 1
  const periodo = `${new Date(bm.data_inicio + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(bm.data_fim + 'T12:00').toLocaleDateString('pt-BR')}`
  const numero = String(bm.numero).padStart(2, '0')
  const diasSem = ['D','S','T','Q','Q','S','S']

  return (
    <>
      <PrintTrigger filename={`BM${numero}_${(bm.obras?.nome ?? 'obra').replace(/\s+/g, '_')}`} />

      <style>{`
        @media screen {
          body { background: #e5e7eb; }
          header { display: none !important; } /* esconde Topbar do dashboard */
          main { padding-top: 0 !important; }
          .bm-sheet { margin: 24px auto; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
          .no-print { display: flex; }
        }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white; margin: 0; }
          header, nav, aside, .no-print, [class*="Topbar"], [class*="Sidebar"] { display: none !important; }
          main { padding: 0 !important; }
          .bm-sheet { margin: 0; box-shadow: none; max-width: none; min-height: auto; }
        }
        .bm-sheet {
          background: white;
          max-width: 297mm;
          min-height: 210mm;
          padding: 0;
          color: #222;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        }
      `}</style>

      <div className="bm-sheet">
        {/* Cabeçalho navy com logo */}
        <div style={{ background: '#0F3757', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '4px solid #C9A269' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Image src="/logos/tecnomonte-dark.png" alt="Tecnomonte" width={220} height={66} priority unoptimized />
          </div>
          <div style={{ textAlign: 'right', color: 'white' }}>
            <div style={{ color: '#DBBE8A', fontSize: 11, fontStyle: 'italic', fontWeight: 600 }}>FABRICAÇÃO, MONTAGEM E MANUTENÇÃO INDUSTRIAL</div>
            <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>BOLETIM DE MEDIÇÃO Nº {numero}</div>
          </div>
        </div>

        {/* Info block */}
        <div style={{ background: '#F4EDE0', padding: '12px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, borderBottom: '3px solid #C9A269' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#0F3757', letterSpacing: 0.5 }}>CLIENTE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{(bm.obras?.cliente ?? '').toUpperCase()}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#0F3757', letterSpacing: 0.5 }}>OBRA</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{bm.obras?.nome}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#0F3757', letterSpacing: 0.5 }}>LOCAL</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{(bm.obras?.local ?? '').toUpperCase()}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#0F3757', letterSpacing: 0.5 }}>PERÍODO</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#222' }}>{periodo}</div>
            <div style={{ fontSize: 10, color: '#666' }}>{dias} dias · 07:00 às 17:00</div>
          </div>
        </div>

        {/* Título da seção */}
        <div style={{ padding: '16px 20px 8px' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#0F3757', letterSpacing: 0.3 }}>RESUMO DE HORAS POR FUNÇÃO</h2>
        </div>

        {/* Tabela */}
        <div style={{ padding: '0 20px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={th(12, 'left')}>Nº</th>
                <th rowSpan={2} style={th(null, 'left')}>FUNÇÃO</th>
                <th rowSpan={2} style={th(60)}>EFETIVO</th>
                <th colSpan={3} style={th(null)}>DIAS</th>
                <th colSpan={3} style={th(null)}>HORAS</th>
                <th rowSpan={2} style={th(90, 'right')}>R$/HH</th>
                <th rowSpan={2} style={th(110, 'right')}>VALOR TOTAL</th>
              </tr>
              <tr>
                <th style={thSub()}>DIA HN</th>
                <th style={thSub()}>DIA HE 70%</th>
                <th style={thSub()}>DIA HE 100%</th>
                <th style={thSub()}>HH NORMAL</th>
                <th style={thSub()}>HH HE 70%</th>
                <th style={thSub()}>HH HE 100%</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.funcao} style={{ background: i % 2 === 1 ? '#FAF8F2' : 'white' }}>
                  <td style={td('center', '#0F3757', 700)}>{i + 1}</td>
                  <td style={td('left', '#222', 700)}>{l.funcao}</td>
                  <td style={td('center')}>{l.efetivo}</td>
                  <td style={td('center', '#1D4ED8', 700)}>{l.dia_hn || '—'}</td>
                  <td style={td('center', '#B45309', 700)}>{l.dia_he70 || '—'}</td>
                  <td style={td('center', '#B91C1C', 700)}>{l.dia_he100 || '—'}</td>
                  <td style={td('center', '#1D4ED8')}>{l.hh_hn ? fmtN(l.hh_hn) : '—'}</td>
                  <td style={td('center', '#B45309')}>{l.hh_he70 ? fmtN(l.hh_he70) : '—'}</td>
                  <td style={td('center', '#B91C1C')}>{l.hh_he100 ? fmtN(l.hh_he100) : '—'}</td>
                  <td style={td('right', '#555')}>{fmt(l.valor_hh_n || l.valor_hh_70 || l.valor_hh_100 || 0)}</td>
                  <td style={td('right', '#0F3757', 700)}>{fmt(l.valor_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#0F3757', color: 'white' }}>
                <td colSpan={3} style={{ ...td('left'), color: '#C9A269', fontWeight: 900, fontSize: 12, padding: '10px 8px' }}>TOTAL GERAL</td>
                <td style={{ ...td('center'), color: '#93C5FD', fontWeight: 700 }}>{totDiaHN || '—'}</td>
                <td style={{ ...td('center'), color: '#FCD34D', fontWeight: 700 }}>{totDiaHe70 || '—'}</td>
                <td style={{ ...td('center'), color: '#FCA5A5', fontWeight: 700 }}>{totDiaHe100 || '—'}</td>
                <td style={{ ...td('center'), color: '#93C5FD', fontWeight: 700 }}>{totHHn ? fmtN(totHHn) : '—'}</td>
                <td style={{ ...td('center'), color: '#FCD34D', fontWeight: 700 }}>{totHH70 ? fmtN(totHH70) : '—'}</td>
                <td style={{ ...td('center'), color: '#FCA5A5', fontWeight: 700 }}>{totHH100 ? fmtN(totHH100) : '—'}</td>
                <td></td>
                <td style={{ ...td('right'), color: '#C9A269', fontWeight: 900, fontSize: 13, padding: '10px 8px' }}>{fmt(totalGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Rodapé */}
        <div style={{ borderTop: '3px solid #C9A269', padding: '8px 20px', color: '#888', fontSize: 9, fontStyle: 'italic', display: 'flex', justifyContent: 'space-between' }}>
          <span>Emitido em {new Date().toLocaleDateString('pt-BR')} · Tecnomonte Softmonte</span>
          <span>Pagina 1 de 3</span>
        </div>
      </div>

      {/* === PAGE 2: LANCAMENTOS POR FUNCAO === */}
      <style>{`
        @media print {
          .bm-sheet-landscape { page-break-before: always; }
          @page { size: A4 landscape; margin: 8mm; }
        }
        @media screen {
          .bm-sheet-landscape { margin: 24px auto; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
        }
        .bm-sheet-landscape {
          background: white;
          max-width: 297mm;
          padding: 0;
          color: #222;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        }
        .day-sat { background: #FFF3B0 !important; }
        .day-dom { background: #FFC7C7 !important; }
        .day-present { color: #155E2B; font-weight: 700; }
      `}</style>

      <div className="bm-sheet-landscape">
        <div style={{ background: '#0F3757', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #C9A269' }}>
          <div style={{ color: 'white' }}>
            <div style={{ fontSize: 14, fontWeight: 900 }}>LANCAMENTOS POR FUNCAO</div>
            <div style={{ fontSize: 10, opacity: 0.8 }}>BM Nº {numero} — {bm.obras?.nome} — {periodo}</div>
          </div>
          <div style={{ fontSize: 9, color: '#C9A269', fontStyle: 'italic' }}>
            Quantidade de pessoas por funcao em cada dia do periodo
          </div>
        </div>

        <div style={{ padding: '12px 12px', overflowX: 'auto' }}>
          {funcoesAll.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', background: '#0F3757', color: 'white', padding: '5px 8px', minWidth: 110, fontSize: 9, fontWeight: 700 }}>FUNCAO</th>
                  {datasArr.map(d => {
                    const dt = new Date(d + 'T12:00')
                    const dow = dt.getDay()
                    const isDom = dow === 0 || feriadosSet.has(d)
                    const isSab = dow === 6
                    const bg = isDom ? '#FFC7C7' : isSab ? '#FFF3B0' : '#0F3757'
                    const clr = (isDom || isSab) ? '#0F3757' : 'white'
                    return (
                      <th key={d} style={{ textAlign: 'center', background: bg, color: clr, padding: '3px 2px', minWidth: 22, fontSize: 7, fontWeight: 700 }}>
                        {dt.getDate()}/{dt.getMonth() + 1}
                      </th>
                    )
                  })}
                  <th style={{ textAlign: 'center', background: '#0F3757', color: '#C9A269', padding: '5px 6px', fontWeight: 900, fontSize: 9 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {funcoesAll.map((f, fi) => {
                  let total = 0
                  return (
                    <tr key={fi} style={{ borderBottom: '1px solid #eee', background: fi % 2 === 1 ? '#FAF8F2' : 'white' }}>
                      <td style={{ fontWeight: 700, fontSize: 9, padding: '4px 8px', color: '#0F3757' }}>{f}</td>
                      {datasArr.map(d => {
                        const v = gridFuncao[f]?.[d] ?? 0
                        total += v
                        const dow = new Date(d + 'T12:00').getDay()
                        const isDom = dow === 0 || feriadosSet.has(d)
                        const isSab = dow === 6
                        return (
                          <td key={d} className={isDom ? 'day-dom' : isSab ? 'day-sat' : ''} style={{ textAlign: 'center', fontSize: 9, padding: '3px 2px' }}>
                            {v || ''}
                          </td>
                        )
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 700, background: '#F4EDE0', padding: '3px 4px', color: '#0F3757' }}>{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 11 }}>
              Sem dados de presenca para este periodo.
            </div>
          )}
        </div>

        <div style={{ padding: '6px 12px', fontSize: 8, color: '#999' }}>
          <span style={{ display: 'inline-block', width: 10, height: 8, background: '#FFF3B0', marginRight: 3, border: '1px solid #ddd' }} /> Sabado
          <span style={{ display: 'inline-block', width: 10, height: 8, background: '#FFC7C7', marginRight: 3, marginLeft: 10, border: '1px solid #ddd' }} /> Domingo/Feriado
        </div>

        <div style={{ borderTop: '3px solid #C9A269', padding: '8px 20px', color: '#888', fontSize: 9, fontStyle: 'italic', display: 'flex', justifyContent: 'space-between' }}>
          <span>Emitido em {new Date().toLocaleDateString('pt-BR')} · Tecnomonte Softmonte</span>
          <span>Pagina 2 de 3</span>
        </div>
      </div>

      {/* === PAGE 3: CALENDARIO DE PRESENCA === */}
      <div className="bm-sheet-landscape">
        <div style={{ background: '#0F3757', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #C9A269' }}>
          <div style={{ color: 'white' }}>
            <div style={{ fontSize: 14, fontWeight: 900 }}>CALENDARIO DE PRESENCA</div>
            <div style={{ fontSize: 10, opacity: 0.8 }}>BM Nº {numero} — {bm.obras?.nome} — {periodo}</div>
          </div>
          <div style={{ fontSize: 9, color: '#C9A269', fontStyle: 'italic' }}>
            &quot;P&quot; = Presente
          </div>
        </div>

        <div style={{ padding: '12px 12px', overflowX: 'auto' }}>
          {calFuncList.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', background: '#0F3757', color: 'white', padding: '5px 8px', minWidth: 120, fontSize: 9, fontWeight: 700 }}>FUNCIONARIO</th>
                  <th style={{ textAlign: 'left', background: '#0F3757', color: 'white', padding: '5px 6px', minWidth: 80, fontSize: 9, fontWeight: 700 }}>FUNCAO</th>
                  {datasArr.map(d => {
                    const dt = new Date(d + 'T12:00')
                    const dow = dt.getDay()
                    const isDom = dow === 0 || feriadosSet.has(d)
                    const isSab = dow === 6
                    const bg = isDom ? '#FFC7C7' : isSab ? '#FFF3B0' : '#0F3757'
                    const clr = (isDom || isSab) ? '#0F3757' : 'white'
                    return (
                      <th key={d} style={{ textAlign: 'center', background: bg, color: clr, padding: '2px 2px', minWidth: 20, fontSize: 7, fontWeight: 700, lineHeight: 1.2 }}>
                        {diasSem[dow]}<br/>{dt.getDate()}
                      </th>
                    )
                  })}
                  <th style={{ textAlign: 'center', background: '#0F3757', color: '#C9A269', padding: '5px 4px', fontWeight: 900, fontSize: 8 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {calFuncList.map((f, fi) => {
                  let total = 0
                  return (
                    <tr key={fi} style={{ borderBottom: '1px solid #eee', background: fi % 2 === 1 ? '#FAF8F2' : 'white' }}>
                      <td style={{ fontWeight: 700, fontSize: 8, padding: '3px 8px', color: '#0F3757', whiteSpace: 'nowrap' }}>{f.nome}</td>
                      <td style={{ fontSize: 7, color: '#666', padding: '3px 6px' }}>{f.cargo}</td>
                      {datasArr.map(d => {
                        const present = f.datas.has(d)
                        if (present) total++
                        const dow = new Date(d + 'T12:00').getDay()
                        const isDom = dow === 0 || feriadosSet.has(d)
                        const isSab = dow === 6
                        return (
                          <td key={d} className={isDom ? 'day-dom' : isSab ? 'day-sat' : ''} style={{ textAlign: 'center', fontSize: 8, padding: '2px 1px' }}>
                            {present ? <span className="day-present">P</span> : ''}
                          </td>
                        )
                      })}
                      <td style={{ textAlign: 'center', fontWeight: 700, background: '#F4EDE0', padding: '2px 4px', fontSize: 8, color: '#0F3757' }}>{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 11 }}>
              Sem dados de presenca para este periodo.
            </div>
          )}
        </div>

        <div style={{ padding: '6px 12px', fontSize: 8, color: '#999' }}>
          <span style={{ display: 'inline-block', width: 10, height: 8, background: '#FFF3B0', marginRight: 3, border: '1px solid #ddd' }} /> Sabado
          <span style={{ display: 'inline-block', width: 10, height: 8, background: '#FFC7C7', marginRight: 3, marginLeft: 10, border: '1px solid #ddd' }} /> Domingo/Feriado
          <span style={{ display: 'inline-block', width: 10, height: 8, background: '#D1FAE5', marginRight: 3, marginLeft: 10, border: '1px solid #ddd' }} /> Presente
        </div>

        {/* Assinaturas */}
        <div style={{ padding: '24px 20px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
          <div style={{ borderTop: '1px solid #999', paddingTop: 8, textAlign: 'center', fontSize: 10, color: '#555' }}>
            Responsavel Tecnomonte
          </div>
          <div style={{ borderTop: '1px solid #999', paddingTop: 8, textAlign: 'center', fontSize: 10, color: '#555' }}>
            Responsavel {bm.obras?.cliente || 'Cliente'}
          </div>
        </div>

        <div style={{ borderTop: '3px solid #C9A269', padding: '8px 20px', color: '#888', fontSize: 9, fontStyle: 'italic', display: 'flex', justifyContent: 'space-between' }}>
          <span>Emitido em {new Date().toLocaleDateString('pt-BR')} · Tecnomonte Softmonte</span>
          <span>Pagina 3 de 3</span>
        </div>
      </div>
    </>
  )
}

function th(width: number | null, align: 'left' | 'center' | 'right' = 'center'): React.CSSProperties {
  return {
    background: '#0F3757',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 10,
    padding: '8px 6px',
    textAlign: align,
    ...(width ? { width } : {}),
    borderTop: '1px solid #C9A269',
    borderBottom: '1px solid #C9A269',
  }
}
function thSub(): React.CSSProperties {
  return {
    background: '#164B73',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 9,
    padding: '6px 4px',
    textAlign: 'center',
    borderBottom: '1px solid #C9A269',
  }
}
function td(align: 'left' | 'center' | 'right', color = '#222', weight: number | string = 400): React.CSSProperties {
  return {
    padding: '6px 8px',
    textAlign: align,
    color,
    fontWeight: weight,
    borderBottom: '1px solid #eee',
  }
}
