import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import PrintTrigger from './PrintTrigger'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

  const dias = Math.ceil((new Date(bm.data_fim).getTime() - new Date(bm.data_inicio).getTime()) / 86400000) + 1
  const periodo = `${new Date(bm.data_inicio + 'T12:00').toLocaleDateString('pt-BR')} a ${new Date(bm.data_fim + 'T12:00').toLocaleDateString('pt-BR')}`
  const numero = String(bm.numero).padStart(2, '0')

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
        <div style={{ borderTop: '3px solid #C9A269', padding: '8px 20px', color: '#888', fontSize: 9, fontStyle: 'italic', textAlign: 'center' }}>
          Emitido em {new Date().toLocaleDateString('pt-BR')} · Tecnomonte Softmonte
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
