import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PrintButton from './PrintButton'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const fmt = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default async function HoleritePage({ params }: { params: { id: string; funcionarioId: string } }) {
  const supabase = createClient()

  const [{ data: fi }, { data: ff }, { data: func }, { data: empresa }] = await Promise.all([
    supabase.from('folha_itens').select('*').eq('folha_id', params.id).eq('funcionario_id', params.funcionarioId).maybeSingle(),
    supabase.from('folha_fechamentos').select('*, obras(nome)').eq('id', params.id).maybeSingle(),
    supabase.from('funcionarios').select('*, funcoes(nome)').eq('id', params.funcionarioId).maybeSingle(),
    supabase.from('empresa_config').select('*').limit(1).maybeSingle(),
  ])

  if (!fi || !ff || !func) notFound()

  const salario = Number(fi.salario_total || 0)
  const inss = Number(fi.desconto_inss || 0)
  const irrf = Number(fi.desconto_irrf || 0)
  const descVT = Number(fi.outros_descontos || 0)
  const liquido = Number(fi.valor_liquido || 0)
  const vt = Number(func.vt_mensal || 0)
  const vr = Number(func.vr_diario || 0) * Number(fi.dias_trabalhados || 21)
  const va = Number(func.va_mensal || 0)
  const plano = Number(func.plano_saude_mensal || 0)
  const baseFgts = salario
  const fgtsMes = Math.round(baseFgts * 0.08 * 100) / 100
  const totalVenc = salario + vt + vr + va + plano
  const totalDesc = inss + irrf + descVT

  type Evento = { cod: string; desc: string; ref: string; venc: number; desc_val: number }
  const eventos: Evento[] = []

  // Vencimentos
  eventos.push({ cod: '0001', desc: 'Salário Mensal', ref: `${fi.dias_trabalhados || 30}d`, venc: salario, desc_val: 0 })
  if (vt > 0) eventos.push({ cod: '0010', desc: 'Vale Transporte', ref: '100%', venc: vt, desc_val: 0 })
  if (vr > 0) eventos.push({ cod: '0011', desc: 'Vale Refeição', ref: `${fi.dias_trabalhados || 21}d`, venc: vr, desc_val: 0 })
  if (va > 0) eventos.push({ cod: '0012', desc: 'Vale Alimentação', ref: '100%', venc: va, desc_val: 0 })
  if (plano > 0) eventos.push({ cod: '0013', desc: 'Plano de Saúde', ref: '100%', venc: plano, desc_val: 0 })

  // Descontos
  if (inss > 0) eventos.push({ cod: '0150', desc: 'INSS Empregado', ref: 'Progressivo', venc: 0, desc_val: inss })
  if (irrf > 0) eventos.push({ cod: '0160', desc: 'IRRF', ref: 'Progressivo', venc: 0, desc_val: irrf })
  if (descVT > 0) eventos.push({ cod: '0170', desc: 'Desconto Vale Transporte', ref: '6%', venc: 0, desc_val: descVT })

  return (
    <>
      <PrintButton />

      <style>{`
        @media print {
          body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 15mm; }
          header, nav, aside { display: none !important; }
          main { padding: 0 !important; }
        }
        @media screen {
          .holerite { max-width: 210mm; margin: 20px auto; background: white; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
        }
        .holerite { font-family: 'Inter', Arial, sans-serif; color: #222; font-size: 11px; }
        .holerite table { width: 100%; border-collapse: collapse; }
        .holerite th, .holerite td { border: 1px solid #ccc; padding: 4px 8px; }
        .holerite th { background: #f3f4f6; font-weight: 700; text-align: left; font-size: 10px; text-transform: uppercase; }
      `}</style>

      <div className="holerite p-8">
        {/* Cabeçalho empresa */}
        <div style={{ borderBottom: '3px solid #0F3757', paddingBottom: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0F3757', letterSpacing: 1 }}>TECNOMONTE</div>
              <div style={{ fontSize: 9, color: '#666' }}>Fabricação, Montagem e Manutenção Industrial</div>
              <div style={{ fontSize: 9, color: '#666' }}>CNPJ: {empresa?.cnpj || '31.045.857/0001-51'}</div>
              <div style={{ fontSize: 9, color: '#666' }}>{empresa?.endereco || 'Av. Pio XII, 33'} — {empresa?.cidade || 'Paulínia'}/{empresa?.estado || 'SP'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0F3757' }}>RECIBO DE PAGAMENTO</div>
              <div style={{ fontSize: 10, color: '#666' }}>Competência: {MESES[ff.mes]}/{ff.ano}</div>
            </div>
          </div>
        </div>

        {/* Dados do funcionário */}
        <table style={{ marginBottom: 12 }}>
          <tbody>
            <tr>
              <td style={{ width: '50%' }}><strong>Nome:</strong> {func.nome}</td>
              <td><strong>Cargo:</strong> {func.funcoes?.nome || func.cargo}</td>
            </tr>
            <tr>
              <td><strong>Admissão:</strong> {func.admissao ? new Date(func.admissao + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
              <td><strong>Obra:</strong> {ff.obras?.nome || '—'}</td>
            </tr>
            <tr>
              <td><strong>CPF:</strong> {func.cpf ? func.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</td>
              <td><strong>Salário Base:</strong> R$ {fmt(Number(func.salario_base || 0))}</td>
            </tr>
          </tbody>
        </table>

        {/* Eventos */}
        <table style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 50 }}>Cód</th>
              <th>Descrição</th>
              <th style={{ width: 60 }}>Ref</th>
              <th style={{ width: 90, textAlign: 'right' }}>Vencimento</th>
              <th style={{ width: 90, textAlign: 'right' }}>Desconto</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map(e => (
              <tr key={e.cod}>
                <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{e.cod}</td>
                <td>{e.desc}</td>
                <td style={{ textAlign: 'center', fontSize: 10 }}>{e.ref}</td>
                <td style={{ textAlign: 'right', color: e.venc > 0 ? '#166534' : '#999' }}>{e.venc > 0 ? `R$ ${fmt(e.venc)}` : ''}</td>
                <td style={{ textAlign: 'right', color: e.desc_val > 0 ? '#991b1b' : '#999' }}>{e.desc_val > 0 ? `R$ ${fmt(e.desc_val)}` : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
              <td colSpan={3} style={{ textAlign: 'right' }}>TOTAIS</td>
              <td style={{ textAlign: 'right', color: '#166534' }}>R$ {fmt(totalVenc)}</td>
              <td style={{ textAlign: 'right', color: '#991b1b' }}>R$ {fmt(totalDesc)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Líquido */}
        <div style={{ background: '#0F3757', color: 'white', padding: '10px 16px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>SALÁRIO LÍQUIDO A RECEBER</span>
          <span style={{ fontWeight: 900, fontSize: 16 }}>R$ {fmt(liquido)}</span>
        </div>

        {/* Info complementar */}
        <table style={{ marginBottom: 20 }}>
          <tbody>
            <tr>
              <td><strong>Dias trabalhados:</strong> {fi.dias_trabalhados || '—'}</td>
              <td><strong>Dias descontados:</strong> {fi.dias_descontados || 0}</td>
              <td><strong>Base FGTS:</strong> R$ {fmt(baseFgts)}</td>
              <td><strong>FGTS mês:</strong> R$ {fmt(fgtsMes)}</td>
            </tr>
          </tbody>
        </table>

        {/* Assinaturas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, marginTop: 40 }}>
          <div style={{ borderTop: '1px solid #999', paddingTop: 8, textAlign: 'center', fontSize: 10, color: '#555' }}>
            Assinatura do Empregado
          </div>
          <div style={{ borderTop: '1px solid #999', paddingTop: 8, textAlign: 'center', fontSize: 10, color: '#555' }}>
            Tecnomonte (Empregador)
          </div>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 8, color: '#999', fontStyle: 'italic' }}>
          Documento gerado pelo Softmonte em {new Date().toLocaleDateString('pt-BR')}
        </div>
      </div>
    </>
  )
}
